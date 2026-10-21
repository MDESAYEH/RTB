import { test } from "node:test";
import assert from "node:assert/strict";
import { playerName, positionLabel } from "../lib/player-i18n";

test("players show an Arabic name on the Arabic site and a tidy English name on the English site", () => {
  const p = { id: "fiba-player-429888", name: "Ali Mistafa ALSHWETER" };
  assert.equal(playerName(p, "ar"), "علي مصطفى الشويتر");
  assert.equal(playerName(p, "en"), "Ali Mistafa Alshweter");
  // A player without an Arabic spelling falls back to the English name rather than showing nothing.
  assert.equal(playerName({ id: "fiba-player-1", name: "New Player" }, "ar"), "New Player");
  assert.equal(playerName({ id: "manual-7", name: "Local Guard" }, "ar"), "Local Guard");
});

test("positions are translated for the Arabic site and untouched for English", () => {
  assert.equal(positionLabel("Shooting Guard", "ar"), "حارس مسدد");
  assert.equal(positionLabel("Center", "ar"), "ارتكاز");
  assert.equal(positionLabel("Shooting Guard", "en"), "Shooting Guard");
  assert.equal(positionLabel("Unknown Role", "ar"), "Unknown Role");
  assert.equal(positionLabel(undefined, "ar"), "");
});
