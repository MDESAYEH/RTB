import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTournamentStore } from "../lib/store";
import type { DatabaseConfig } from "../lib/sql-database";
import { extractPayload } from "../lib/providers/fiba/parser";
import { runSync } from "../lib/providers/fiba/apply";
import type { Game, Team } from "../lib/domain";

const load = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const baseGames = load("fiba-games.html");
const baseStandings = load("fiba-standings.html");
const baseLeaders = load("fiba-leaders.html");

type Row = Record<string, unknown>;
function rewrap(html: string, edit: (data: Row) => void): string {
  const payload = extractPayload(html);
  const body = JSON.parse(payload.slice(payload.indexOf("{"))) as Row;
  edit(body);
  return `<html><body><script>self.__next_f.push([1,${JSON.stringify("0:" + JSON.stringify(body))}])</script></body></html>`;
}
const respond = (html: string) =>
  Promise.resolve(new Response(html, { status: 200, headers: { "content-type": "text/html" } }));

/** A FIBA games page whose first game is Al Ittihad v Stade Malien with the given facts. */
function gamesPage(facts: Partial<Row> = {}): string {
  return rewrap(baseGames, (data) => {
    const teams = data.teams as Row[];
    const side = (slug: string) => {
      const team = teams.find((row) => row.slug === slug);
      assert.ok(team);
      return { teamId: team.teamId, code: team.code, officialName: team.officialName };
    };
    const [game] = data.games as Row[];
    data.games = [
      {
        ...game,
        teamA: side("al-ittihad"),
        teamB: side("stade-malien"),
        gameDateTimeUTC: "2026-10-21T15:00:00",
        hasTimeGameDateTime: true,
        ...facts,
      },
    ];
  });
}
const fetcher =
  (pages: { games?: string; standings?: string; leaders?: string } = {}) =>
  (url: string) =>
    respond(
      url.endsWith("/games")
        ? (pages.games ?? baseGames)
        : url.endsWith("/standings")
          ? (pages.standings ?? baseStandings)
          : (pages.leaders ?? baseLeaders),
    );

const backends: [string, (dir: string) => DatabaseConfig][] = [
  ["SQLite", (dir) => ({ kind: "sqlite", path: join(dir, "t.db") })],
  ["libSQL", (dir) => ({ kind: "libsql", url: `file:${join(dir, "t.db")}` })],
];

