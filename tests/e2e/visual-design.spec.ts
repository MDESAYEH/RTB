import { test, expect } from "@playwright/test";

test("tournament navigation is route-aware and native mobile dialog keeps focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [path, section] of [
    ["/", "الرئيسية"],
    ["/teams/kriol-star", "الفرق"],
    ["/standings", "الترتيب"],
    ["/stats", "الإحصائيات"],
    ["/the-road", "THE ROAD"],
  ]) {
    await page.goto(path);

    await expect(
      page.locator(".tournament-nav [aria-current=page]"),
    ).toHaveText(section);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const trigger = page.getByRole("button", {
    name: "فتح قائمة البطولة",
  });

  await trigger.click();

  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();

  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );

  for (let i = 0; i < 13; i++) {
    await page.keyboard.press("Tab");

    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }

  await page.keyboard.press("Escape");

  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();

  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );

  await trigger.click();

  await dialog.getByRole("link", { name: /الفرق/ }).click();

  await expect(page).toHaveURL(/\/teams$/);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".team-line")).toHaveCount(10);

  expect(await page.locator("a a").count()).toBe(0);
});

test("reduced motion and narrow navigation preserve readability", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.setViewportSize({
    width: 320,
    height: 900,
  });

  await page.goto("/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({
      width,
      height: 900,
    });

    // انتظر دورة رسم واحدة بعد تغيير أبعاد الشاشة.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    const heroHeading = page.getByRole("heading", { level: 1 }).first();

    await expect(heroHeading).toBeVisible();

    expect(
      await heroHeading.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");

    if (width < 600) {
      const headingBox = await heroHeading.boundingBox();

      expect(headingBox).not.toBeNull();

      if (headingBox) {
        expect(headingBox.x).toBeGreaterThanOrEqual(0);

        expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(width + 1);

        expect(headingBox.width).toBeGreaterThan(0);

        expect(headingBox.height).toBeGreaterThan(0);
      }

      const firstParagraph = page.locator("main p:visible").first();

      if ((await firstParagraph.count()) > 0) {
        const paragraphBox = await firstParagraph.boundingBox();

        if (paragraphBox) {
          expect(paragraphBox.x).toBeGreaterThanOrEqual(0);

          expect(paragraphBox.x + paragraphBox.width).toBeLessThanOrEqual(
            width + 1,
          );
        }
      }
    }
  }
});
