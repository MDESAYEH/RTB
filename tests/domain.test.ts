import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gameSchema,
  teamSchema,
  settingsSchema,
  transition,
  score,
  standings,
  qualification,
  stale,
  remainingClock,
  resolveSource,
  type Settings,
} from "../lib/domain";
const teams = ["a", "b", "c"].map((id) =>
  teamSchema.parse({ id, name: id + id, country: "Libya", group: "A" }),
);
const g = gameSchema.parse({
  id: "g",
  home: "a",
  away: "b",
  group: "A",
  date: "2026-10-21T18:00:00+02:00",
});
const settings: Settings = {
  name: "Tournament",
  shortName: "ROAD",
  start: g.date,
  end: "2026-10-26T00:00:00+02:00",
  timezone: "Africa/Tripoli",
  city: "Tripoli",
  venue: "",
  hero: "Tripoli",
  announcement: "",
  groups: ["A"],
  qualificationSlots: 1,
  winPoints: 2,
  lossPoints: 1,
  rulesConfirmed: true,
  featuredGameId: null,
};
test("normalization supplies safe scheduled defaults", () => {
  assert.equal(g.homeScore, 0);
  assert.equal(g.status, "Scheduled");
});
test("schema rejects negative scores and same teams", () => {
  assert.throws(() => gameSchema.parse({ ...g, homeScore: -1 }));
  assert.throws(() => gameSchema.parse({ ...g, away: "a" }));
});
test("settings rejects invalid timezone", () => {
  assert.throws(() =>
    settingsSchema.parse({ ...settings, timezone: "fake/zone" }),
  );
});
test("legal warmup-live-halftime-live-ended transitions", () => {
  let v = transition(g, "Warmup");
  v = transition(v, "Live");
  v = score(v, "home", 3);
  v = transition({ ...v, quarter: 2, clock: 0 }, "Halftime");
  v = transition(v, "Live");
  assert.equal(
    transition({ ...v, quarter: 4, clock: 0 }, "Ended").status,
    "Ended",
  );
});
test("cannot skip warmup, score scheduled, end tied or reopen final", () => {
  assert.throws(() => transition(g, "Live"));
  assert.throws(() => score(g, "home", 1));
  assert.throws(() => transition({ ...g, status: "Live" }, "Ended"));
  assert.throws(() => transition({ ...g, status: "Ended" }, "Live"));
});
test("score increments period totals, immutable snapshot supports undo", () => {
  const v = score({ ...g, status: "Live" }, "away", 2);
  assert.equal(v.awayScore, 2);
  assert.equal(v.periods[0].away, 2);
  assert.equal(g.awayScore, 0);
  assert.throws(() => score({ ...g, status: "Live" }, "home", 4));
});
test("standings count only ended games", () => {
  const rows = standings(
    teams,
    [
      { ...g, status: "Ended", homeScore: 80, awayScore: 60 },
      { ...g, id: "live", status: "Live", homeScore: 90, awayScore: 60 },
    ],
    settings,
  );
  assert.equal(rows[0].pts, 2);
  assert.equal(rows[0].diff, 20);
  assert.equal(rows[0].p, 1);
  assert.equal(rows.find((r) => r.team.id === "b")?.pts, 1);
});
test("points ties remain unresolved", () => {
  assert.ok(standings(teams, [], settings).every((r) => r.tied));
});
const complete = [
  { ...g, status: "Ended" as const, homeScore: 80, awayScore: 60 },
  {
    ...g,
    id: "ac",
    home: "a",
    away: "c",
    status: "Ended" as const,
    homeScore: 80,
    awayScore: 60,
  },
  {
    ...g,
    id: "bc",
    home: "b",
    away: "c",
    status: "Ended" as const,
    homeScore: 80,
    awayScore: 60,
  },
];
test("deterministic completed qualification and elimination", () => {
  assert.equal(qualification(teams[0], teams, complete, settings), "QUALIFIED");
  assert.equal(
    qualification(teams[2], teams, complete, settings),
    "ELIMINATED",
  );
});
test("incomplete schedule or unconfirmed rules never claims qualification", () => {
  assert.equal(
    qualification(teams[0], teams, complete.slice(0, 2), settings),
    "IN_CONTENTION",
  );
  assert.equal(
    qualification(teams[0], teams, complete, {
      ...settings,
      rulesConfirmed: false,
    }),
    "IN_CONTENTION",
  );
});
test("qualification rejects a full-size schedule with an outsider or self pairing", () => {
  const schedule = [
    { ...g, status: "Ended" as const, homeScore: 80, awayScore: 70 },
    {
      ...g,
      id: "g2",
      home: "a",
      away: "c",
      status: "Ended" as const,
      homeScore: 80,
      awayScore: 70,
    },
    {
      ...g,
      id: "g3",
      home: "b",
      away: "outsider",
      status: "Ended" as const,
      homeScore: 80,
      awayScore: 70,
    },
  ];
  assert.equal(
    qualification(teams[0], teams, schedule, settings),
    "IN_CONTENTION",
  );
  assert.equal(
    qualification(
      teams[0],
      teams,
      [...schedule.slice(0, 2), { ...schedule[2], away: "b" }],
      settings,
    ),
    "IN_CONTENTION",
  );
});
test("circular points tie stays in contention", () => {
  const tie = complete.map((v, i) =>
    i === 1 ? { ...v, homeScore: 60, awayScore: 80 } : v,
  );
  assert.equal(qualification(teams[0], teams, tie, settings), "IN_CONTENTION");
});
test("freshness retains score and flags stale live data", () => {
  const v = {
    ...g,
    status: "Live" as const,
    updatedAt: new Date(0).toISOString(),
  };
  assert.equal(stale(v, 46000), true);
  assert.equal(stale(v, 44000), false);
  assert.equal(stale({ ...v, status: "Ended" }, 999999), false);
});
test("clock respects authoritative timestamp and never negative", () => {
  assert.equal(
    remainingClock(
      { ...g, clock: 10, running: true, updatedAt: new Date(0).toISOString() },
      15000,
    ),
    0,
  );
});
test("manual overrides primary while secondary disagreement is flagged", () => {
  assert.deepEqual(resolveSource(70, 68, 65), {
    value: 70,
    source: "manual",
    conflict: true,
  });
  assert.equal(resolveSource(undefined, 68, 68).conflict, false);
});
