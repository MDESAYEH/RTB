import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEventPage, FibaParseError, extractPayload } from "../lib/providers/fiba/parser";
import { mapEvent } from "../lib/providers/fiba/mapper";
import { fetchFibaPage, FibaFetchError } from "../lib/providers/fiba/client";
import { runDryRun, formatReport } from "../lib/providers/fiba/sync";

const fixture = readFileSync(new URL("./fixtures/fiba-games.html", import.meta.url), "utf8");

/** Rebuild a page from a (possibly edited) payload object, as FIBA's script chunks encode it. */
function pageFrom(edit: (data: Record<string, unknown>) => void): string {
  const payload = extractPayload(fixture);
  const body = JSON.parse(payload.slice(payload.indexOf("{")));
  edit(body);
  return `<html><body><script>self.__next_f.push([1,${JSON.stringify("0:" + JSON.stringify(body))}])</script></body></html>`;
}
type Row = Record<string, unknown>;
/** First game rewritten to be between two local teams (Al Ittihad v Stade Malien). */
function publishedGame(data: Record<string, unknown>): Row {
  const [game] = data.games as Row[];
  const teams = data.teams as Row[];
  const side = (slug: string) => {
    const team = teams.find((row) => row.slug === slug);
    assert.ok(team, `fixture lacks ${slug}`);
    return { teamId: team.teamId, code: team.code, officialName: team.officialName };
  };
  return { ...game, teamA: side("al-ittihad"), teamB: side("stade-malien") };
}
const htmlResponse = (html: string, status = 200, type = "text/html; charset=utf-8") =>
  Promise.resolve(new Response(html, { status, headers: { "content-type": type } }));

test("parser extracts event, teams and games present in the saved page", () => {
  const data = parseEventPage(fixture);
  assert.equal(data.competition.competitionCode, "AFCCMQ");
  assert.equal(data.currentPhase, "POST_DRAW");
  assert.equal(data.teams.length, 21);
  assert.equal(data.games.length, 2);
  assert.ok(data.teams.some((team) => team.slug === "al-ittihad"));
});

test("games without a published date are reported, never invented", () => {
  const { games } = mapEvent(parseEventPage(fixture));
  assert.equal(games.length, 2);
  for (const outcome of games) assert.equal(outcome.game, null);
});

test("a published game between local teams maps through gameSchema", () => {
  const html = pageFrom((data) => {
    const game = publishedGame(data);
    game.gameDateTimeUTC = "2026-10-21T15:00:00";
    game.hasTimeGameDateTime = true;
    data.games = [game];
  });
  const [outcome] = mapEvent(parseEventPage(html)).games;
  assert.ok(outcome.game);
  assert.equal(outcome.game.home, "al-ittihad");
  assert.equal(outcome.game.away, "stade-malien");
  assert.equal(outcome.game.status, "Scheduled");
  assert.equal(outcome.game.date, "2026-10-21T15:00:00Z");
});

test("unknown FIBA status codes are rejected instead of guessed", () => {
  const html = pageFrom((data) => {
    const game = publishedGame(data);
    game.gameDateTimeUTC = "2026-10-21T15:00:00";
    game.hasTimeGameDateTime = true;
    game.statusCode = "SOMETHING_NEW";
    data.games = [game];
  });
  const [outcome] = mapEvent(parseEventPage(html)).games;
  assert.equal(outcome.game, null);
  assert.match((outcome as { reason: string }).reason, /unmapped FIBA status/);
});

test("fails closed when the page structure changes", () => {
  assert.throws(() => parseEventPage("<html><body>nothing</body></html>"), FibaParseError);
  assert.throws(() => parseEventPage(pageFrom((data) => delete data.teams)), /Team list not found/);
  assert.throws(() => parseEventPage(pageFrom((data) => delete data.games)), /Games list not found/);
  assert.throws(() => parseEventPage(pageFrom((data) => delete data.competition)), /Competition details/);
  assert.throws(
    () =>
      parseEventPage(
        pageFrom((data) => {
          ((data.games as Record<string, unknown>[])[0] as Record<string, unknown>).gameId = "x";
        }),
      ),
    /games\[0\] does not match/,
  );
});

test("client refuses non-200, non-HTML and foreign redirects", async () => {
  await assert.rejects(fetchFibaPage("games", () => htmlResponse("", 403)), FibaFetchError);
  await assert.rejects(fetchFibaPage("games", () => htmlResponse("{}", 200, "application/json")), /HTML/);
  const redirected = () => {
    const response = new Response(fixture, { status: 200, headers: { "content-type": "text/html" } });
    Object.defineProperty(response, "url", { value: "https://example.com/en/events/x" });
    return Promise.resolve(response);
  };
  await assert.rejects(fetchFibaPage("games", redirected), /redirect/);
});

test("dry run reports counts and never touches a database", async () => {
  const report = await runDryRun(() => htmlResponse(fixture));
  assert.equal(report.counts.teamsFound, 21);
  assert.equal(report.counts.gamesFound, 2);
  assert.equal(report.counts.standingsFound, 0);
  assert.equal(report.games.mappable.length, 0);
  assert.ok(report.teams.matched.includes("al-ittihad"));
  assert.match(formatReport(report), /teams found: 21/);
});
