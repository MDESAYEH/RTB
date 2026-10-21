import liveFixture from "./fixtures/fiba-live-game.json";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseLiveGame,
  fetchGameDetails,
} from "../lib/providers/fiba/game-details";
import {
  parseEventPage,
  parseStandingsPage,
  type FibaGame,
} from "../lib/providers/fiba/parser";
import { buildPlan } from "../lib/providers/fiba/plan";
import { gameSchema, teamSchema } from "../lib/domain";
const load = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const live = () => structuredClone(liveFixture);
const expected: FibaGame = {
  gameId: 137093,
  gameName: "31459-B-1",
  teamA: { teamId: 285389, code: "SPK", officialName: "Spintex Knights" },
  teamB: { teamId: 285384, code: "NBC", officialName: "Nabaya Sofas" },
  teamAScore: 2,
  teamBScore: 3,
  isLive: true,
  isPostponed: false,
  statusCode: "INIT",
  venueName: "Grand Hall",
  gameDateTimeUTC: "2026-10-21T09:00:00",
  hasTimeGameDateTime: true,
  windowName: null,
  groupPairingCode: "B",
};
const now = "2026-10-21T09:30:00Z";
test("recorded individual match feed replaces stale HTML score, validates periods, includes statistics", () => {
  const patch = parseLiveGame(live(), expected, now);
  assert.equal(patch.homeScore, 27);
  assert.equal(patch.awayScore, 30);
  assert.equal(patch.quarter, 2);
  assert.equal(patch.clock, 506);
  assert.equal(patch.running, false);
  assert.deepEqual(patch.periods?.slice(0, 2), [
    { home: 24, away: 28 },
    { home: 3, away: 2 },
  ]);
  assert.equal(patch.officialDetails?.teams[0].stats.FGP, 57.89);
  assert.equal(patch.officialDetails?.leadChanges, 8);
  assert.equal(patch.officialDetails?.teams[0].players.length, 10);
});
test("rejects wrong game, wrong teams, unknown status, invalid clock and inconsistent period totals", () => {
  for (const mutate of [
    (g: typeof liveFixture.game.content) => (g.id = 1),
    (g: typeof liveFixture.game.content) => g.c.reverse(),
    (g: typeof liveFixture.game.content) => (g.status = 123),
    (g: typeof liveFixture.game.content) => (g.RC = "09:99"),
    (g: typeof liveFixture.game.content) => (g.quartersScores[0].teamA = 2),
  ]) {
    const raw = live();
    mutate(raw.game.content);
    assert.throws(() => parseLiveGame(raw, expected, now));
  }
});
test("terminal status and halftime use FIBA status rather than stale INIT", () => {
  const raw = live();
  raw.game.content.status = 5;
  assert.equal(parseLiveGame(raw, expected, now).status, "Ended");
  assert.equal(parseLiveGame(raw, expected, now).clock, 0);
  raw.game.content.status = 3;
  raw.game.content.CurrentPeriodStatus = "N";
  assert.equal(parseLiveGame(raw, expected, now).status, "Halftime");
});
test("final horn ends a non-tied final period when FIBA leaves its feed marked running", () => {
  const raw = live();
  raw.game.content.status = 3;
  raw.game.content.CurrentPeriod = "Q4";
  raw.game.content.RC = "00:00";
  raw.game.content.quartersScores = [
    { period: "Q1", teamA: 24, teamB: 28 },
    { period: "Q2", teamA: 3, teamB: 2 },
    { period: "Q3", teamA: 0, teamB: 0 },
    { period: "Q4", teamA: 0, teamB: 0 },
  ];
  const patch = parseLiveGame(raw, expected, now);
  assert.equal(patch.status, "Ended");
  assert.equal(patch.clock, 0);

  raw.game.content.c[1].Score = raw.game.content.c[0].Score;
  raw.game.content.quartersScores[0].teamB = 25;
  raw.game.content.quartersScores[1].teamB = 2;
  assert.equal(parseLiveGame(raw, expected, now).status, "Live");
});
test("public live endpoint plus individual page provides officials without credentials", async () => {
  const body = {
    game: { gameId: 137093, hostCity: "Tripoli", hostCountry: "Libya" },
    referees: [
      { firstName: "Imad", lastName: "Driouach", licenseNationality: "MAR" },
    ],
    commissioners: [],
  };
  const html = `<script>self.__next_f.push([1,${JSON.stringify("0:" + JSON.stringify(body))}])</script>`;
  const urls: string[] = [];
  const patch = await fetchGameDetails(
    expected,
    now,
    undefined,
    async (url) => {
      urls.push(url);
      return new Response(
        url.endsWith("/detail") ? JSON.stringify(live()) : html,
        {
          headers: {
            "content-type": url.endsWith("/detail")
              ? "application/json"
              : "text/html",
          },
        },
      );
    },
  );
  assert.equal(urls.length, 2);
  assert.match(urls[0], /game-live-info\/137093\/detail$/);
  assert.match(urls[1], /137093-SPK-NBC$/);
  assert.deepEqual(patch.officialDetails?.referees, ["Driouach, Imad (MAR)"]);
});
test("planner applies individual snapshots and retains existing match on live fetch failure", () => {
  const event = parseEventPage(load("fiba-games.html")),
    standings = parseStandingsPage(load("fiba-standings.html"));
  const itt = event.teams.find((t) => t.slug === "al-ittihad")!,
    stade = event.teams.find((t) => t.slug === "stade-malien")!;
  event.games = [
    {
      ...event.games[0],
      gameId: 137093,
      teamA: itt,
      teamB: stade,
      gameDateTimeUTC: "2026-10-21T09:00:00Z",
      hasTimeGameDateTime: true,
      teamAScore: 2,
      teamBScore: 3,
    },
  ];
  const existing = gameSchema.parse({
    id: "fiba-137093",
    home: "al-ittihad",
    away: "stade-malien",
    group: "A",
    date: now,
    status: "Live",
    homeScore: 24,
    awayScore: 28,
  });
  const state = {
    settings: { groups: ["A", "B"] },
    teams: [
      teamSchema.parse({
        id: "al-ittihad",
        name: "Al Ittihad",
        country: "Libya",
        group: "A",
      }),
      teamSchema.parse({
        id: "stade-malien",
        name: "Stade Malien",
        country: "Mali",
        group: "A",
      }),
    ],
    games: [existing],
    overridden: new Set<string>(),
  };
  const patch = parseLiveGame(live(), expected, now);
  const entry = buildPlan(event, standings, state, {
    authoritative: true,
    now,
    liveGames: new Map([[137093, patch]]),
  }).entries.find((e) => e.kind === "games")!;
  assert.equal(entry.action, "update", entry.reason);
  const g = gameSchema.parse(entry.value);
  assert.equal(g.homeScore, 27);
  assert.equal(g.clock, 506);
  assert.equal(g.officialDetails?.teams.length, 2);
  assert.equal(
    buildPlan(event, standings, state, {
      authoritative: true,
      failedLiveGames: new Set([137093]),
    }).entries.find((e) => e.kind === "games")?.action,
    "skipped",
  );
  state.overridden.add("games:fiba-137093");
  assert.equal(
    buildPlan(event, standings, state, {
      authoritative: false,
      liveGames: new Map([[137093, patch]]),
    }).entries.find((e) => e.kind === "games")?.action,
    "ignored",
  );
});
