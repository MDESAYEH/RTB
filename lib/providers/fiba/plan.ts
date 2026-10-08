import { gameSchema, teamSchema, type Game, type Settings, type Team } from "../../domain";
import registry from "../../team-identity.json";
import { fibaApprovedNewTeams, fibaTeamAliases } from "./aliases";
import type { FibaEventData, FibaGame, FibaStandingsData, FibaTeam } from "./parser";

/** The stage whose group tables are this tournament's groups (Tripoli = Division West group phase). */
export const FIBA_SCOPE_STAGE = "DW-GP";
/** Record owners that are not human edits. Anything else in the audit trail is a manual override. */
export const SYSTEM_ACTORS = ["seed", "fiba-sync", "import", "system"] as const;

export type PlanAction = "create" | "update" | "unchanged" | "ignored" | "skipped";
export type PlanEntry = {
  kind: "teams" | "games";
  id: string;
  action: PlanAction;
  reason: string;
  /** Present for create/update: the validated record to store. */
  value?: Team | Game;
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
  aliases?: Record<string, string>;
  approvedNewTeams?: string[];
  now?: string;
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
  const now = options.now ?? new Date().toISOString();
  const entries: PlanEntry[] = [];
  const notes: string[] = [];

  const stage = standings.stages.find((candidate) => candidate.code === FIBA_SCOPE_STAGE);
  if (!stage) {
    throw new Error(`FIBA standings no longer contain stage ${FIBA_SCOPE_STAGE}; refusing to sync`);
  }
  const wanted = new Set(state.settings.groups);
  const groups = stage.groups.filter((group) => wanted.has(group.groupName));
  for (const letter of wanted) {
    if (!groups.some((group) => group.groupName === letter)) {
      notes.push(`Group ${letter} is configured locally but not published by FIBA.`);
    }
  }
  for (const group of stage.groups) {
    if (!wanted.has(group.groupName)) {
      notes.push(`FIBA group ${group.groupName} is outside the local tournament groups and was not imported.`);
    }
  }

  const fibaTeams = new Map(event.teams.map((team) => [team.teamId, team]));
  const localById = new Map(state.teams.map((team) => [team.id, team]));
  const resolveLocal = (team: FibaTeam): string | null => {
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

  // Teams and groups: team membership of each group comes from FIBA's group tables.
  const scoped = new Map<number, { localId: string; group: string }>();
  for (const group of groups) {
    for (const row of group.teamsStats) {
      if (typeof row.team !== "number") {
        notes.push(`Group ${group.groupName} rank ${row.rank}: slot not assigned by FIBA yet.`);
        continue;
      }
      const fiba = fibaTeams.get(row.team);
      if (!fiba) {
        notes.push(`Group ${group.groupName}: FIBA team ${row.team} is not on the team list; skipped.`);
        continue;
      }
      let localId = resolveLocal(fiba);
      if (!localId) {
        if (approvedNew.has(fiba.slug)) {
          localId = fiba.slug;
        } else {
          entries.push({
            kind: "teams",
            id: fiba.slug,
            action: "skipped",
            reason: "no reviewed match in the local registry; add an alias or approve as new team",
          });
          continue;
        }
      }
      scoped.set(row.team, { localId, group: group.groupName });
      const existing = localById.get(localId);
      const proposed = teamSchema.parse({
        id: localId,
        name: fiba.officialName,
        country: existing?.country ?? "",
        group: group.groupName,
        verified: existing ? existing.verified : true,
        ...(existing?.logo ? { logo: existing.logo } : {}),
      });
      if (!existing) {
        entries.push({ kind: "teams", id: localId, action: "create", reason: "new team approved by review", value: proposed });
      } else if (state.overridden.has(`teams:${localId}`)) {
        entries.push({ kind: "teams", id: localId, action: "ignored", reason: "manual override" });
      } else if (existing.name === proposed.name && existing.group === proposed.group) {
        entries.push({ kind: "teams", id: localId, action: "unchanged", reason: "matches FIBA" });
      } else {
        entries.push({
          kind: "teams",
          id: localId,
          action: "update",
          reason: [
            existing.name !== proposed.name ? `name "${existing.name}" → "${proposed.name}"` : "",
            existing.group !== proposed.group ? `group ${existing.group} → ${proposed.group}` : "",
          ]
            .filter(Boolean)
            .join("; "),
          value: proposed,
        });
      }
    }
  }

  // Games: only complete, published facts between two in-scope teams of the same group.
  const gamesById = new Map(state.games.map((game) => [game.id, game]));
  const seen = new Set<string>();
  for (const fiba of event.games) {
    const id = `fiba-${fiba.gameId}`;
    seen.add(id);
    const home = scoped.get(fiba.teamA.teamId);
    const away = scoped.get(fiba.teamB.teamId);
    const skip = (reason: string) => entries.push({ kind: "games", id, action: "skipped", reason });
    if (!home || !away) {
      skip("teams are not both in the imported groups");
      continue;
    }
    if (home.group !== away.group) {
      skip("teams belong to different groups");
      continue;
    }
    if (!fiba.hasTimeGameDateTime || PLACEHOLDER_DATE.test(fiba.gameDateTimeUTC)) {
      skip("no date/time published yet");
      continue;
    }
    const status = gameStatus(fiba);
    if (!status) {
      skip(`unrecognised FIBA status "${fiba.statusCode}"; not guessed`);
      continue;
    }
    const date = fiba.gameDateTimeUTC.endsWith("Z") ? fiba.gameDateTimeUTC : `${fiba.gameDateTimeUTC}Z`;
    const existing = gamesById.get(id);
    if (state.overridden.has(`games:${id}`)) {
      entries.push({ kind: "games", id, action: "ignored", reason: "manual override" });
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
    };
    if (!existing) {
      const parsed = gameSchema.safeParse({ id, ...published, venue: fiba.venueName ?? "" });
      if (!parsed.success) skip(`failed schema validation: ${parsed.error.issues[0]?.message}`);
      else entries.push({ kind: "games", id, action: "create", reason: "published by FIBA", value: parsed.data });
      continue;
    }
    // Update only what FIBA publishes. Clock, period and running state stay under local control.
    const merged = {
      ...existing,
      ...published,
      venue: fiba.venueName ? fiba.venueName : existing.venue,
    };
    const changed = (Object.keys(merged) as (keyof Game)[]).filter(
      (key) => JSON.stringify(merged[key]) !== JSON.stringify(existing[key]),
    );
    if (changed.length === 0) {
      entries.push({ kind: "games", id, action: "unchanged", reason: "matches FIBA" });
      continue;
    }
    const parsed = gameSchema.safeParse({ ...merged, version: existing.version + 1, updatedAt: now });
    if (!parsed.success) skip(`failed schema validation: ${parsed.error.issues[0]?.message}`);
    else entries.push({ kind: "games", id, action: "update", reason: `changed: ${changed.join(", ")}`, value: parsed.data });
  }
  for (const game of state.games) {
    if (game.id.startsWith("fiba-") && !seen.has(game.id)) {
      notes.push(`${game.id} is stored locally but no longer published by FIBA; left untouched.`);
    }
  }
  return { entries, notes };
}
