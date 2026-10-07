import type { Team, Game, Settings } from "./domain";
export type { Team, Game, Settings, News } from "./domain";
export const transitions: Record<Game["status"], Game["status"][]> = {
  Scheduled: ["Warmup", "Postponed", "Cancelled"],
  Warmup: ["Live", "Postponed", "Cancelled"],
  Live: ["Halftime", "Ended", "Postponed"],
  Halftime: ["Live", "Postponed"],
  Ended: [],
  Postponed: ["Scheduled"],
  Cancelled: [],
};
export function stale(g: Game, now = Date.now()) {
  return (
    ["Live", "Halftime"].includes(g.status) &&
    now - Date.parse(g.updatedAt) > 45000
  );
}
export function remainingClock(g: Game, now = Date.now()) {
  return Math.max(
    0,
    g.clock -
      (g.running && Number.isFinite(Date.parse(g.updatedAt))
        ? Math.max(0, Math.floor((now - Date.parse(g.updatedAt)) / 1000))
        : 0),
  );
}
export function standings(
  teams: Team[],
  games: Game[],
  settings: Pick<Settings, "winPoints" | "lossPoints">,
) {
  const rows = teams.map((team) => ({
    team,
    p: 0,
    w: 0,
    l: 0,
    pf: 0,
    pa: 0,
    pts: 0,
    diff: 0,
    tied: false,
  }));
  for (const g of games.filter((g) => g.status === "Ended")) {
    for (const r of rows) {
      if (r.team.id !== g.home && r.team.id !== g.away) continue;
      const h = r.team.id === g.home;
      const pf = h ? g.homeScore : g.awayScore,
        pa = h ? g.awayScore : g.homeScore;
      r.p++;
      r.pf += pf;
      r.pa += pa;
      r.w += Number(pf > pa);
      r.l += Number(pf < pa);
      r.pts += pf > pa ? settings.winPoints : settings.lossPoints;
      r.diff = r.pf - r.pa;
    }
  }
  rows.sort((a, b) => b.pts - a.pts || a.team.name.localeCompare(b.team.name));
  for (const r of rows) r.tied = rows.some((s) => s !== r && s.pts === r.pts);
  return rows;
}
// Conservative bounds: never resolve a points tie with an unverified tiebreaker.
export function qualification(
  team: Team,
  teams: Team[],
  games: Game[],
  s: Settings,
) {
  if (!s.rulesConfirmed) return "IN_CONTENTION";
  const group = teams.filter((t) => t.group === team.group);
  const groupGames = games.filter(
    (g) =>
      g.group === team.group && !["Cancelled", "Postponed"].includes(g.status),
  );
  const expected = (group.length * (group.length - 1)) / 2;
  const members = new Set(group.map((t) => t.id));
  if (
    !members.has(team.id) ||
    groupGames.some(
      (g) => g.home === g.away || !members.has(g.home) || !members.has(g.away),
    )
  )
    return "IN_CONTENTION";
  const pairs = new Set(
    groupGames.map((g) => [g.home, g.away].sort().join(":")),
  );
  if (pairs.size !== expected || groupGames.length !== expected)
    return "IN_CONTENTION";
  const rows = standings(group, groupGames, s);
  const bounds = rows.map((r) => ({
    ...r,
    min:
      r.pts +
      groupGames.filter(
        (g) =>
          g.status !== "Ended" &&
          (g.home === r.team.id || g.away === r.team.id),
      ).length *
        s.lossPoints,
    max:
      r.pts +
      groupGames.filter(
        (g) =>
          g.status !== "Ended" &&
          (g.home === r.team.id || g.away === r.team.id),
      ).length *
        s.winPoints,
  }));
  const own = bounds.find((r) => r.team.id === team.id)!;
  if (
    bounds.filter((r) => r !== own && r.max >= own.min).length <
    s.qualificationSlots
  )
    return "QUALIFIED";
  if (
    bounds.filter((r) => r !== own && r.min > own.max).length >=
    s.qualificationSlots
  )
    return "ELIMINATED";
  return "IN_CONTENTION";
}

