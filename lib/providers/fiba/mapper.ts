import { gameSchema, teamSchema, type Game, type Team } from "../../domain";
import registry from "../../team-identity.json";
import type { FibaEventData, FibaGame, FibaStandingsData, FibaTeam } from "./parser";

type LocalTeam = (typeof registry.teams)[number];

export type TeamMatch = {
  fiba: FibaTeam;
  local: LocalTeam | null;
  /** Mapped, schema-validated team (only when a local identity matched). */
  mapped: Team | null;
};
export type GameOutcome =
  | { fiba: FibaGame; game: Game }
  | { fiba: FibaGame; game: null; reason: string };

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Match by slug/id first, then exact normalised name. Never guesses further. */
export function matchLocalTeam(team: FibaTeam): LocalTeam | null {
  const bySlug = registry.teams.find(
    (local) => local.id === team.slug || local.slug === team.slug,
  );
  if (bySlug) return bySlug;
  const name = normalise(team.officialName);
  return registry.teams.find((local) => normalise(local.officialName) === name) ?? null;
}

export function mapTeams(teams: FibaTeam[]): TeamMatch[] {
  return teams.map((fiba) => {
    const local = matchLocalTeam(fiba);
    if (!local) return { fiba, local: null, mapped: null };
    return {
      fiba,
      local,
      mapped: teamSchema.parse({
        id: local.id,
        name: fiba.officialName,
        country: local.country,
        group: local.group,
        verified: false,
      }),
    };
  });
}

const PLACEHOLDER_DATE = /^0001-/;

function statusFor(game: FibaGame): Game["status"] | null {
  if (game.isPostponed) return "Postponed";
  if (game.isLive) return "Live";
  if (game.statusCode === "INIT") return "Scheduled";
  return null; // Unknown FIBA status codes are reported, never guessed.
}

export function mapGames(games: FibaGame[], teams: TeamMatch[]): GameOutcome[] {
  const byFibaId = new Map(teams.map((match) => [match.fiba.teamId, match]));
  return games.map((fiba): GameOutcome => {
    const reject = (reason: string): GameOutcome => ({ fiba, game: null, reason });
    const home = byFibaId.get(fiba.teamA.teamId)?.mapped;
    const away = byFibaId.get(fiba.teamB.teamId)?.mapped;
    if (!home || !away) return reject("teams are not in the local registry");
    if (!fiba.hasTimeGameDateTime || PLACEHOLDER_DATE.test(fiba.gameDateTimeUTC)) {
      return reject("no date/time published yet");
    }
    const status = statusFor(fiba);
    if (!status) return reject(`unmapped FIBA status "${fiba.statusCode}"`);
    const parsed = gameSchema.safeParse({
      id: `fiba-${fiba.gameId}`,
      home: home.id,
      away: away.id,
      group: home.group,
      date: fiba.gameDateTimeUTC.endsWith("Z")
        ? fiba.gameDateTimeUTC
        : `${fiba.gameDateTimeUTC}Z`,
      venue: fiba.venueName ?? "",
      status,
      homeScore: fiba.teamAScore,
      awayScore: fiba.teamBScore,
    });
    return parsed.success
      ? { fiba, game: parsed.data }
      : reject(`failed schema validation: ${parsed.error.issues[0]?.message}`);
  });
}

export type StandingGroupReport = {
  stage: string;
  group: string;
  rows: number;
  /** Local team ids resolved from FIBA team ids, in FIBA rank order. */
  teams: string[];
  /** FIBA slots with no team assigned yet, or a team the local registry lacks. */
  unresolved: string[];
  /** Local registry disagrees with FIBA about which group a team is in. */
  groupMismatches: string[];
  gamesPlayed: number;
};

/** Read-only comparison of FIBA group tables with the local registry. No schema exists for FIBA tables; nothing is stored. */
export function mapStandings(
  standings: FibaStandingsData,
  teams: TeamMatch[],
): StandingGroupReport[] {
  const byFibaId = new Map(teams.map((match) => [match.fiba.teamId, match]));
  return standings.stages.flatMap((stage) =>
    stage.groups.map((group) => {
      const resolved: string[] = [];
      const unresolved: string[] = [];
      const groupMismatches: string[] = [];
      for (const row of group.teamsStats) {
        const match = typeof row.team === "number" ? byFibaId.get(row.team) : undefined;
        if (!match) {
          unresolved.push(
            typeof row.team === "number"
              ? `rank ${row.rank}: FIBA team ${row.team} not on team list`
              : `rank ${row.rank}: slot not assigned by FIBA`,
          );
        } else if (!match.local) {
          unresolved.push(`rank ${row.rank}: ${match.fiba.slug} not in local registry`);
        } else {
          resolved.push(match.local.id);
          if (match.local.group !== group.groupName) {
            groupMismatches.push(
              `${match.local.id}: local group ${match.local.group}, FIBA group ${group.groupName}`,
            );
          }
        }
      }
      return {
        stage: stage.stage,
        group: group.groupName,
        rows: group.teamsStats.length,
        teams: resolved,
        unresolved,
        groupMismatches,
        gamesPlayed: group.teamsStats.reduce((sum, row) => sum + row.gamesPlayed, 0),
      };
    }),
  );
}

export function mapEvent(data: FibaEventData) {
  const teams = mapTeams(data.teams);
  return { teams, games: mapGames(data.games, teams) };
}
