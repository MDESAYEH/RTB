import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { broadcastPlaceholder, matchStream } from "../lib/stream";
import { can, requiredPermission } from "../lib/permissions";

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "road-stream-")),
  "stream.db",
);

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const FB = "https://www.facebook.com/Ittihadscofficial/videos/2356351284771130/";

test("each match shows only its own link, and only once it is live (or finished)", () => {
  // A link set ahead of time stays hidden until the match goes live.
  assert.equal(matchStream({ status: "Scheduled", streamUrl: YT }).state, "not-started");
  assert.equal(matchStream({ status: "Warmup", streamUrl: YT }).state, "not-started");
  assert.deepEqual(matchStream({ status: "Live", streamUrl: YT }), { state: "show", url: YT });
  assert.equal(matchStream({ status: "Halftime", streamUrl: FB }).state, "show");
  assert.equal(matchStream({ status: "Ended", streamUrl: YT }).state, "show", "replay link stays available");
  // FIBA's status can lag: from ten minutes before kickoff the link shows even while the status still says Scheduled.
  const KICKOFF = "2026-10-21T09:00:00Z";
  const at = (minutes: number) => Date.parse(KICKOFF) + minutes * 60_000;
  assert.equal(matchStream({ status: "Scheduled", streamUrl: YT, date: KICKOFF }, at(-30)).state, "not-started");
  assert.equal(matchStream({ status: "Scheduled", streamUrl: YT, date: KICKOFF }, at(-9)).state, "show");
  assert.equal(matchStream({ status: "Scheduled", streamUrl: YT, date: KICKOFF }, at(25)).state, "show");
  assert.equal(matchStream({ status: "Scheduled", date: KICKOFF }, at(25)).state, "not-started", "no link, nothing to show");
  assert.equal(matchStream({ status: "Postponed", streamUrl: YT, date: KICKOFF }, at(25)).state, "postponed");
  // No link: nothing is borrowed from another match or a site-wide default.
  assert.equal(matchStream({ status: "Live" }).state, "no-link");
  assert.equal(matchStream({ status: "Live", streamUrl: "" }).state, "no-link");
  assert.equal(matchStream({ status: "Live", streamUrl: "http://insecure.example/x" }).state, "no-link");
  assert.equal(matchStream({ status: "Live", streamUrl: "https://evil.example/video" }).state, "no-link");
  assert.equal(matchStream({ status: "Ended" }).state, "ended");
  assert.equal(matchStream({ status: "Postponed", streamUrl: YT }).state, "postponed");
  assert.equal(matchStream({ status: "Cancelled", streamUrl: YT }).state, "cancelled");
});

test("the placeholder says the match has not started yet", () => {
  assert.equal(broadcastPlaceholder("not-started", "ar").title, "لم تبدأ المباراة بعد");
  assert.equal(broadcastPlaceholder("not-started", "en").title, "The match has not started yet");
  assert.equal(broadcastPlaceholder("show", "ar").title, "");
});

test("setting a match's broadcast link is a control-room action with its own validation", async () => {
  assert.equal(requiredPermission({ action: "stream" }), "game:control");
  assert.ok(can("scorer", "game:control"));
  assert.ok(!can("editor", "game:control"));

  const { store } = await import("../lib/store");
  const { applyCommand, ConflictError } = await import("../lib/admin-command");
  await store.provider.getTeams();
  await store.write(
    "games",
    "g1",
    {
      id: "g1",
      home: "al-ittihad",
      away: "stade-malien",
      group: "A",
      date: "2026-10-21T15:00:00+02:00",
      venue: "",
      status: "Scheduled",
      homeScore: 0,
      awayScore: 0,
      periods: [],
      quarter: 1,
      clock: 600,
      running: false,
      version: 0,
      updatedAt: "2026-10-14T00:00:00.000Z",
    },
    "admin",
  );
  await store.write(
    "games",
    "g2",
    {
      id: "g2",
      home: "kriol-star",
      away: "nb-staoueli",
      group: "A",
      date: "2026-10-21T17:00:00+02:00",
      venue: "",
      status: "Scheduled",
      homeScore: 0,
      awayScore: 0,
      periods: [],
      quarter: 1,
      clock: 600,
      running: false,
      version: 0,
      updatedAt: "2026-10-14T00:00:00.000Z",
    },
    "admin",
  );

  await applyCommand({ action: "stream", id: "g1", version: 0, value: YT }, "scorer@example.com");
  const g1 = await store.get<{ streamUrl?: string; version: number }>("games", "g1");
  assert.equal(g1?.streamUrl, YT);
  assert.equal(g1?.version, 1);
  // The other match is untouched: there is no shared link.
  assert.equal((await store.get<{ streamUrl?: string }>("games", "g2"))?.streamUrl ?? "", "");

  // Unsupported or insecure links are refused; a stale version is a conflict, not an overwrite.
  await assert.rejects(() => applyCommand({ action: "stream", id: "g1", version: 1, value: "https://evil.example/x" }, "a"));
  await assert.rejects(() => applyCommand({ action: "stream", id: "g1", version: 1, value: "http://www.youtube.com/watch?v=dQw4w9WgXcQ" }, "a"));
  await assert.rejects(
    () => applyCommand({ action: "stream", id: "g1", version: 0, value: FB }, "a"),
    ConflictError,
  );

  // Clearing removes it, and the change is audited.
  await applyCommand({ action: "stream", id: "g1", version: 1, value: "" }, "scorer@example.com");
  assert.equal((await store.get<{ streamUrl?: string }>("games", "g1"))?.streamUrl, "");
  const audit = (await store.db
    .prepare("SELECT COUNT(*) AS n FROM audit WHERE action='stream' AND target='g1'")
    .get()) as { n: number };
  assert.equal(audit.n, 2);
});
