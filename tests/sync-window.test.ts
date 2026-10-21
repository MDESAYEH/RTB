import { test } from "node:test";
import assert from "node:assert/strict";
import { FAST_SYNC_MS, IDLE_SYNC_MS, WINDOW_LEAD_MS, WINDOW_MAX_MS, syncWindowActive } from "../lib/sync-window";

const KICKOFF = "2026-10-21T09:00:00Z";
const at = (minutes: number) => Date.parse(KICKOFF) + minutes * 60_000;
const game = (over: Record<string, unknown> = {}) => ({ date: KICKOFF, status: "Scheduled" as const, manual: false, ...over });

test("fast syncing runs from ten minutes before kickoff until FIBA ends the match", () => {
  assert.equal(syncWindowActive([game()], at(-11)), false, "too early");
  assert.equal(syncWindowActive([game()], at(-10)), true, "ten minutes before");
  assert.equal(syncWindowActive([game({ status: "Live" })], at(45)), true, "being played");
  assert.equal(syncWindowActive([game({ status: "Ended" })], at(95)), false, "FIBA says it ended");
});

test("a match FIBA never closes stops counting after three hours", () => {
  assert.equal(syncWindowActive([game({ status: "Live" })], at(179)), true);
  assert.equal(syncWindowActive([game({ status: "Live" })], at(181)), false);
});

test("postponed, cancelled and hand-scored matches never open the window; any one open match does", () => {
  assert.equal(syncWindowActive([game({ status: "Postponed" })], at(5)), false);
  assert.equal(syncWindowActive([game({ status: "Cancelled" })], at(5)), false);
  assert.equal(syncWindowActive([game({ manual: true, status: "Live" })], at(5)), false);
  assert.equal(syncWindowActive([game({ status: "Ended" }), game({ date: "2026-10-21T11:30:00Z" })], at(140)), true);
  assert.equal(syncWindowActive([], at(0)), false);
});

test("the rhythm: quick inside a match, ten minutes outside, never faster than ten seconds", () => {
  assert.equal(IDLE_SYNC_MS, 10 * 60_000);
  assert.ok(FAST_SYNC_MS >= 10_000, "politeness towards FIBA");
  assert.equal(WINDOW_LEAD_MS, 10 * 60_000);
  assert.equal(WINDOW_MAX_MS, 3 * 60 * 60_000);
});
