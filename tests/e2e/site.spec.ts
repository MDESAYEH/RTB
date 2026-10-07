import { test, expect } from "@playwright/test";

test("RTL public pages, navigation and responsive overflow", async ({
  page,
}) => {
  for (const width of [320, 360, 390, 430, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // لا نربط الاختبار بعنوان Hero قديم.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    if (width === 1280 || width === 390) {
      await page.screenshot({
        path: `test-results/home-${width}.png`,
        fullPage: true,
      });
    }
  }

  for (const route of [
    "/matches",
    "/standings",
    "/teams",
    "/stats",
    "/road",
    "/news",
    "/admin",
    "/team/al-ittihad",
  ]) {
    await page.goto(route);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }

  await page.goto("/stats");

  await expect(
    page.getByRole("heading", {
      name: "ستظهر إحصائيات اللاعبين بعد انطلاق البطولة.",
    }),
  ).toBeVisible();
});
