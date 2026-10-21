import { fetchGameDetails } from "./game-details";
import type { Game, Team } from "../../domain";
import { enrichOfficialTeams } from "./team-details";
import { gameSchema, settingsSchema, teamSchema } from "../../domain";
import type { TournamentStore } from "../../store";
import { fetchFibaPage, type FetchLike } from "./client";
import { parseEventPage, parseStandingsPage, probeLeadersPage } from "./parser";
import {
  buildPlan,
  SYSTEM_ACTORS,
  SYSTEM_ACTOR_PREFIXES,
  type PlanEntry,
  type PlanOptions,
  type SyncPlan,
} from "./plan";

export const SYNC_ACTOR = "fiba-sync";

/**
 * The last complete read of FIBA (teams with their official details, and the standings), kept in memory so that
 * fast runs can read each active match directly without requesting the delayed games list.
 */
let lastContext: {
  event: ReturnType<typeof parseEventPage>;
  standings: ReturnType<typeof parseStandingsPage>;
  at: number;
} | null = null;
export const CONTEXT_MAX_AGE_MS = 15 * 60_000;
/** For tests: forget the remembered read. */
export function forgetSyncContext() {
  lastContext = null;
}

const logSchema = `
CREATE TABLE IF NOT EXISTS fiba_sync_runs(id INTEGER PRIMARY KEY AUTOINCREMENT,started TEXT NOT NULL,finished TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,error TEXT,summary TEXT);
CREATE TABLE IF NOT EXISTS fiba_sync_entries(run_id INTEGER NOT NULL REFERENCES fiba_sync_runs(id),kind TEXT NOT NULL,id TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS fiba_sync_entries_run ON fiba_sync_entries(run_id);
`;

export type SyncResult = {
  mode: "apply" | "dry-run";
  runId: number | null;
  plan: SyncPlan;
  counts: Record<string, number>;
  stats: { playerRecordsSeen: number };
};

