import registry from "../../team-identity.json";
import { fetchFibaPage, fibaPageUrl, type FetchLike } from "./client";
import { mapEvent } from "./mapper";
import { parseEventPage } from "./parser";

export type DryRunReport = {
  source: string;
  event: { name: string; code: string; start: string; end: string; phase: string | null };
  counts: { teamsFound: number; gamesFound: number; standingsFound: 0; statsFound: 0 };
  teams: {
    matched: string[];
    /** On FIBA's page but not in the local registry (other divisions are expected here). */
    added: string[];
    /** Same team, FIBA spells the name differently from the local registry. */
    changed: { id: string; local: string; fiba: string }[];
    /** In the local registry but absent from the FIBA page. */
    missing: string[];
  };
  games: {
    mappable: string[];
    unmapped: { id: string; reason: string }[];
  };
  notes: string[];
};

/** Dry run only: reads FIBA, compares against the static registry, writes nothing anywhere. */
export async function runDryRun(fetchImpl?: FetchLike): Promise<DryRunReport> {
  const { url, html } = await fetchFibaPage("games", fetchImpl);
  const data = parseEventPage(html);
  const { teams, games } = mapEvent(data);

  const matchedIds = new Set<string>();
  const report: DryRunReport = {
    source: url,
    event: {
      name: data.competition.officialName,
      code: data.competition.competitionCode,
      start: data.competition.start,
      end: data.competition.end,
      phase: data.currentPhase,
    },
    counts: {
      teamsFound: data.teams.length,
      gamesFound: data.games.length,
      standingsFound: 0,
      statsFound: 0,
    },
    teams: { matched: [], added: [], changed: [], missing: [] },
    games: { mappable: [], unmapped: [] },
    notes: [
      "Phase 1 never opens the database; manual admin data is untouched.",
      "Standings and stats pages are not read in phase 1 (no verified payload shape yet).",
      `Local registry teams: ${registry.teams.length}. Local games are not loaded, so mappable games are candidates only.`,
    ],
  };

  for (const match of teams) {
    if (!match.local) {
      report.teams.added.push(`${match.fiba.slug} (${match.fiba.officialName})`);
      continue;
    }
    matchedIds.add(match.local.id);
    report.teams.matched.push(match.local.id);
    if (match.local.officialName !== match.fiba.officialName) {
      report.teams.changed.push({
        id: match.local.id,
        local: match.local.officialName,
        fiba: match.fiba.officialName,
      });
    }
  }
  report.teams.missing = registry.teams
    .filter((team) => !matchedIds.has(team.id))
    .map((team) => team.id);

  for (const outcome of games) {
    if (outcome.game) report.games.mappable.push(outcome.game.id);
    else report.games.unmapped.push({ id: `fiba-${outcome.fiba.gameId}`, reason: outcome.reason });
  }
  return report;
}

export function formatReport(report: DryRunReport): string {
  const list = (items: string[]) => (items.length ? items.join(", ") : "none");
  return [
    `FIBA dry run (no writes) — ${report.source}`,
    `Event: ${report.event.name} [${report.event.code}] ${report.event.start} → ${report.event.end}, phase ${report.event.phase ?? "unknown"}`,
    "",
    `teams found: ${report.counts.teamsFound}`,
    `games found: ${report.counts.gamesFound}`,
    `standings found: ${report.counts.standingsFound}`,
    `stats found: ${report.counts.statsFound}`,
    "",
    `teams matched to local registry (${report.teams.matched.length}): ${list(report.teams.matched)}`,
    `teams added (on FIBA, not local) (${report.teams.added.length}): ${list(report.teams.added)}`,
    `teams changed (${report.teams.changed.length}): ${report.teams.changed.length ? report.teams.changed.map((c) => `${c.id}: "${c.local}" → "${c.fiba}"`).join("; ") : "none"}`,
    `teams missing (local, not on FIBA page) (${report.teams.missing.length}): ${list(report.teams.missing)}`,
    "",
    `games mappable (${report.games.mappable.length}): ${list(report.games.mappable)}`,
    `games unmapped (${report.games.unmapped.length}): ${report.games.unmapped.length ? report.games.unmapped.map((g) => `${g.id} — ${g.reason}`).join("; ") : "none"}`,
    "",
    ...report.notes.map((note) => `note: ${note}`),
  ].join("\n");
}

export { fibaPageUrl };
