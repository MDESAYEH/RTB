import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import registry from "../lib/team-identity.json";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClubRoadMark } from "../app/club-road-primitives";
import { teamLogoAsset } from "../lib/team-identity";
import { ClubMatchLine, StadeTournamentHub } from "../app/stade-tournament-hub";
import { clubProfiles, publicClubProfile } from "../lib/club-profile";
import { clubFeature } from "../lib/club-presentation";
import type { Game, Team } from "../lib/public-domain";
const host: Team = {
  id: "al-ittihad",
  name: "Al Ittihad",
  country: "Libya",
  group: "A",
  verified: true,
};
test("every registered club logo exists at its public URL", () => {
  for (const team of registry.teams) {
    assert.ok(
      statSync(new URL(`../public${team.logoAsset}`, import.meta.url)).size > 0,
      `${team.id}: missing logo at ${team.logoAsset}`,
    );
  }
});
const other: Team = {
  id: "test-stade",
  name: "Stade Malien",
  country: "Mali",
  group: "A",
  verified: true,
};
const game: Game = {
  id: "in-memory-only",
  home: host.id,
  away: other.id,
  group: "A",
  date: "2026-10-21T18:00:00+02:00",
  venue: "",
  status: "Scheduled",
  homeScore: 0,
  awayScore: 0,
  quarter: 1,
  clock: 600,
  running: false,
  updatedAt: "",
  version: 0,
  periods: [],
};
test("club road restores registered assets and retains missing identity fallback", () => {
  assert.equal(teamLogoAsset(host.id), "/al-ittihad.svg");
  assert.equal(teamLogoAsset("stade-malien"), "/images/clubs/stade-malien.png");
  for (const id of ["missing-identity"]) {
    const html = renderToStaticMarkup(
      createElement(ClubRoadMark, { id, name: "Club", fallback: "CL" }),
    );
    assert.match(html, /club-initials/);
    assert.ok(!html.includes("<img"));
  }
});
test("match lines prioritize time, live scores and final winner without nested links", () => {
  for (const status of ["Scheduled", "Live", "Ended"] as const) {
    const html = renderToStaticMarkup(
      createElement(ClubMatchLine, {
        game: { ...game, status, homeScore: 78, awayScore: 72 },
        team: host,
        opponents: [other],
      }),
    );
    assert.match(html, /\/teams\/test-stade/);
    assert.match(html, /\/matches\/in-memory-only/);
    let depth = 0;
    for (const tag of html.matchAll(/<\/?a(?:\s[^>]*)?>/g)) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      assert.ok(depth >= 0 && depth <= 1);
    }
    assert.equal(depth, 0);
    if (status === "Scheduled") {
      assert.ok(html.includes("18:00"));
      assert.ok(!html.includes("78 — 72"));
    } else assert.ok(html.includes("78 — 72"));
    if (status === "Ended") assert.ok(html.includes("Al Ittihad"));
  }
});
test("group focal identity follows selected club and no reviewed trophy becomes a feature", () => {
  const html = renderToStaticMarkup(
    createElement(StadeTournamentHub, {
      team: other,
      opponents: [{ ...host, id: "test-opponent" }],
      matches: [],
      roster: [],
      record: { p: 0, w: 0, l: 0, pf: 0, pa: 0, diff: 0 },
      status: "IN_CONTENTION",
    }),
  );
  assert.match(html, /class="hub-club current-club" data-team="test-stade"/);
  assert.ok(html.includes("بانتظار جدول المواجهات الرسمي"));
  assert.ok(!html.includes("club-match-line"));
  for (const id of ["nabaya-sofas", "as-douanes", "red-flames"])
    assert.equal(
      clubFeature(publicClubProfile(clubProfiles.find((p) => p.id === id)!)),
      null,
    );
});