function countActions(entries: PlanEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const key = `${entry.kind}.${entry.action}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Records edited by a human: any audit entry written by an actor that is not a system actor. */
async function manualOverrides(store: TournamentStore): Promise<Set<string>> {
  const placeholders = SYSTEM_ACTORS.map(() => "?").join(",");
  const rows = (await store.db
    .prepare(
      `SELECT DISTINCT kind,target FROM audit WHERE actor NOT IN (${placeholders})${SYSTEM_ACTOR_PREFIXES.map(
        () => " AND actor NOT LIKE ?",
      ).join("")}`,
    )
    .all(
      ...SYSTEM_ACTORS,
      ...SYSTEM_ACTOR_PREFIXES.map((prefix) => `${prefix}%`),
    )) as { kind: string; target: string }[];
  return new Set(rows.map((row) => `${row.kind}:${row.target}`));
}

async function logRun(
  store: TournamentStore,
  run: {
    started: string;
    mode: string;
    status: string;
    error?: string;
    summary?: unknown;
  },
  entries: PlanEntry[],
): Promise<number> {
  const row = (await store.db
    .prepare(
      "INSERT INTO fiba_sync_runs(started,finished,mode,status,error,summary) VALUES(?,?,?,?,?,?) RETURNING id",
    )
    .get(
      run.started,
      new Date().toISOString(),
      run.mode,
      run.status,
      run.error ?? null,
      run.summary ? JSON.stringify(run.summary) : null,
    )) as { id: number };
  for (const entry of entries) {
    await store.db
      .prepare(
        "INSERT INTO fiba_sync_entries(run_id,kind,id,action,reason) VALUES(?,?,?,?,?)",
      )
      .run(row.id, entry.kind, entry.id, entry.action, entry.reason);
  }
  return row.id;
}

async function readLiveGames(
  store: TournamentStore,
  event: ReturnType<typeof parseEventPage>,
  standings: ReturnType<typeof parseStandingsPage>,
  options: { fetchImpl?: FetchLike; plan?: PlanOptions },
  authoritative: boolean,
) {
  const now = options.plan?.now ?? new Date().toISOString();
  const liveGames = new Map<number, Partial<Game>>();
  const failedLiveGames = new Set<number>();
  const liveNotes: string[] = [];
  const liveIds = new Set<string>();
  const previewState = {
    settings: settingsSchema.parse(await store.get("settings", "tournament")),
    teams: (await store.list<Team>("teams")).map((t) => teamSchema.parse(t)),
    games: (await store.list<Game>("games")).map((g) => gameSchema.parse(g)),
    overridden: await manualOverrides(store),
  };
  for (const game of event.games) {
    const candidate = buildPlan(
      { ...event, games: [game] },
      standings,
      previewState,
      { ...options.plan, authoritative },
    ).entries.find((e) => e.kind === "games");
    if (
      !candidate ||
      (!["create", "update", "unchanged"].includes(candidate.action) &&
        !candidate.reason.startsWith("unrecognised FIBA status"))
    )
      continue;
    const id = candidate.id;
    const previous = previewState.games.find((g) => g.id === id);
    if (previous?.manual) continue;
    const start = Date.parse(
      game.gameDateTimeUTC.endsWith("Z")
        ? game.gameDateTimeUTC
        : game.gameDateTimeUTC + "Z",
    );
    const delta = Date.parse(now) - start;
    const active = previous && ["Live", "Halftime"].includes(previous.status);
    const finished = previous?.status === "Ended" && !!previous.officialDetails;
    if (finished) {
      const {
        status,
        homeScore,
        awayScore,
        quarter,
        clock,
        running,
        periods,
        officialDetails,
      } = previous;
      liveGames.set(game.gameId, {
        status,
        homeScore,
        awayScore,
        quarter,
        clock,
        running,
        periods,
        officialDetails,
      });
      liveIds.add(id);
      continue;
    }
    if (!(active || game.isLive || (delta >= -600000 && delta <= 6 * 3600000)))
      continue;
    try {
      liveGames.set(
        game.gameId,
        await fetchGameDetails(game, now, previous, options.fetchImpl),
      );
      liveIds.add(id);
    } catch (error) {
      failedLiveGames.add(game.gameId);
      liveNotes.push(
        `${id}: ${error instanceof Error ? error.message : "live source failed"}`,
      );
    }
  }

  return { liveGames, failedLiveGames, liveNotes, liveIds };
}

/**
 * FIBA → local database. Event pages are validated before anything is written.
 * Individual live-feed failures retain the last confirmed match and are reported.
 * Writes happen in one transaction
 * together with the sync log, through the same `write` path (and audit trail) the admin uses.
 */
export async function runSync(
  store: TournamentStore,
  options: { apply: boolean; fetchImpl?: FetchLike; plan?: PlanOptions } = {
    apply: true,
  },
): Promise<SyncResult> {
  const started = new Date().toISOString();
  const mode = options.apply ? "apply" : "dry-run";
  if (options.apply) await store.db.exec(logSchema);
  try {
    const eventPage = parseEventPage(
      (await fetchFibaPage("games", options.fetchImpl)).html,
    );
    const standings = parseStandingsPage(
      (await fetchFibaPage("standings", options.fetchImpl)).html,
    );
    const leaders = probeLeadersPage(
      (await fetchFibaPage("leaders", options.fetchImpl)).html,
    );
    const authoritative = options.plan?.authoritative ?? true;
    if (authoritative) {
      const settings = settingsSchema.parse(
        await store.get("settings", "tournament"),
      );
      const stage = standings.stages.find((s) => s.code === "DW-GP");
      const ids = new Set(
        stage?.groups
          .filter((g) => settings.groups.includes(g.groupName))
          .flatMap((g) =>
            g.teamsStats.flatMap((t) =>
              typeof t.team === "number" ? [t.team] : [],
            ),
          ) ?? [],
      );
      await enrichOfficialTeams(eventPage, ids, options.fetchImpl);
    }

    lastContext = { event: eventPage, standings, at: Date.now() };
    const { liveGames, failedLiveGames, liveNotes } = await readLiveGames(
      store,
      eventPage,
      standings,
      options,
      authoritative,
    );
    const plan = await store.db.transaction(
      async () => {
        const state = {
          settings: settingsSchema.parse(
            await store.get("settings", "tournament"),
          ),
          teams: (await store.list<Team>("teams")).map((team) =>
            teamSchema.parse(team),
          ),
          games: (await store.list<Game>("games")).map((game) =>
            gameSchema.parse(game),
          ),
          overridden: await manualOverrides(store),
        };
        const built = buildPlan(eventPage, standings, state, {
          ...options.plan,
          authoritative,
          liveGames,
          failedLiveGames,
        });
        built.notes.push(...liveNotes);
        if (!options.apply) return built;
        // Teams first: games reference them.
        const ordered = [...built.entries].sort((a, b) =>
          a.kind === b.kind ? 0 : a.kind === "teams" ? -1 : 1,
        );
        for (const entry of ordered) {
          if (
            (entry.action === "create" || entry.action === "update") &&
            entry.value
          ) {
            await store.write(
              entry.kind,
              entry.id,
              entry.value,
              SYNC_ACTOR,
              `fiba-${entry.action}`,
            );
          }
        }
        // Withdrawn clubs: fixtures first, then teams. Anything still referenced is kept and reported.
        for (const kind of ["games", "teams"] as const) {
          for (const entry of built.entries) {
            if (entry.action !== "remove" || entry.kind !== kind) continue;
            const removed = await store.remove(
              entry.kind,
              entry.id,
              SYNC_ACTOR,
              "fiba-remove",
            );
            if (!removed) {
              entry.action = "skipped";
              entry.reason =
                "still referenced by other records (players, fixtures or statistics); not removed";
            }
          }
        }
        return built;
      },
      options.apply ? "write" : "read",
    )();

    const counts = countActions(plan.entries);
    const runId = options.apply
      ? await store.db.transaction(() =>
          logRun(
            store,
            {
              started,
              mode,
              status: "ok",
              summary: {
                counts,
                notes: plan.notes,
                playerRecordsSeen: leaders.playerRecords,
              },
            },
            plan.entries,
          ),
        )()
      : null;
    return {
      mode,
      runId,
      plan,
      counts,
      stats: { playerRecordsSeen: leaders.playerRecords },
    };
  } catch (error) {
    if (options.apply) {
      await store.db
        .transaction(() =>
          logRun(
            store,
            {
              started,
              mode,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            },
            [],
          ),
        )()
        .catch(() => undefined);
    }
    throw error;
  }
}

/**
 * A match is on: read the individual match page live feed using remembered fixture identities.
 * Teams, standings and everything else keep what the last complete sync stored. Without a recent complete read
 * (after a restart, or older than fifteen minutes) it runs the complete sync instead.
 */
export async function runGamesSync(
  store: TournamentStore,
  options: { fetchImpl?: FetchLike; plan?: PlanOptions } = {},
): Promise<{
  mode: "games" | "full";
  changed: number;
  counts: Record<string, number>;
}> {
  const context = lastContext;
  if (!context || Date.now() - context.at > CONTEXT_MAX_AGE_MS) {
    const full = await runSync(store, {
      apply: true,
      fetchImpl: options.fetchImpl,
      plan: options.plan,
    });
    return {
      mode: "full",
      changed:
        (full.counts["games.update"] ?? 0) + (full.counts["games.create"] ?? 0),
      counts: full.counts,
    };
  }
  const started = new Date().toISOString();
  await store.db.exec(logSchema);
  // Fixture identities come from the remembered schedule; live facts come only
  // from the individual match page feed, never the delayed /games list.
  const event = context.event;
  const authoritative = options.plan?.authoritative ?? true;
  const { liveGames, failedLiveGames, liveIds } = await readLiveGames(
    store,
    event,
    context.standings,
    options,
    authoritative,
  );
  const written = await store.db.transaction(async () => {
    const state = {
      settings: settingsSchema.parse(await store.get("settings", "tournament")),
      teams: (await store.list<Team>("teams")).map((team) =>
        teamSchema.parse(team),
      ),
      games: (await store.list<Game>("games")).map((game) =>
        gameSchema.parse(game),
      ),
      overridden: await manualOverrides(store),
    };
    const built = buildPlan(event, context.standings, state, {
      ...options.plan,
      authoritative,
      liveGames,
      failedLiveGames,
    });
    const entries = built.entries.filter(
      (e) =>
        e.kind === "games" &&
        liveIds.has(e.id) &&
        (e.action === "create" || e.action === "update") &&
        e.value,
    );
    for (const entry of entries)
      await store.write(
        entry.kind,
        entry.id,
        entry.value,
        SYNC_ACTOR,
        `fiba-${entry.action}`,
      );
    return entries;
  }, "write")();
  const counts = countActions(written);
  // Quiet runs leave no trace: only a run that changed something is logged.
  if (written.length)
    await store.db.transaction(() =>
      logRun(
        store,
        { started, mode: "apply-games", status: "ok", summary: { counts } },
        written,
      ),
    )();
  return { mode: "games", changed: written.length, counts };
}

export function formatSyncResult(result: SyncResult): string {
  const lines = [
    `FIBA sync (${result.mode})${result.runId ? ` — run #${result.runId}` : " — nothing written"}`,
    ...Object.entries(result.counts).map(
      ([key, value]) => `  ${key}: ${value}`,
    ),
    "",
    ...result.plan.entries.map(
      (entry) =>
        `  [${entry.action}] ${entry.kind}/${entry.id} — ${entry.reason}`,
    ),
    ...result.plan.notes.map((note) => `  note: ${note}`),
    `  player statistics records seen on FIBA: ${result.stats.playerRecordsSeen}`,
  ];
  return lines.join("\n");
}
