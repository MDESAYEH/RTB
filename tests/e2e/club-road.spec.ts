import { test, expect } from "@playwright/test";
import fs from "node:fs";
const teams = JSON.parse(fs.readFileSync("lib/team-identity.json", "utf8"))
  .teams as { id: string; slug: string; logoAsset?: string }[];
test("road club DNA, registered logos, focal club and safe links on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const t of teams) {
    await page.goto("/teams/" + t.slug);
    await expect(page.locator(".club-road-spine")).toHaveCount(1);
    await expect(page.locator(".club-date-outline")).toHaveText("21—25");
    await expect(page.locator(".current-club")).toHaveAttribute(
      "data-team",
      t.id,
    );
    await expect(page.locator(".club-crest-block img")).toHaveCount(
      t.logoAsset ? 1 : 0,
    );
    expect(await page.locator(".team-editorial-prototype a a").count()).toBe(0);
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const check = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll(".hub-club")];
        const overlap = nodes.some((a, i) =>
          nodes.slice(i + 1).some((b) => {
            const x = a.getBoundingClientRect(),
              y = b.getBoundingClientRect();
            return (
              x.left < y.right &&
              x.right > y.left &&
              x.top < y.bottom &&
              x.bottom > y.top
            );
          }),
        );
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          overlap,
          animation: getComputedStyle(
            document.querySelector(".club-road-spine path")!,
          ).animationName,
        };
      });
      expect(check).toEqual({
        overflow: false,
        overlap: false,
        animation: "none",
      });
    }
  }
  expect(errors).toEqual([]);
});
