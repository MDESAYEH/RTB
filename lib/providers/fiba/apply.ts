import type { Game, Team } from "../../domain";
import { gameSchema, settingsSchema, teamSchema } from "../../domain";
import type { TournamentStore } from "../../store";
import { fetchFibaPage, type FetchLike } from "./client";
import { parseEventPage, parseStandingsPage, probeLeadersPage } from "./parser";
import { buildPlan, SYSTEM_ACTORS, SYSTEM_ACTOR_PREFIXES, type PlanEntry, type PlanOptions, type SyncPlan } from "./plan";

export const SYNC_ACTOR = "fiba-sync";

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
    .all(...SYSTEM_ACTORS, ...SYSTEM_ACTOR_PREFIXES.map((prefix) => `${prefix}%`))) as { kind: string; target: string }[];
  return new Set(rows.map((row) => `${row.kind}:${row.target}`));
}

async function logRun(
  store: TournamentStore,
  run: { started: string; mode: string; status: string; error?: string; summary?: unknown },
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
      .prepare("INSERT INTO fiba_sync_entries(run_id,kind,id,action,reason) VALUES(?,?,?,?,?)")
      .run(row.id, entry.kind, entry.id, entry.action, entry.reason);
  }
  return row.id;
}

/**
 * FIBA → local database. All pages are fetched and validated before anything is written,
 * so a structural change aborts the run (fail closed). Writes happen in one transaction
 * together with the sync log, through the same `write` path (and audit trail) the admin uses.
 */
export async function runSync(
  store: TournamentStore,
  options: { apply: boolean; fetchImpl?: FetchLike; plan?: PlanOptions } = { apply: true },
): Promise<SyncResult> {
  const started = new Date().toISOString();
  const mode = options.apply ? "apply" : "dry-run";
  if (options.apply) await store.db.exec(logSchema);
  try {
    const eventPage = parseEventPage((await fetchFibaPage("games", options.fetchImpl)).html);
    const standings = parseStandingsPage((await fetchFibaPage("standings", options.fetchImpl)).html);
    const leaders = probeLeadersPage((await fetchFibaPage("leaders", options.fetchImpl)).html);

    const plan = await store.db.transaction(async () => {
      const state = {
        settings: settingsSchema.parse(await store.get("settings", "tournament")),
        teams: (await store.list<Team>("teams")).map((team) => teamSchema.parse(team)),
        games: (await store.list<Game>("games")).map((game) => gameSchema.parse(game)),
        overridden: await manualOverrides(store),
      };
      const built = buildPlan(eventPage, standings, state, options.plan);
      if (!options.apply) return built;
      // Teams first: games reference them.
      const ordered = [...built.entries].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "teams" ? -1 : 1));
      for (const entry of ordered) {
        if ((entry.action === "create" || entry.action === "update") && entry.value) {
          await store.write(entry.kind, entry.id, entry.value, SYNC_ACTOR, `fiba-${entry.action}`);
        }
      }
      return built;
    }, options.apply ? "write" : "read")();

    const counts = countActions(plan.entries);
    const runId = options.apply
      ? await store.db.transaction(() =>
          logRun(
            store,
            { started, mode, status: "ok", summary: { counts, notes: plan.notes, playerRecordsSeen: leaders.playerRecords } },
            plan.entries,
          ),
        )()
      : null;
    return { mode, runId, plan, counts, stats: { playerRecordsSeen: leaders.playerRecords } };
  } catch (error) {
    if (options.apply) {
      await store.db
        .transaction(() =>
          logRun(
            store,
            { started, mode, status: "failed", error: error instanceof Error ? error.message : String(error) },
            [],
          ),
        )()
        .catch(() => undefined);
    }
    throw error;
  }
}

export function formatSyncResult(result: SyncResult): string {
  const lines = [
    `FIBA sync (${result.mode})${result.runId ? ` — run #${result.runId}` : " — nothing written"}`,
    ...Object.entries(result.counts).map(([key, value]) => `  ${key}: ${value}`),
    "",
    ...result.plan.entries.map((entry) => `  [${entry.action}] ${entry.kind}/${entry.id} — ${entry.reason}`),
    ...result.plan.notes.map((note) => `  note: ${note}`),
    `  player statistics records seen on FIBA: ${result.stats.playerRecordsSeen}`,
  ];
  return lines.join("\n");
}
