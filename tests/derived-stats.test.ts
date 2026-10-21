import { test } from "node:test";
import assert from "node:assert/strict";
import { derivedPlayerStats } from "../lib/derived-stats";

const details = (players: { id: string; stats: Record<string, number> }[]) =>
  ({
    sourceUrl: "https://www.fiba.basketball/",
    receivedAt: "2026-10-21T10:00:00.000Z",
    referees: [],
    commissioners: [],
    scoreHistory: [],
    teams: [
      { name: "A", stats: {}, players: players.map((p) => ({ ...p, name: p.id, number: "1" })) },
      { name: "B", stats: {}, players: [] },
    ],
  }) as never;

test("statistics come from the official box score and skip players who never played", () => {
  const games = [
    {
      id: "fiba-1",
      officialDetails: details([
        { id: "P_10", stats: { PTS: 21, REB: 7, AS: 3, ST: 2, BS: 1, EFF: 25 } },
        { id: "P_11", stats: { PTS: 0, REB: 0, AS: 0, ST: 0, BS: 0, EFF: 0 } },
        { id: "P_12", stats: { PTS: 0, REB: 0, AS: 0, ST: 0, BS: 0, EFF: -1, PF: 2 } },
      ]),
    },
    { id: "fiba-2", officialDetails: undefined },
  ];
  const rows = derivedPlayerStats(games);
  assert.deepEqual(rows.map((r) => r.player), ["fiba-player-10", "fiba-player-12"]);
  assert.deepEqual(rows[0], {
    id: "fiba-stat-fiba-1-10",
    game: "fiba-1",
    player: "fiba-player-10",
    points: 21,
    rebounds: 7,
    assists: 3,
    steals: 2,
    blocks: 1,
    efficiency: 25,
  });
  assert.equal(rows[1].efficiency, -1);
});

test("a line the organisers entered by hand for the same match and player wins", () => {
  const games = [{ id: "fiba-1", officialDetails: details([{ id: "P_10", stats: { PTS: 5 } }]) }];
  assert.deepEqual(derivedPlayerStats(games, [{ game: "fiba-1", player: "fiba-player-10" }]), []);
});
