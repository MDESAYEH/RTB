import type { Game } from "./domain";

export type PlayerStat = {
  id: string;
  game: string;
  player: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  efficiency: number;
};

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

/**
 * Player lines taken from each match's official box score (what FIBA's live feed reported), so the statistics
 * page fills itself as matches are played. FIBA lists a player as `P_<person id>`; our roster uses
 * `fiba-player-<person id>`. A line the organisers entered by hand for the same match and player wins.
 */
export function derivedPlayerStats(
  games: Pick<Game, "id" | "officialDetails">[],
  stored: { game: string; player: string }[] = [],
): PlayerStat[] {
  const manual = new Set(stored.map((s) => `${s.game}|${s.player}`));
  const out: PlayerStat[] = [];
  for (const game of games) {
    for (const team of game.officialDetails?.teams ?? []) {
      for (const p of team.players) {
        const personId = p.id.match(/^P_(\d+)$/)?.[1];
        if (!personId) continue;
        const player = `fiba-player-${personId}`;
        if (manual.has(`${game.id}|${player}`)) continue;
        // A player who did not take the court has every number at zero; one who played has at least a shot, a foul or a rebound.
        if (!Object.values(p.stats).some((v) => v !== 0)) continue;
        out.push({
          id: `fiba-stat-${game.id}-${personId}`,
          game: game.id,
          player,
          points: count(p.stats.PTS),
          rebounds: count(p.stats.REB),
          assists: count(p.stats.AS),
          steals: count(p.stats.ST),
          blocks: count(p.stats.BS),
          efficiency: typeof p.stats.EFF === "number" ? p.stats.EFF : 0,
        });
      }
    }
  }
  return out;
}
