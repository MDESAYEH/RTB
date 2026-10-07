import { test } from "node:test";
import assert from "node:assert/strict";
import { clubProfiles, publicClubProfile } from "../lib/club-profile";
import { clubFeature } from "../lib/club-presentation";
test("features use published claims; unverified championship claims remain absent", () => {
  for (const raw of clubProfiles) {
    const p = publicClubProfile(raw);
    const feature = clubFeature(p);
    if (["red-flames", "nabaya-sofas", "as-douanes"].includes(p.id))
      assert.equal(feature, null);
    else assert.ok(feature);
    assert.ok(!JSON.stringify(feature).includes("undefined"));
  }
});
test("Stade achievement and Kriol story select distinct editorial treatments", () => {
  const p = (id: string) =>
    publicClubProfile(clubProfiles.find((p) => p.id === id)!);
  assert.equal(clubFeature(p("stade-malien"))?.subtitle, "THIRD PLACE");
  assert.equal(clubFeature(p("kriol-star"))?.subtitle, "TRAILBLAZERS");
  assert.equal(clubFeature(p("al-ittihad"))?.title, "18×");
});
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialClubProfile } from "../app/editorial-club-profile";
test("missing registry logo renders initials without inventing history or empty honours", () => {
  const p = publicClubProfile(clubProfiles.find((p) => p.id === "red-flames")!);
  p.id = "unassigned-identity";
  const html = renderToStaticMarkup(
    createElement(EditorialClubProfile, { profile: p }),
  );
  assert.match(html, /club-initials/);
  assert.ok(html.includes(p.shortName));
  assert.ok(!html.includes("EST."));
  assert.ok(!html.includes("club-trophy-wall"));
});
import { clubPresentation, supportingHonours } from "../lib/club-presentation";
test("adaptive density follows verified content; short honours merge and feature totals do not repeat", () => {
  const p = (id: string) =>
    publicClubProfile(clubProfiles.find((p) => p.id === id)!);
  assert.equal(clubPresentation(p("stade-malien")), "RICH");
  for (const id of ["al-ittihad", "kriol-star"])
    assert.equal(clubPresentation(p(id)), "MEDIUM");
  for (const id of ["nabaya-sofas", "red-flames"])
    assert.equal(clubPresentation(p(id)), "LIGHT");
  assert.deepEqual(
    supportingHonours(p("al-ittihad")).map((h) => h.displayNumber),
    ["2026", "2023"],
  );
  const html = renderToStaticMarkup(
    createElement(EditorialClubProfile, { profile: {...p("kriol-star"),id:"unassigned-identity"} }),
  );
  assert.ok(html.includes("CHAMPION IN FIRST SEASON"));
  assert.ok(!html.includes("club-trophy-wall"));
  assert.ok(html.includes("club-inline-honours"));
});

