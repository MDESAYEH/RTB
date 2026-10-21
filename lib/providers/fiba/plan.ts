import {
  gameSchema,
  teamSchema,
  type Game,
  type Player,
  type Settings,
  type Team,
  type News,
} from "../../domain";
import registry from "../../team-identity.json";
import {
  localGroups as defaultLocalGroups,
  withdrawnTeams as defaultWithdrawn,
} from "./groups";
import {
  fibaApprovedNewTeams,
  fibaConfirmedSpellings,
  fibaTeamAliases,
} from "./aliases";
import type {
  FibaEventData,
  FibaGame,
  FibaStandingsData,
  FibaTeam,
} from "./parser";

/** The stage whose group tables are this tournament's groups (Tripoli = Division West group phase). */
export const FIBA_SCOPE_STAGE = "DW-GP";
/** Record owners that are not human edits. Anything else in the audit trail is a manual override. */
export const SYSTEM_ACTORS = [
  "seed",
  "fiba-sync",
  "import",
  "system",
  "verified-research-import",
] as const;
/** Scripted source reviews are tooling, not a supervisor's decision (e.g. `source-review:FIBA-fr-2026-10-05`). */
export const SYSTEM_ACTOR_PREFIXES = ["source-review:"] as const;

export type PlanAction =
  | "create"
  | "update"
  | "unchanged"
  | "ignored"
  | "remove"
  | "skipped";
export type PlanEntry = {
  kind: "teams" | "games" | "news" | "players";
  id: string;
  action: PlanAction;
  reason: string;
  /** Present for create/update: the validated record to store. */
  value?: Team | Game | News | Player;
};
export type SyncPlan = {
  entries: PlanEntry[];
  /** FIBA-published facts that do not map to anything we may write. */
  notes: string[];
};
export type PlanState = {
  settings: Pick<Settings, "groups">;
  teams: Team[];
  games: Game[];
  /** `kind:id` of records a human has edited. FIBA never overwrites these. */
  overridden: Set<string>;
};
export type PlanOptions = {
  authoritative?: boolean;
  /**
   * Keep every team in the group the local registry assigns it (5 / 5). FIBA still updates names, logos,
   * fixtures, results and news, but never moves a team between groups or creates teams. On unless
   * FIBA_FOLLOW_GROUPS=1 or the caller passes false.
   */
  lockGroups?: boolean;
  /** Team id to group letter. Defaults to the reviewed local draw in ./groups. */
  groups?: Record<string, string>;
  /** Local team ids that withdrew; their records are removed. Defaults to the reviewed list in ./groups. */
  withdrawnTeams?: string[];
  aliases?: Record<string, string>;
  approvedNewTeams?: string[];
  confirmedSpellings?: string[];
  now?: string;
  liveGames?: Map<number, Partial<Game>>;
  failedLiveGames?: Set<number>;
};

const FIBA_STATUS: Record<string, Game["status"]> = { INIT: "Scheduled" };
const PLACEHOLDER_DATE = /^0001-/;

function gameStatus(game: FibaGame): Game["status"] | null {
  if (game.isPostponed) return "Postponed";
  if (game.isLive) return "Live";
  return FIBA_STATUS[game.statusCode] ?? null;
}

/**
 * Pure planning step: decides, from what FIBA publishes and what we hold, what would change.
 * It never invents a value; anything unpublished or unrecognised is skipped with a reason.
 */
