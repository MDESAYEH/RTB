import { test } from "node:test";
import assert from "node:assert/strict";
import { MATCH_STREAMS, streamForTeams } from "../lib/match-streams";
import { streamEmbed } from "../lib/stream";

const CLUBS = [
  "al-ittihad",
  "nb-staoueli",
  "kriol-star",
  "stade-malien",
  "energie-bc",
  "nabaya-sofas",
  "spintex-knights",
  "npa-pythons",
];

test("all twelve group matches have their own YouTube broadcast", () => {
  assert.equal(MATCH_STREAMS.length, 12);
  const urls = new Set(MATCH_STREAMS.map((m) => m.url));
  assert.equal(urls.size, 12, "every match has a different link");
  for (const m of MATCH_STREAMS) {
    const embed = streamEmbed(m.url);
    assert.equal(embed?.kind, "iframe", m.url);
    assert.equal(embed?.label, "YouTube");
  }
});

test("each pair of clubs in the same group meets exactly once, in either order", () => {
  const groups = [CLUBS.slice(0, 4), CLUBS.slice(4)];
  for (const group of groups)
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const forward = streamForTeams(group[i], group[j]);
        assert.ok(forward, `${group[i]} v ${group[j]} has no stream`);
        assert.equal(forward, streamForTeams(group[j], group[i]));
      }
  assert.equal(streamForTeams("al-ittihad", "spintex-knights"), undefined, "clubs of different groups never meet");
});
