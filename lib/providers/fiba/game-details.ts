import { z } from "zod";
import { boundedBody } from "../../request";
import { officialDetailsSchema, type Game } from "../../domain";
import { extractPayload, jsonValuesFor, type FibaGame } from "./parser";
import { FIBA_EVENT_SLUG, type FetchLike } from "./client";

const stats = z.record(z.string(), z.unknown());
const competitor = z.object({
  Id: z.string(),
  Name: z.string(),
  Code: z.string(),
  Score: z.number().int().nonnegative(),
  Stats: stats,
  Children: z.array(
    z.object({
      Id: z.string(),
      Name: z.string(),
      JerseyNumber: z.string(),
      Stats: stats,
    }),
  ),
});
const liveSchema = z.object({
  game: z.object({
    content: z.object({
      id: z.number().int(),
      technicalName: z.string(),
      status: z.number().int(),
      RC: z.string().regex(/^\d{2}:\d{2}$/),
      CurrentPeriod: z.string().regex(/^(Q[1-4]|OT\d+)$/),
      CurrentPeriodStatus: z.string(),
      c: z.array(competitor).length(2),
      Stats: stats,
      quartersScores: z
        .array(
          z.object({
            period: z.string(),
            teamA: z.number().int().nonnegative(),
            teamB: z.number().int().nonnegative(),
          }),
        )
        .max(20),
      scoreList: z
        .array(
          z.object({
            period: z.string(),
            items: z.array(
              z.object({ Time: z.string(), SA: z.number(), SB: z.number() }),
            ),
          }),
        )
        .optional(),
    }),
  }),
});
export function periodNumber(period: string): number {
  return period.startsWith("OT")
    ? 4 + Number(period.slice(2))
    : Number(period.slice(1));
}
export function gamePageUrl(game: FibaGame) {
  if (!game.teamA?.code || !game.teamB?.code)
    throw Error("Missing FIBA team codes");
  return `https://www.fiba.basketball/en/events/${FIBA_EVENT_SLUG}/games/${game.gameId}-${encodeURIComponent(game.teamA.code)}-${encodeURIComponent(game.teamB.code)}`;
}
function scalarStats(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) =>
        (typeof v === "number" && Number.isFinite(v)) ||
        (typeof v === "string" && v.length <= 40),
    ),
  ) as Record<string, number | string>;
}
export function parseLiveGame(
  raw: unknown,
  expected: FibaGame,
  now: string,
): Partial<Game> {
  const g = liveSchema.parse(raw).game.content;
  if (
    g.id !== expected.gameId ||
    g.technicalName !== expected.gameName ||
    g.c[0].Code !== expected.teamA?.code ||
    g.c[1].Code !== expected.teamB?.code
  )
    throw Error("FIBA live game identity mismatch");
  const quarter = periodNumber(g.CurrentPeriod);
  const [minutes, seconds] = g.RC.split(":").map(Number);
  const clock = minutes * 60 + seconds;
  if (seconds > 59 || clock > (quarter > 4 ? 300 : 600) || quarter > 20)
    throw Error("Invalid FIBA game clock");
  // FIBA's public page maps 3=Running, 4=Unofficial, 5=Finished, 11/999=Validated.
  const status: Game["status"] | undefined = (
    {
      0: "Scheduled",
      1: "Scheduled",
      2: "Warmup",
      3: "Live",
      4: "Ended",
      5: "Ended",
      6: "Postponed",
      7: "Cancelled",
      9: "Postponed",
      11: "Ended",
      999: "Ended",
    } as Record<number, Game["status"]>
  )[g.status];
  if (!status) throw Error(`Unknown FIBA live status ${g.status}`);
  // FIBA can leave the public feed on status 3 (Running) after the final horn.
  // A non-tied fourth quarter or overtime at 00:00 is nevertheless final: basketball
  // cannot resume from it unless the game is tied and an overtime period is due.
  const endedAtFinalHorn =
    status === "Live" &&
    quarter >= 4 &&
    clock === 0 &&
    g.c[0].Score !== g.c[1].Score;
  const resolvedStatus = endedAtFinalHorn ? "Ended" : status;
  const periods = g.quartersScores
    .slice()
    .sort((a, b) => periodNumber(a.period) - periodNumber(b.period));
  if (
    periods.some((p, i) => periodNumber(p.period) !== i + 1) ||
    periods.reduce((s, p) => s + p.teamA, 0) !== g.c[0].Score ||
    periods.reduce((s, p) => s + p.teamB, 0) !== g.c[1].Score
  )
    throw Error("FIBA period scores do not match totals");
  return {
    status:
      resolvedStatus === "Live" &&
      quarter === 2 &&
      g.CurrentPeriodStatus === "N"
        ? "Halftime"
        : resolvedStatus,
    homeScore: g.c[0].Score,
    awayScore: g.c[1].Score,
    quarter,
    clock: resolvedStatus === "Ended" ? 0 : clock,
    // Snapshot clock: never invent a running clock while FIBA may have stopped play.
    running: false,
    updatedAt: now,
    periods: periods.map((p) => ({ home: p.teamA, away: p.teamB })),
    officialDetails: officialDetailsSchema.parse({
      sourceUrl: gamePageUrl(expected),
      receivedAt: now,
      teams: g.c.map((t) => ({
        name: t.Name,
        stats: scalarStats(t.Stats),
        players: t.Children.map((p) => ({
          id: p.Id,
          name: p.Name,
          number: p.JerseyNumber,
          stats: Object.fromEntries(
            Object.entries(p.Stats).filter(
              ([, v]) => typeof v === "number" && Number.isFinite(v),
            ),
          ),
        })),
      })),
      leadChanges: g.Stats.A_LC,
      timesTied: g.Stats.A_TT,
      scoreHistory: g.scoreList?.flatMap((p) =>
        p.items.map((i) => ({
          period: p.period,
          time: i.Time,
          home: i.SA,
          away: i.SB,
        })),
      ),
    }),
  };
}
async function get(url: string, accept: string, fetchImpl: FetchLike) {
  const r = await fetchImpl(url, {
    cache: "no-store",
    headers: { accept },
    signal: AbortSignal.timeout(15000),
  });
  if (
    !r.ok ||
    !(r.headers.get("content-type") ?? "").includes(accept) ||
    (r.url && new URL(r.url).origin !== "https://www.fiba.basketball")
  )
    throw Error(`FIBA match request failed: ${r.status}`);
  return new TextDecoder().decode(await boundedBody(r, 5 * 1024 * 1024));
}
export async function fetchGameDetails(
  game: FibaGame,
  now: string,
  previous?: Game,
  fetchImpl: FetchLike = fetch,
): Promise<Partial<Game> | null> {
  // This is the same public, unauthenticated initial-data endpoint used by FIBA's match page.
  const raw = JSON.parse(
    await get(
      `https://www.fiba.basketball/en/events/api/game-live-info/${game.gameId}/detail`,
      "application/json",
      fetchImpl,
    ),
  );
  // FIBA answers {"game":{"content":null}} for a match with no live feed: not started yet, or forfeited.
  if (raw?.game?.content == null) return null;
  const patch = parseLiveGame(raw, game, now);
  const details = patch.officialDetails!;
  if (previous?.officialDetails) {
    Object.assign(details, {
      country: previous.officialDetails.country,
      city: previous.officialDetails.city,
      referees: previous.officialDetails.referees,
      commissioners: previous.officialDetails.commissioners,
    });
  } else {
    const payload = extractPayload(
      await get(gamePageUrl(game), "text/html", fetchImpl),
    );
    const profile = jsonValuesFor(payload, "game", "{").find(
      (v) => (v as { gameId?: number }).gameId === game.gameId,
    ) as { hostCity?: string; hostCountry?: string } | undefined;
    const officials = (key: string) => {
      const rows = jsonValuesFor(payload, key, "[")[0];
      return z
        .array(
          z.object({
            firstName: z.string(),
            lastName: z.string(),
            licenseNationality: z.string(),
          }),
        )
        .parse(rows ?? [])
        .map((p) => `${p.lastName}, ${p.firstName} (${p.licenseNationality})`);
    };
    Object.assign(details, {
      country: profile?.hostCountry,
      city: profile?.hostCity,
      referees: officials("referees"),
      commissioners: officials("commissioners"),
    });
  }
  return patch;
}