for (const [label, config] of backends) {
  const fresh = () => {
    const store = createTournamentStore(() => config(mkdtempSync(join(tmpdir(), "fiba-sync-"))));
    return store;
  };
  const alias = { aliases: { "nadi-basket-staoueli": "nb-staoueli" } };

  test(`${label}: teams and groups are imported from FIBA group tables; unreviewed teams are not merged`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    const result = await runSync(store, { apply: true, fetchImpl: fetcher() });
    assert.equal(result.counts["teams.skipped"], 1);
    const skipped = result.plan.entries.find((entry) => entry.action === "skipped");
    assert.equal(skipped?.id, "nadi-basket-staoueli");
    assert.match(skipped?.reason ?? "", /no reviewed match/);
    // FIBA spells it "Energie BBC"; it is the primary source, so the local name follows.
    assert.equal((await store.get<Team>("teams", "energie-bc"))?.name, "Energie BBC");
    assert.equal((await store.provider.getTeams()).length, 10);
    assert.ok(result.plan.notes.some((note) => /slot not assigned by FIBA/.test(note)));
    assert.ok(result.plan.notes.some((note) => /FIBA group C .* outside the local tournament groups/.test(note)));
    // A seeded (non-manual) record whose group disagrees is corrected from the group table.
    const kriol = (await store.get<Team>("teams", "kriol-star"))!;
    await store.write("teams", "kriol-star", { ...kriol, group: "B" }, "seed");
    await runSync(store, { apply: true, fetchImpl: fetcher() });
    assert.equal((await store.get<Team>("teams", "kriol-star"))?.group, "A");
    await store.db.close();
  });

  test(`${label}: a reviewed alias links the FIBA team to the existing local team; approved new teams are created`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    await runSync(store, { apply: true, fetchImpl: fetcher(), plan: alias });
    const staoueli = (await store.get<Team>("teams", "nb-staoueli"))!;
    assert.equal(staoueli.name, "Nadi Basket Staoueli");
    assert.equal(staoueli.group, "A");
    assert.equal(staoueli.country, "الجزائر");
    // Group B's unassigned slot is never filled; an explicitly approved FIBA team is created.
    const approved = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: { aliases: {}, approvedNewTeams: ["nadi-basket-staoueli"] },
    });
    assert.equal((await store.get<Team>("teams", "nadi-basket-staoueli"))?.country, "");
    assert.equal(approved.counts["teams.create"], 1);
    await store.db.close();
  });

  test(`${label}: games are imported only when fully published, results update, clock stays local`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    // Unpublished date: nothing is created.
    const none = await runSync(store, { apply: true, fetchImpl: fetcher({ games: baseGames }), plan: alias });
    assert.equal((await store.provider.getGames()).length, 0);
    assert.ok(none.plan.entries.filter((entry) => entry.kind === "games").every((entry) => entry.action === "skipped"));

    await runSync(store, { apply: true, fetchImpl: fetcher({ games: gamesPage() }), plan: alias });
    const [created] = await store.provider.getGames();
    assert.equal(created.id.startsWith("fiba-"), true);
    assert.equal(created.home, "al-ittihad");
    assert.equal(created.away, "stade-malien");
    assert.equal(created.status, "Scheduled");
    assert.equal(created.date, "2026-10-21T15:00:00Z");
    assert.equal(created.venue, "");

    // Clock and period are local; FIBA then reports a live score.
    await store.write("games", created.id, { ...created, clock: 123, quarter: 3 }, "fiba-sync");
    const live = gamesPage({ isLive: true, teamAScore: 41, teamBScore: 38, venueName: "Tripoli Arena" });
    const updated = await runSync(store, { apply: true, fetchImpl: fetcher({ games: live }), plan: alias });
    assert.equal(updated.counts["games.update"], 1);
    const game = (await store.provider.getGame(created.id))!;
    assert.deepEqual([game.status, game.homeScore, game.awayScore, game.venue], ["Live", 41, 38, "Tripoli Arena"]);
    assert.deepEqual([game.clock, game.quarter], [123, 3]);
    assert.equal(game.version, created.version + 1);

    // Same data again: nothing to do. FIBA later omits the venue: the stored one is kept.
    const again = await runSync(store, { apply: true, fetchImpl: fetcher({ games: live }), plan: alias });
    assert.equal(again.counts["games.unchanged"], 1);
    await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage({ isLive: true, teamAScore: 41, teamBScore: 38, venueName: null }) }),
      plan: alias,
    });
    assert.equal((await store.provider.getGame(created.id))?.venue, "Tripoli Arena");
    // An unrecognised status code is reported, never guessed.
    const odd = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage({ statusCode: "SOMETHING_NEW" }) }),
      plan: alias,
    });
    assert.match(odd.plan.entries.find((entry) => entry.kind === "games")?.reason ?? "", /unrecognised FIBA status/);
    await store.db.close();
  });

  test(`${label}: manual overrides are never overwritten`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    await runSync(store, { apply: true, fetchImpl: fetcher({ games: gamesPage() }), plan: alias });
    const [game] = await store.provider.getGames();
    // An admin corrects the score and renames a team.
    await store.write("games", game.id, { ...game, homeScore: 99, version: game.version + 1 }, "admin");
    const energie = (await store.get<Team>("teams", "energie-bc"))!;
    await store.write("teams", "energie-bc", { ...energie, name: "Énergie BC" }, "admin");
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage({ isLive: true, teamAScore: 5, teamBScore: 6 }) }),
      plan: alias,
    });
    assert.equal(result.counts["games.ignored"], 1);
    assert.ok(result.plan.entries.some((entry) => entry.id === "energie-bc" && entry.action === "ignored"));
    assert.equal((await store.provider.getGame(game.id))?.homeScore, 99);
    assert.equal((await store.get<Team>("teams", "energie-bc"))?.name, "Énergie BC");
    await store.db.close();
  });

  test(`${label}: structure change fails closed, writes nothing and is logged`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    const before = await store.revision();
    const broken = [
      { games: rewrap(baseGames, (data) => delete data.teams) },
      { games: gamesPage({ gameId: "not-a-number" }) },
      { standings: rewrap(baseStandings, (data) => (data.stages = [])) },
      { standings: "<html><body>maintenance</body></html>" },
    ];
    for (const pages of broken) {
      await assert.rejects(runSync(store, { apply: true, fetchImpl: fetcher(pages), plan: alias }));
    }
    assert.equal(await store.revision(), before, "no data was written");
    const runs = (await store.db.prepare("SELECT status,error FROM fiba_sync_runs").all()) as { status: string; error: string }[];
    assert.equal(runs.length, broken.length);
    assert.ok(runs.every((run) => run.status === "failed" && run.error));
    await store.db.close();
  });

  test(`${label}: dry run writes nothing; applied runs keep a complete sync log and audit trail`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    const before = await store.revision();
    const dry = await runSync(store, { apply: false, fetchImpl: fetcher({ games: gamesPage() }), plan: alias });
    assert.equal(dry.runId, null);
    assert.equal(await store.revision(), before);
    assert.equal(
      (await store.db.prepare("SELECT name FROM sqlite_master WHERE name='fiba_sync_runs'").all()).length,
      0,
      "dry run does not even create log tables",
    );
    assert.equal((await store.provider.getGames()).length, 0);

    const applied = await runSync(store, { apply: true, fetchImpl: fetcher({ games: gamesPage() }), plan: alias });
    const entries = (await store.db
      .prepare("SELECT kind,id,action FROM fiba_sync_entries WHERE run_id=?")
      .all(applied.runId!)) as { kind: string; id: string; action: string }[];
    assert.equal(entries.length, applied.plan.entries.length);
    assert.ok(entries.some((entry) => entry.kind === "games" && entry.action === "create"));
    const audited = (await store.db
      .prepare("SELECT action FROM audit WHERE actor='fiba-sync' AND kind='games'")
      .all()) as { action: string }[];
    assert.deepEqual(audited.map((row) => row.action), ["fiba-create"]);
    const game = (await store.provider.getGames())[0] as Game;
    assert.equal(game.status, "Scheduled");
    await store.db.close();
  });
}
