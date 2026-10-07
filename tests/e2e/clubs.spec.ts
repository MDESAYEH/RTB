import { test, expect } from "@playwright/test";
import fs from "node:fs";
const registry = JSON.parse(
  fs.readFileSync("lib/team-identity.json", "utf8"),
) as { teams: { id: string; slug: string }[] };
test("all ten final club routes, redirects, group links and sparse verified layouts", async ({
  page,
  request,
}) => {
  for (const team of registry.teams) {
    const redirect = await request.get("/team/" + team.id, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe("/teams/" + team.slug);
    await page.goto("/teams/" + team.slug);
    await expect(page.locator(".club-name-block h1")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp("/teams/" + team.slug + "$"),
    );
    await expect(page.locator(".hub-opponents a")).toHaveCount(5);
    for (const href of await page
      .locator(".hub-opponents a")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href"))))
      expect(href).toMatch(/^\/teams\//);
    if (["red-flames", "nabaya-sofas", "as-douanes"].includes(team.id)) {
      await expect(page.locator(".club-podium")).toHaveCount(0);
      await expect(page.locator(".club-trophy-wall")).toHaveCount(0);
    }
    for (const width of [390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
