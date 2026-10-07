import { test, expect } from "@playwright/test";
test("statistics enforce game membership, unique identity and render player ranking", async ({
  context,
  page,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001",
    headers = { origin };
  const post = (data: object) =>
    context.request.post("/api/admin", { headers, data });
  expect(
    (await post({ action: "login", password: process.env.E2E_PASSWORD })).ok(),
  ).toBe(true);
  const id = "stats-" + crypto.randomUUID(),
    player = "player-" + crypto.randomUUID(),
    outside = "outside-" + crypto.randomUUID();
  expect(
    (
      await post({
        action: "save",
        kind: "games",
        value: {
          id,
          home: "al-ittihad",
          away: "stade-malien",
          group: "A",
          date: "2026-10-21T18:00:00+02:00",
        },
      })
    ).ok(),
  ).toBe(true);
  for (const [pid, team, name] of [
    [player, "al-ittihad", "لاعب اختبار إحصائيات"],
    [outside, "spintex-knights", "لاعب خارج المباراة"],
  ]) {
    expect(
      (
        await post({
          action: "save",
          kind: "players",
          value: { id: pid, team, name, number: 7, position: "Guard" },
        })
      ).ok(),
    ).toBe(true);
  }
  const stat = {
    id: "stat-" + crypto.randomUUID(),
    game: id,
    player,
    points: 18,
    rebounds: 7,
    assists: 4,
    steals: 2,
    blocks: 1,
    efficiency: 23,
  };
  const save = (value: object) =>
    post({ action: "save", kind: "stats", value });
  expect((await save({ ...stat, player: outside })).status()).toBe(400);
  expect((await save({ ...stat, points: -1 })).status()).toBe(400);
  expect((await save(stat)).ok()).toBe(true);
  expect(
    (await save({ ...stat, id: "duplicate-" + crypto.randomUUID() })).status(),
  ).toBe(400);
  await page.goto("/stats");
  await expect(page.locator(".leaderboards")).toContainText(
    "لاعب اختبار إحصائيات",
  );
  await expect(page.locator(".leaderboards section").first()).toContainText(
    "18.0",
  );
  await page.goto("/players/" + player);
  await expect(
    page.getByRole("heading", { name: "لاعب اختبار إحصائيات", exact: true }),
  ).toBeVisible();
});