export function buildPlan(
  event: FibaEventData,
  standings: FibaStandingsData,
  state: PlanState,
  options: PlanOptions = {},
): SyncPlan {
  const aliases = options.aliases ?? fibaTeamAliases;
  const approvedNew = new Set(options.approvedNewTeams ?? fibaApprovedNewTeams);
  const confirmed = new Set(
    options.confirmedSpellings ?? fibaConfirmedSpellings,
  );
  const now = options.now ?? new Date().toISOString();
  const entries: PlanEntry[] = [];
  const notes: string[] = [];

  const stage = standings.stages.find(
    (candidate) => candidate.code === FIBA_SCOPE_STAGE,
  );
  if (!stage) {
    throw new Error(
      `FIBA standings no longer contain stage ${FIBA_SCOPE_STAGE}; refusing to sync`,
    );
  }
  const lock = options.lockGroups ?? process.env.FIBA_FOLLOW_GROUPS !== "1";
  const fixedGroup = new Map(
    Object.entries(options.groups ?? defaultLocalGroups),
  );
  const withdrawn = new Set(options.withdrawnTeams ?? defaultWithdrawn);
  const wanted = new Set(state.settings.groups);
  const groups = stage.groups.filter((group) => wanted.has(group.groupName));
  if (lock) {
    notes.push(
      "Group membership is fixed locally; FIBA group tables are not used to place teams.",
    );
  } else {
    for (const letter of wanted) {
      if (!groups.some((group) => group.groupName === letter)) {
        notes.push(
          `Group ${letter} is configured locally but not published by FIBA.`,
        );
      }
    }
    for (const group of stage.groups) {
      if (!wanted.has(group.groupName)) {
        notes.push(
          `FIBA group ${group.groupName} is outside the local tournament groups and was not imported.`,
        );
      }
    }
  }

  const fibaTeams = new Map(event.teams.map((team) => [team.teamId, team]));
  const localById = new Map(state.teams.map((team) => [team.id, team]));
  const resolveLocal = (team: FibaTeam): string | null => {
    const linked = state.teams.find((t) => t.fibaTeamId === team.teamId);
    if (linked) return linked.id;
    const alias = aliases[team.slug];
    if (alias) return localById.has(alias) ? alias : null;
    if (localById.has(team.slug)) return team.slug;
    const name = team.officialName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const known = registry.teams.find(
      (local) =>
        local.id === team.slug ||
        local.slug === team.slug ||
        local.officialName.toLowerCase().replace(/[^a-z0-9]/g, "") === name,
    );
    return known && localById.has(known.id) ? known.id : null;
  };

  // Teams: each FIBA team is matched to a local team, then its details are refreshed.
  const scoped = new Map<number, { localId: string; group: string }>();
  const handleTeam = (fiba: FibaTeam, fibaGroup: string) => {
    let localId = resolveLocal(fiba);
    // A reviewed withdrawal: never refreshed, never moved; it is removed below.
    if (localId && withdrawn.has(localId)) return;
    if (!localId && lock) return;
    if (!localId) {
      if (options.authoritative || approvedNew.has(fiba.slug)) {
        localId = fiba.slug;
      } else {
        entries.push({
          kind: "teams",
          id: fiba.slug,
          action: "skipped",
          reason:
            "no reviewed match in the local registry; add an alias or approve as new team",
        });
        return;
      }
    }
    const existing = localById.get(localId);
    // Locked: the registry decides the group; FIBA only refreshes the other details.
    const groupName = lock
      ? (fixedGroup.get(localId) ?? existing?.group ?? fibaGroup)
      : fibaGroup;
    scoped.set(fiba.teamId, { localId, group: groupName });
    const proposed = teamSchema.parse({
      id: localId,
      name: fiba.officialName,
      country: fiba.countryName ?? existing?.country ?? "",
      group: groupName,
      verified:
        options.authoritative ||
        (existing ? existing.verified || confirmed.has(localId) : true),
      ...(options.authoritative ? { fibaTeamId: fiba.teamId } : {}),
      ...(fiba.sourceLogo
        ? { sourceLogo: fiba.sourceLogo }
        : existing?.sourceLogo
          ? { sourceLogo: existing.sourceLogo }
          : {}),
      ...(existing?.logo ? { logo: existing.logo } : {}),
    });
    if (!existing) {
      entries.push({
        kind: "teams",
        id: localId,
        action: "create",
        reason: "new team approved by review",
        value: proposed,
      });
    } else if (
      !options.authoritative &&
      state.overridden.has(`teams:${localId}`)
    ) {
      entries.push({
        kind: "teams",
        id: localId,
        action: "ignored",
        reason: "manual override",
      });
    } else if (
      existing.name === proposed.name &&
      existing.group === proposed.group &&
      existing.verified === proposed.verified &&
      existing.country === proposed.country &&
      existing.sourceLogo === proposed.sourceLogo &&
      existing.fibaTeamId === proposed.fibaTeamId
    ) {
      entries.push({
        kind: "teams",
        id: localId,
        action: "unchanged",
        reason: "matches FIBA",
      });
    } else {
      entries.push({
        kind: "teams",
        id: localId,
        action: "update",
        reason: [
          existing.name !== proposed.name
            ? `name "${existing.name}" → "${proposed.name}"`
            : "",
          existing.group !== proposed.group
            ? `group ${existing.group} → ${proposed.group}`
            : "",
          existing.verified !== proposed.verified ? "spelling confirmed" : "",
          existing.country !== proposed.country
            ? "official country corrected"
            : "",
          existing.sourceLogo !== proposed.sourceLogo
            ? "official logo corrected"
            : "",
          existing.fibaTeamId !== proposed.fibaTeamId
            ? "linked to official FIBA identity"
            : "",
        ]
          .filter(Boolean)
          .join("; "),
        value: proposed,
      });
    }
  };
  if (lock) {
    // Placement never depends on FIBA's group tables: every FIBA team that matches a local team is used.
    for (const fiba of event.teams) handleTeam(fiba, "");
    for (const local of state.teams) {
      if (
        !withdrawn.has(local.id) &&
        ![...scoped.values()].some((v) => v.localId === local.id)
      )
        notes.push(`Local team ${local.id} is not linked to a FIBA team yet.`);
    }
  } else {
    for (const group of groups) {
      for (const row of group.teamsStats) {
        if (typeof row.team !== "number") {
          notes.push(
            `Group ${group.groupName} rank ${row.rank}: slot not assigned by FIBA yet.`,
          );
          continue;
        }
        const fiba = fibaTeams.get(row.team);
        if (!fiba) {
          notes.push(
            `Group ${group.groupName}: FIBA team ${row.team} is not on the team list; skipped.`,
          );
          continue;
        }
        handleTeam(fiba, group.groupName);
      }
    }
  }

  // Withdrawn clubs: their fixtures go first (only if nothing was played), then the team itself.
  for (const game of state.games) {
    if (!withdrawn.has(game.home) && !withdrawn.has(game.away)) continue;
    const untouched =
      game.status === "Scheduled" &&
      game.homeScore === 0 &&
      game.awayScore === 0 &&
      game.periods.length === 0;
    if (untouched)
      entries.push({
        kind: "games",
        id: game.id,
        action: "remove",
        reason: "a participating club withdrew",
      });
    else
      notes.push(
        `${game.id} involves a withdrawn club but has already started; left for manual review.`,
      );
  }
  for (const team of state.teams) {
    if (withdrawn.has(team.id))
      entries.push({
        kind: "teams",
        id: team.id,
        action: "remove",
        reason: "withdrew from the tournament (reviewed)",
      });
  }

  // Games: only complete, published facts between two in-scope teams of the same group.
  const gamesById = new Map(state.games.map((game) => [game.id, game]));
  const seen = new Set<string>();
  for (const fiba of event.games) {
    const id = `fiba-${fiba.gameId}`;
    seen.add(id);
    const skip = (reason: string) =>
      entries.push({ kind: "games", id, action: "skipped", reason });
    if (!fiba.teamA || !fiba.teamB) {
      skip("opponent not decided yet");
      continue;
    }
    const home = scoped.get(fiba.teamA.teamId);
    const away = scoped.get(fiba.teamB.teamId);
    if (!home || !away) {
      skip("teams are not both in the imported groups");
      continue;
    }
    if (home.group !== away.group) {
      skip("teams belong to different groups");
      continue;
    }
    if (
      !fiba.hasTimeGameDateTime ||
      PLACEHOLDER_DATE.test(fiba.gameDateTimeUTC)
    ) {
      skip("no date/time published yet");
      continue;
    }
    const status =
      options.liveGames?.get(fiba.gameId)?.status ?? gameStatus(fiba);
    if (!status) {
      skip(`unrecognised FIBA status "${fiba.statusCode}"; not guessed`);
      continue;
    }
    const date = fiba.gameDateTimeUTC.endsWith("Z")
      ? fiba.gameDateTimeUTC
      : `${fiba.gameDateTimeUTC}Z`;
    const existing =
      gamesById.get(id) ??
      (options.authoritative
        ? state.games.find(
            (g) =>
              !g.id.startsWith("fiba-") &&
              ((g.home === home.localId && g.away === away.localId) ||
                (g.home === away.localId && g.away === home.localId)),
          )
        : undefined);
    if (!options.authoritative && state.overridden.has(`games:${id}`)) {
      entries.push({
        kind: "games",
        id,
        action: "ignored",
        reason: "manual override",
      });
      continue;
    }
    if (options.failedLiveGames?.has(fiba.gameId)) {
      skip("individual live source unavailable; last confirmed match retained");
      continue;
    }
    const published = {
      home: home.localId,
      away: away.localId,
      group: home.group,
      date,
      status,
      homeScore: fiba.teamAScore,
      awayScore: fiba.teamBScore,
      ...options.liveGames?.get(fiba.gameId),
    };
    if (!existing) {
      // A fixture an admin already entered by hand keeps priority; importing it again would duplicate it.
      const manual = state.games.find(
        (game) =>
          !game.id.startsWith("fiba-") &&
          ((game.home === published.home && game.away === published.away) ||
            (game.home === published.away && game.away === published.home)),
      );
      if (manual) {
        skip(
          `same fixture already exists locally as ${manual.id}; the manual record takes priority`,
        );
        continue;
      }
      const parsed = gameSchema.safeParse({
        id,
        ...published,
        venue: fiba.venueName ?? "",
      });
      if (!parsed.success)
        skip(`failed schema validation: ${parsed.error.issues[0]?.message}`);
      else
        entries.push({
          kind: "games",
          id,
          action: "create",
          reason: "published by FIBA",
          value: parsed.data,
        });
      continue;
    }
    // Update only what FIBA publishes. Clock, period and running state stay under local control.
    // A game the organisers score by hand keeps its status and score; only the date and venue follow FIBA.
    const merged = existing.manual
      ? {
          ...existing,
          date: published.date,
          venue: fiba.venueName ? fiba.venueName : existing.venue,
        }
      : {
          ...existing,
          ...published,
          venue: fiba.venueName ? fiba.venueName : existing.venue,
        };
    const changed = (Object.keys(merged) as (keyof Game)[]).filter(
      (key) => JSON.stringify(merged[key]) !== JSON.stringify(existing[key]),
    );
    if (changed.length === 0) {
      entries.push({
        kind: "games",
        id,
        action: "unchanged",
        reason: existing.manual ? "scored by the organisers" : "matches FIBA",
      });
      continue;
    }
    const parsed = gameSchema.safeParse({
      ...merged,
      version: existing.version + 1,
      updatedAt: now,
    });
    if (!parsed.success)
      skip(`failed schema validation: ${parsed.error.issues[0]?.message}`);
    else
      entries.push({
        kind: "games",
        id: existing.id,
        action: "update",
        reason: `changed: ${changed.join(", ")}`,
        value: parsed.data,
      });
  }
  for (const game of state.games) {
    if (game.id.startsWith("fiba-") && !seen.has(game.id)) {
      notes.push(
        `${game.id} is stored locally but no longer published by FIBA; left untouched.`,
      );
    }
  }
  return { entries, notes };
}
