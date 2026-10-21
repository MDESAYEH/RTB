import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTournamentStore } from "../lib/store";
import type { DatabaseConfig } from "../lib/sql-database";
import { extractPayload, parseEventPage } from "../lib/providers/fiba/parser";
import {
  runSync as syncWithAuthority,
  runGamesSync,
  forgetSyncContext,
} from "../lib/providers/fiba/apply";
import type { Game, Team } from "../lib/domain";

// Legacy opt-out remains available; the production runner now defaults to FIBA authority.
const runSync: typeof syncWithAuthority = (store, options = { apply: true }) =>
  syncWithAuthority(store, {
    ...options,
    plan: { ...options.plan, authoritative: false },
  });
const load = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
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
  Promise.resolve(
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  );

/** A FIBA games page whose first game is Al Ittihad v Stade Malien with the given facts. */
function gamesPage(facts: Partial<Row> = {}): string {
  return rewrap(baseGames, (data) => {
    const teams = data.teams as Row[];
    const side = (slug: string) => {
      const team = teams.find((row) => row.slug === slug);
      assert.ok(team);
      return {
        teamId: team.teamId,
        code: team.code,
        officialName: team.officialName,
      };
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
  (url: string) => {
    if (url.includes("/game-live-info/")) {
      const source = parseEventPage(pages.games ?? baseGames).games[0];
      const raw = JSON.parse(load("fiba-live-game.json"));
      const g = raw.game.content;
      g.id = source.gameId;
      g.technicalName = source.gameName;
      g.c[0].Code = source.teamA!.code;
      g.c[1].Code = source.teamB!.code;
      g.c[0].Score = source.teamAScore;
      g.c[1].Score = source.teamBScore;
      g.CurrentPeriod = "Q1";
      g.RC = "09:37";
      g.quartersScores = [
        { period: "Q1", teamA: source.teamAScore, teamB: source.teamBScore },
      ];
      return Promise.resolve(
        new Response(JSON.stringify(raw), {
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return respond(
      url.endsWith("/games")
        ? (pages.games ?? baseGames)
        : url.endsWith("/standings")
          ? (pages.standings ?? baseStandings)
          : (pages.leaders ?? baseLeaders),
    );
  };

function officialTeamPage(team: ReturnType<typeof parseEventPage>["teams"][number]) {
  const playerId = team.teamId * 100;
  const body = {
    profile: { teamId: team.teamId, countryName: "Libya" },
    players: [
      {
        personId: playerId,
        firstName: "Official",
        lastName: team.code ?? "Player",
        uniformNumber: "8",
        position: "Guard",
        isOnFinalRoster: true,
        clubId: team.organisationId,
      },
    ],
  };
  return `<script>self.__next_f.push([1,${JSON.stringify("0:" + JSON.stringify(body))}])</script>`;
}
function authorityFetcher(url: string) {
  if (url.includes("/teams/")) {
    const slug = new URL(url).pathname.split("/").at(-1)!;
    const team = parseEventPage(baseGames).teams.find((candidate) => candidate.slug === slug);
    assert.ok(team, `unknown team page ${slug}`);
    return respond(officialTeamPage(team));
  }
  return fetcher()(url);
}

const backends: [string, (dir: string) => DatabaseConfig][] = [
  ["SQLite", (dir) => ({ kind: "sqlite", path: join(dir, "t.db") })],
  ["libSQL", (dir) => ({ kind: "libsql", url: `file:${join(dir, "t.db")}` })],
];

for (const [label, config] of backends) {
  const fresh = () => {
    const store = createTournamentStore(() =>
      config(mkdtempSync(join(tmpdir(), "fiba-sync-"))),
    );
    return store;
  };
  const alias = {
    aliases: { "nadi-basket-staoueli": "nb-staoueli" },
    confirmedSpellings: [] as string[],
    // These tests cover following FIBA's group tables; locked placement and withdrawals have their own tests below.
    lockGroups: false,
    withdrawnTeams: [] as string[],
    // A fixed clock before kickoff: the tests must not depend on the real time of day (live reads only open around a match).
    now: "2026-10-21T10:00:00Z",
  };

  test(`${label}: teams and groups are imported from FIBA group tables; unreviewed teams are not merged`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    const unreviewed = {
      aliases: {},
      lockGroups: false,
      withdrawnTeams: [] as string[],
    };
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: unreviewed,
    });
    assert.equal(result.counts["teams.skipped"], 1);
    const skipped = result.plan.entries.find(
      (entry) => entry.action === "skipped",
    );
    assert.equal(skipped?.id, "nadi-basket-staoueli");
    assert.match(skipped?.reason ?? "", /no reviewed match/);
    // FIBA spells it "Energie BBC"; it is the primary source, so the local name follows.
    assert.equal(
      (await store.get<Team>("teams", "energie-bc"))?.name,
      "Energie BBC",
    );
    assert.equal((await store.provider.getTeams()).length, 10);
    assert.ok(
      result.plan.notes.some((note) => /slot not assigned by FIBA/.test(note)),
    );
    assert.ok(
      result.plan.notes.some((note) =>
        /FIBA group C .* outside the local tournament groups/.test(note),
      ),
    );
    // A seeded (non-manual) record whose group disagrees is corrected from the group table.
    const kriol = (await store.get<Team>("teams", "kriol-star"))!;
    await store.write("teams", "kriol-star", { ...kriol, group: "B" }, "seed");
    await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: unreviewed,
    });
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
    assert.equal(
      staoueli.verified,
      false,
      "spelling stays flagged unless it is in the confirmed list",
    );
    await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: { ...alias, confirmedSpellings: ["nb-staoueli"] },
    });
    assert.equal(
      (await store.get<Team>("teams", "nb-staoueli"))?.verified,
      true,
      "a confirmed spelling is marked verified by the next sync",
    );
    // Group B's unassigned slot is never filled; an explicitly approved FIBA team is created.
    const approved = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: {
        aliases: {},
        approvedNewTeams: ["nadi-basket-staoueli"],
        lockGroups: false,
        withdrawnTeams: [] as string[],
      },
    });
    assert.equal(
      (await store.get<Team>("teams", "nadi-basket-staoueli"))?.country,
      "",
    );
    assert.equal(approved.counts["teams.create"], 1);
    await store.db.close();
  });

  test(`${label}: official FIBA team rosters are published as members on the team page`, async () => {
    const store = fresh();
    await syncWithAuthority(store, {
      apply: true,
      fetchImpl: authorityFetcher,
      plan: alias,
    });
    const spintex = parseEventPage(baseGames).teams.find(
      (team) => team.slug === "spintex-knights",
    )!;
    assert.deepEqual(
      await store.get("players", `fiba-player-${spintex.teamId * 100}`),
      {
        id: `fiba-player-${spintex.teamId * 100}`,
        team: "spintex-knights",
        name: "Official SPK",
        number: 8,
        position: "Guard",
      },
    );
    await store.db.close();
  });

  test(`${label}: the local 4 / 4 draw is kept and withdrawn clubs are removed, not moved`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    // Drift that FIBA's tables would otherwise copy: a team moved to the wrong group locally.
    const kriol = (await store.get<Team>("teams", "kriol-star"))!;
    await store.write("teams", "kriol-star", { ...kriol, group: "B" }, "seed");
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: { aliases: {}, lockGroups: true },
    });
    const teams = await store.provider.getTeams();
    const ids = (group: string) =>
      teams
        .filter((t) => t.group === group)
        .map((t) => t.id)
        .sort();
    assert.deepEqual(ids("A"), [
      "al-ittihad",
      "kriol-star",
      "nb-staoueli",
      "stade-malien",
    ]);
    assert.deepEqual(ids("B"), [
      "energie-bc",
      "nabaya-sofas",
      "npa-pythons",
      "spintex-knights",
    ]);
    assert.equal(
      teams.length,
      8,
      "the two clubs that withdrew are gone and nobody is added",
    );
    assert.equal(await store.get("teams", "as-douanes"), undefined);
    assert.equal(await store.get("teams", "red-flames"), undefined);
    assert.equal(result.counts["teams.remove"], 2);
    // Other details still come from FIBA.
    assert.equal(
      (await store.get<Team>("teams", "energie-bc"))?.name,
      "Energie BBC",
    );
    assert.ok(result.plan.notes.some((n) => /fixed locally/.test(n)));
    assert.ok(
      !result.plan.entries.some(
        (e) => e.kind === "teams" && e.action === "create",
      ),
    );
    // The removal is audited and a second run changes nothing more.
    const audit = (await store.db
      .prepare("SELECT COUNT(*) AS n FROM audit WHERE action='fiba-remove'")
      .get()) as { n: number };
    assert.equal(audit.n, 2);
    const again = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: { aliases: {}, lockGroups: true },
    });
    assert.equal(again.counts["teams.remove"] ?? 0, 0);
    await store.db.close();
  });

  test(`${label}: a withdrawn club that still has players is kept and reported instead of breaking references`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    await store.write(
      "players",
      "p-douanes",
      {
        id: "p-douanes",
        name: "Test Player",
        team: "as-douanes",
        number: 7,
        position: "G",
      },
      "admin",
    );
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: { aliases: {}, lockGroups: true },
    });
    assert.ok(
      await store.get("teams", "as-douanes"),
      "still referenced, so not removed",
    );
    assert.equal(
      await store.get("teams", "red-flames"),
      undefined,
      "unreferenced one is removed",
    );
    assert.ok(
      result.plan.entries.some(
        (e) =>
          e.id === "as-douanes" &&
          e.action === "skipped" &&
          /still referenced/.test(e.reason),
      ),
    );
    await store.db.close();
  });

  test(`${label}: a match the organisers score by hand keeps its status and score; the date still follows FIBA`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage() }),
      plan: alias,
    });
    const [created] = await store.provider.getGames();
    // The organisers take the match: started and 2-0 by hand (written as the sync actor so the test covers the manual flag itself, not the audit-trail override).
    await store.write(
      "games",
      created.id,
      {
        ...created,
        manual: true,
        status: "Live",
        homeScore: 2,
        awayScore: 0,
        version: created.version + 1,
      },
      "fiba-sync",
    );
    // FIBA's feed still says "Scheduled 0-0" at a later time: only the date moves.
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({
        games: gamesPage({
          gameDateTimeUTC: "2026-10-21T15:15:00",
          teamAScore: 0,
          teamBScore: 0,
        }),
      }),
      plan: alias,
    });
    assert.equal(result.counts["games.update"], 1);
    const game = (await store.provider.getGame(created.id))!;
    assert.deepEqual(
      [game.status, game.homeScore, game.awayScore],
      ["Live", 2, 0],
    );
    assert.equal(game.date, "2026-10-21T15:15:00Z");
    assert.equal(game.manual, true);
    // Handed back to FIBA, the feed's numbers are used again.
    await store.write(
      "games",
      created.id,
      { ...game, manual: false, version: game.version + 1 },
      "fiba-sync",
    );
    await runSync(store, {
      apply: true,
      fetchImpl: fetcher({
        games: gamesPage({
          gameDateTimeUTC: "2026-10-21T15:15:00",
          teamAScore: 5,
          teamBScore: 4,
          isLive: true,
        }),
      }),
      plan: alias,
    });
    const back = (await store.provider.getGame(created.id))!;
    assert.deepEqual([back.homeScore, back.awayScore], [5, 4]);
    await store.db.close();
  });

  test(`${label}: during a match individual live data is read without standings or team fetches`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    forgetSyncContext();
    const manualFeed = {
      ...alias,
      authoritative: false,
      now: "2026-10-21T15:20:00Z",
    };
    // Nothing remembered yet: the first call is a complete sync.
    const first = await runGamesSync(store, {
      fetchImpl: fetcher({ games: gamesPage() }),
      plan: manualFeed,
    });
    assert.equal(first.mode, "full");
    const [created] = await store.provider.getGames();
    const teamsBefore = JSON.stringify(await store.provider.getTeams());

    const requested: string[] = [];
    const counting = (pages: { games?: string }) => (url: string) => {
      requested.push(url.split("/").pop() ?? url);
      return fetcher(pages)(url);
    };
    const live = gamesPage({ isLive: true, teamAScore: 12, teamBScore: 9 });
    const quick = await runGamesSync(store, {
      fetchImpl: counting({ games: live }),
      plan: manualFeed,
    });
    assert.equal(quick.mode, "games");
    assert.equal(quick.changed, 1);
    assert.deepEqual(
      requested,
      ["detail"],
      "live detail and match metadata without standings, leaders or team pages",
    );
    const game = (await store.provider.getGame(created.id))!;
    assert.deepEqual(
      [game.status, game.homeScore, game.awayScore],
      ["Live", 12, 9],
    );
    assert.equal(
      JSON.stringify(await store.provider.getTeams()),
      teamsBefore,
      "teams untouched",
    );

    // Nothing new on FIBA: nothing written and nothing logged.
    const runsBefore = (
      (await store.db
        .prepare("SELECT COUNT(*) AS n FROM fiba_sync_runs")
        .get()) as { n: number }
    ).n;
    const quiet = await runGamesSync(store, {
      fetchImpl: counting({ games: live }),
      plan: manualFeed,
    });
    assert.equal(quiet.changed, 0);
    const runsAfter = (
      (await store.db
        .prepare("SELECT COUNT(*) AS n FROM fiba_sync_runs")
        .get()) as { n: number }
    ).n;
    assert.equal(runsAfter, runsBefore);

    // A broken schedule cannot block live Q3 updates: the individual feed is sufficient.
    const thirdQuarter = async (url: string) => {
      assert.ok(
        !url.endsWith("/games"),
        "live runs must not request the games list",
      );
      const response = await fetcher({ games: live })(url);
      const raw = await response.json();
      const g = raw.game.content;
      g.CurrentPeriod = "Q3";
      g.RC = "08:13";
      g.c[0].Score = 15;
      g.c[1].Score = 9;
      g.quartersScores = [
        { period: "Q1", teamA: 12, teamB: 9 },
        { period: "Q2", teamA: 0, teamB: 0 },
        { period: "Q3", teamA: 3, teamB: 0 },
        { period: "Q4", teamA: 0, teamB: 0 },
      ];
      return Response.json(raw);
    };
    await runGamesSync(store, { fetchImpl: thirdQuarter, plan: manualFeed });
    const q3 = (await store.provider.getGame(created.id))!;
    assert.deepEqual(
      [q3.quarter, q3.clock, q3.homeScore, q3.awayScore],
      [3, 493, 15, 9],
    );
    const unavailable = await runGamesSync(store, {
      fetchImpl: async (url) => {
        assert.ok(!url.endsWith("/games"));
        return new Response("unavailable", { status: 503 });
      },
      plan: manualFeed,
    });
    assert.equal(unavailable.changed, 0);
    assert.deepEqual(
      await store.provider.getGame(created.id),
      q3,
      "a live feed failure retains the last confirmed snapshot",
    );
    await store.db.close();
  });

  test(`${label}: a fixture with an undecided opponent is skipped instead of breaking the sync`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    const page = rewrap(baseGames, (data) => {
      const games = data.games as Row[];
      games[0] = { ...games[0], teamB: null };
    });
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: page }),
      plan: { aliases: {}, lockGroups: true },
    });
    assert.ok(
      result.plan.entries.some(
        (e) => e.kind === "games" && /opponent not decided/.test(e.reason),
      ),
    );
    await store.db.close();
  });

  test(`${label}: games are imported only when fully published, individual live results update score, clock and periods`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    // Unpublished date: nothing is created.
    const none = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: baseGames }),
      plan: alias,
    });
    assert.equal((await store.provider.getGames()).length, 0);
    assert.ok(
      none.plan.entries
        .filter((entry) => entry.kind === "games")
        .every((entry) => entry.action === "skipped"),
    );

    await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage() }),
      plan: alias,
    });
    const [created] = await store.provider.getGames();
    assert.equal(created.id.startsWith("fiba-"), true);
    assert.equal(created.home, "al-ittihad");
    assert.equal(created.away, "stade-malien");
    assert.equal(created.status, "Scheduled");
    assert.equal(created.date, "2026-10-21T15:00:00Z");
    assert.equal(created.venue, "");

    // The individual feed replaces both stale list scores and the local clock.
    await store.write(
      "games",
      created.id,
      { ...created, clock: 123, quarter: 3 },
      "fiba-sync",
    );
    const live = gamesPage({
      isLive: true,
      teamAScore: 41,
      teamBScore: 38,
      venueName: "Tripoli Arena",
    });
    let feedStatus = 3;
    let feedClock = "08:20";
    let feedPeriod = "Q2";
    let liveRequests = 0;
    const liveFetcher =
      (page = live) =>
      async (url: string) => {
        if (!url.includes("/game-live-info/"))
          return fetcher({ games: page })(url);
        liveRequests++;
        const raw = JSON.parse(load("fiba-live-game.json"));
        const source = parseEventPage(page).games[0];
        const g = raw.game.content;
        g.status = feedStatus;
        g.id = source.gameId;
        g.technicalName = source.gameName;
        g.c[0].Code = source.teamA!.code;
        g.c[1].Code = source.teamB!.code;
        g.c[0].Score = 41;
        g.c[1].Score = 38;
        g.CurrentPeriod = feedPeriod;
        g.RC = feedClock;
        g.quartersScores = [
          { period: "Q1", teamA: 24, teamB: 28 },
          { period: "Q2", teamA: 17, teamB: 10 },
          { period: "Q3", teamA: 0, teamB: 0 },
          { period: "Q4", teamA: 0, teamB: 0 },
        ];
        return new Response(JSON.stringify(raw), {
          headers: { "content-type": "application/json" },
        });
      };
    const livePlan = { ...alias, now: "2026-10-21T15:20:00Z" };
    const updated = await runSync(store, {
      apply: true,
      fetchImpl: liveFetcher(),
      plan: livePlan,
    });
    assert.equal(updated.counts["games.update"], 1);
    const game = (await store.provider.getGame(created.id))!;
    assert.deepEqual(
      [game.status, game.homeScore, game.awayScore, game.venue],
      ["Live", 41, 38, "Tripoli Arena"],
    );
    assert.deepEqual([game.clock, game.quarter], [500, 2]);
    assert.equal(game.version, created.version + 1);

    // Same data again: nothing to do. FIBA later omits the venue: the stored one is kept.
    const again = await runSync(store, {
      apply: true,
      fetchImpl: liveFetcher(),
      plan: livePlan,
    });
    assert.equal(again.counts["games.unchanged"], 1);
    feedClock = "08:10";
    const fastLive = await runGamesSync(store, {
      fetchImpl: liveFetcher(),
      plan: { ...livePlan, authoritative: false },
    });
    assert.equal(fastLive.mode, "games");
    assert.equal(
      (await store.provider.getGame(created.id))?.clock,
      490,
      "fast sync reads the individual live feed",
    );

    await runSync(store, {
      apply: true,
      fetchImpl: liveFetcher(
        gamesPage({
          isLive: true,
          teamAScore: 41,
          teamBScore: 38,
          venueName: null,
        }),
      ),
      plan: livePlan,
    });
    assert.equal(
      (await store.provider.getGame(created.id))?.venue,
      "Tripoli Arena",
    );
    // The known individual live status wins over an unknown stale list status.
    const odd = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage({ statusCode: "SOMETHING_NEW" }) }),
      plan: alias,
    });
    assert.equal(
      odd.plan.entries.find((entry) => entry.kind === "games")?.action,
      "update",
    );
    assert.equal((await store.provider.getGame(created.id))?.status, "Live");
    // FIBA's live feed can still say Running at the final horn.
    feedStatus = 3;
    feedClock = "00:00";
    feedPeriod = "Q4";
    await runSync(store, {
      apply: true,
      fetchImpl: liveFetcher(),
      plan: livePlan,
    });
    assert.equal((await store.provider.getGame(created.id))?.status, "Ended");
    const requestsAtEnd = liveRequests;
    await runSync(store, {
      apply: true,
      fetchImpl: liveFetcher(),
      plan: livePlan,
    });
    assert.equal(
      liveRequests,
      requestsAtEnd,
      "finished matches stop fetching live details",
    );
    assert.equal(
      (await store.provider.getGame(created.id))?.status,
      "Ended",
      "stale list cannot reopen a finished match",
    );
    await store.db.close();
  });

  test(`${label}: the shipped alias links Staoueli by default; a hand-entered fixture is not duplicated`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    // No plan options: the reviewed alias in aliases.ts applies.
    const first = await runSync(store, { apply: true, fetchImpl: fetcher() });
    assert.equal(first.counts["teams.skipped"] ?? 0, 0);
    assert.equal(
      (await store.get<Team>("teams", "nb-staoueli"))?.name,
      "Nadi Basket Staoueli",
    );
    // An admin already entered Al Ittihad v Stade Malien by hand.
    await store.write(
      "games",
      "manual-1",
      {
        id: "manual-1",
        home: "al-ittihad",
        away: "stade-malien",
        group: "A",
        date: "2026-10-21T16:00:00+02:00",
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
      },
      "admin",
    );
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage() }),
    });
    const entry = result.plan.entries.find(
      (candidate) => candidate.kind === "games",
    );
    assert.equal(entry?.action, "skipped");
    assert.match(entry?.reason ?? "", /manual-1/);
    assert.equal((await store.provider.getGames()).length, 1);
    await store.db.close();
  });

  test(`${label}: manual overrides are never overwritten`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage() }),
      plan: alias,
    });
    const [game] = await store.provider.getGames();
    // An admin corrects the score and renames a team.
    await store.write(
      "games",
      game.id,
      { ...game, homeScore: 99, version: game.version + 1 },
      "admin",
    );
    const energie = (await store.get<Team>("teams", "energie-bc"))!;
    await store.write(
      "teams",
      "energie-bc",
      { ...energie, name: "Énergie BC" },
      "admin",
    );
    const result = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({
        games: gamesPage({ isLive: true, teamAScore: 5, teamBScore: 6 }),
      }),
      plan: alias,
    });
    assert.equal(result.counts["games.ignored"], 1);
    assert.ok(
      result.plan.entries.some(
        (entry) => entry.id === "energie-bc" && entry.action === "ignored",
      ),
    );
    assert.equal((await store.provider.getGame(game.id))?.homeScore, 99);
    assert.equal(
      (await store.get<Team>("teams", "energie-bc"))?.name,
      "Énergie BC",
    );
    // Scripted reviews are tooling, not supervisors: they do not freeze a record.
    const douanes = (await store.get<Team>("teams", "as-douanes"))!;
    await store.write(
      "teams",
      "as-douanes",
      { ...douanes, name: "AS Douanes (reviewed)" },
      "source-review:FIBA-test",
    );
    const later = await runSync(store, {
      apply: true,
      fetchImpl: fetcher(),
      plan: alias,
    });
    assert.equal(
      later.plan.entries.find((entry) => entry.id === "as-douanes")?.action,
      "update",
    );
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
      await assert.rejects(
        runSync(store, { apply: true, fetchImpl: fetcher(pages), plan: alias }),
      );
    }
    assert.equal(await store.revision(), before, "no data was written");
    const runs = (await store.db
      .prepare("SELECT status,error FROM fiba_sync_runs")
      .all()) as { status: string; error: string }[];
    assert.equal(runs.length, broken.length);
    assert.ok(runs.every((run) => run.status === "failed" && run.error));
    await store.db.close();
  });

  test(`${label}: dry run writes nothing; applied runs keep a complete sync log and audit trail`, async () => {
    const store = fresh();
    await store.provider.getTeams();
    const before = await store.revision();
    const dry = await runSync(store, {
      apply: false,
      fetchImpl: fetcher({ games: gamesPage() }),
      plan: alias,
    });
    assert.equal(dry.runId, null);
    assert.equal(await store.revision(), before);
    assert.equal(
      (
        await store.db
          .prepare("SELECT name FROM sqlite_master WHERE name='fiba_sync_runs'")
          .all()
      ).length,
      0,
      "dry run does not even create log tables",
    );
    assert.equal((await store.provider.getGames()).length, 0);

    const applied = await runSync(store, {
      apply: true,
      fetchImpl: fetcher({ games: gamesPage() }),
      plan: alias,
    });
    const entries = (await store.db
      .prepare("SELECT kind,id,action FROM fiba_sync_entries WHERE run_id=?")
      .all(applied.runId!)) as { kind: string; id: string; action: string }[];
    assert.equal(entries.length, applied.plan.entries.length);
    assert.ok(
      entries.some(
        (entry) => entry.kind === "games" && entry.action === "create",
      ),
    );
    const audited = (await store.db
      .prepare(
        "SELECT action FROM audit WHERE actor='fiba-sync' AND kind='games'",
      )
      .all()) as { action: string }[];
    assert.deepEqual(
      audited.map((row) => row.action),
      ["fiba-create"],
    );
    const game = (await store.provider.getGames())[0] as Game;
    assert.equal(game.status, "Scheduled");
    await store.db.close();
  });
}

test("a reduced 'today' games widget on a match-day page does not break the parser", async () => {
  const { parseEventPage } = await import("../lib/providers/fiba/parser");
  const before = parseEventPage(baseGames).games.length;
  const page = rewrap(baseGames, (data) => {
    const [first] = data.games as Row[];
    data.todayWidget = {
      games: [
        {
          gameId: first.gameId,
          status: "INIT",
          date: "$D2026-10-21T09:00:00.000Z",
          hasTimeGameDateTime: true,
        },
      ],
    };
  });
  assert.equal(parseEventPage(page).games.length, before);
  // A page whose full list is missing or malformed still fails closed.
  const broken = rewrap(baseGames, (data) => {
    data.games = [{ gameId: 1, gameName: "x" }];
  });
  assert.throws(() => parseEventPage(broken));
});
