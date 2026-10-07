import { test, expect } from "@playwright/test";
test("journey route, metadata, security headers and sustained quiet-connection warning", async ({
  page,
  context,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/the-road");
    await expect(
      page.getByRole("heading", { name: "THE ROAD", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".road-step")).toHaveCount(5);
    await page.reload();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      origin + "/the-road",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "THE ROAD",
    );
  }
  await page.goto("/");
  await page.getByRole("link", { name: "THE ROAD ↗", exact: true }).click();
  await expect(page).toHaveURL(/\/the-road$/);
  const sitemap = await context.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/the-road");
  expect(await sitemap.text()).not.toContain("/admin");
  const robots = await context.request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /admin");
  const response = await context.request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(
    (
      await context.request.post("/api/admin", {
        headers: { origin },
        data: "x".repeat(100001),
      })
    ).status(),
  ).toBe(413);
  let waiting: import("@playwright/test").Route | undefined;
  await page.route("**/api/live", (route) => {
    waiting = route;
  });
  await page.goto("/matches");
  await expect(page.getByRole("status")).toContainText("أنت غير متصل", {
    timeout: 14000,
  });
  await waiting?.abort();
  await page.unroute("**/api/live");
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 15000 });
});
test("login cookie flags", async ({ context }) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
  const r = await context.request.post("/api/admin", {
    headers: { origin },
    data: { action: "login", password: process.env.E2E_PASSWORD },
  });
  expect(r.ok()).toBe(true);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "road-session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect(cookie.secure).toBe(false);
  // HTTP test origin: Secure transport itself is checked separately under configured HTTPS.
});
