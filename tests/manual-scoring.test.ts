import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { score, gameSchema, type Game } from "../lib/domain";
import { stale } from "../lib/public-domain";
import { requiredPermission, can } from "../lib/permissions";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "road-manual-")), "manual.db");

const game = (over: Partial<Game> = {}): Game =>
  gameSchema.parse({
    id: "m1",
    home: "al-ittihad",
    away: "stade-malien",
    group: "A",
    date: "2026-10-21T15:00:00+02:00",
    status: "Live",
    quarter: 1,
    clock: 600,
    updatedAt: "2026-10-21T13:00:00.000Z",
    ...over,
  });

test("points can be added and taken back, and the periods always add up to the score", () => {
  let g = game({ quarter: 2, periods: [{ home: 5, away: 3 }, { home: 2, away: 0 }], homeScore: 7, awayScore: 3 });
  g = score(g, "home", 3);
  assert.equal(g.homeScore, 10);
  assert.deepEqual(g.periods[1], { home: 5, away: 0 });
  // Taking back more than this period holds goes into the earlier period.
  g = score(g, "home", -3);
  g = score(g, "home", -3);
  assert.equal(g.homeScore, 4);
  assert.equal(g.periods[0].home + g.periods[1].home, 4);
  assert.deepEqual(g.periods.map((p) => p.home).every((n) => n >= 0), true);
  g = score(g, "away", -3);
  assert.equal(g.awayScore, 0);
  assert.throws(() => score(g, "away", -1), /خصم/);
  assert.throws(() => score(g, "home", 4));
  assert.throws(() => score({ ...g, status: "Scheduled" }, "home", 1));
});

test("scoring is a control-room permission for the scorer role", () => {
  for (const action of ["score", "status", "manual"]) {
    assert.equal(requiredPermission({ action }), "game:control");
  }
  assert.ok(can("scorer", "game:control"));
});

test("a match scored by hand is never reported as having stale data", () => {
  const live = game({ status: "Live" });
  assert.equal(stale(live, Date.parse(live.updatedAt) + 120_000), true);
  assert.equal(stale({ ...live, manual: true }, Date.parse(live.updatedAt) + 120_000), false);
});

test("start, score, take back and finish a match in the control room; it becomes the organisers' match", async () => {
  const { store } = await import("../lib/store");
  const { applyCommand } = await import("../lib/admin-command");
  await store.provider.getTeams();
  await store.write("games", "m1", { ...game({ status: "Scheduled", updatedAt: "2026-10-14T00:00:00.000Z" }), version: 0 }, "admin");

  const read = async () => (await store.get<Game>("games", "m1"))!;
  // One tap starts it (Scheduled -> Warmup -> Live) and marks it as scored by hand.
  await applyCommand({ action: "status", id: "m1", version: 0, status: "Live" }, "scorer@example.com");
  let g = await read();
  assert.equal(g.status, "Live");
  assert.equal(g.manual, true);

  await applyCommand({ action: "score", id: "m1", version: g.version, side: "home", points: 3 }, "scorer@example.com");
  g = await read();
  await applyCommand({ action: "score", id: "m1", version: g.version, side: "away", points: 2 }, "scorer@example.com");
  g = await read();
  await applyCommand({ action: "score", id: "m1", version: g.version, side: "home", points: -1 }, "scorer@example.com");
  g = await read();
  assert.deepEqual([g.homeScore, g.awayScore], [2, 2]);

  // Finishing completes the period for you; a draw still cannot end.
  await assert.rejects(() => applyCommand({ action: "status", id: "m1", version: g.version, status: "Ended" }, "a"));
  await applyCommand({ action: "score", id: "m1", version: g.version, side: "home", points: 2 }, "a");
  g = await read();
  await applyCommand({ action: "status", id: "m1", version: g.version, status: "Ended" }, "a");
  g = await read();
  assert.equal(g.status, "Ended");
  assert.equal(g.quarter, 4);
  assert.equal(g.clock, 0);
  assert.deepEqual([g.homeScore, g.awayScore], [4, 2]);

  // Handing the match back to FIBA's feed is a separate, explicit action.
  await applyCommand({ action: "manual", id: "m1", version: g.version, value: false }, "a");
  g = await read();
  assert.equal(g.manual, false);
  await assert.rejects(() => applyCommand({ action: "manual", id: "m1", version: g.version, value: "yes" as unknown as boolean }, "a"));
});
