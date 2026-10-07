import { test, expect } from "@playwright/test";
test("RTL public pages, navigation and responsive overflow", async ({
  page,
}) => {
  for (const width of [320, 360, 390, 430, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "طرابلس تستضيف أفريقيا" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1280 || width === 390)
      await page.screenshot({
        path: `test-results/home-${width}.png`,
        fullPage: true,
      });
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
test("admin authorization, manual game lifecycle, SSE and standings", async ({
  page,
  context,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
  let r = await context.request.post("/api/admin", {
    headers: { origin },
    data: { action: "save", kind: "pulse", value: {} },
  });
  expect(r.status()).toBe(401);
  r = await context.request.post("/api/admin", {
    headers: { origin: "https://evil.example" },
    data: { action: "login", password: "bad" },
  });
  expect(r.status()).toBe(403);
  await page.goto("/admin");
  await page.getByLabel("كلمة المرور").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "دخول آمن" }).click();
  await expect(
    page.getByRole("button", { name: "التحكم المباشر", exact: true }),
  ).toBeVisible();
  const id = "e2e-" + crypto.randomUUID();
  r = await context.request.post("/api/admin", {
    headers: { origin },
    data: {
      action: "save",
      kind: "games",
      value: {
        id,
        home: "al-ittihad",
        away: "stade-malien",
        group: "A",
        date: "2026-10-21T18:00:00+02:00",
      },
    },
  });
  expect(r.ok()).toBe(true);
  const publicPage = await context.newPage();
  await publicPage.goto("/matches/" + id);
  async function change(action: string, extra: object = {}) {
    const data = await (await context.request.get("/api/data")).json();
    const g = data.games.find((g: { id: string }) => g.id === id);
    const r = await context.request.post("/api/admin", {
      headers: { origin },
      data: { action, id, version: g.version, ...extra },
    });
    expect(r.ok()).toBe(true);
  }
  await change("status", { status: "Warmup" });
  await change("status", { status: "Live" });
  await change("score", { side: "home", points: 3 });
  await expect(publicPage.locator(".score")).toHaveText("3 : 0");
  await change("undo");
  await expect(publicPage.locator(".score")).toHaveText("0 : 0");
  await change("score", { side: "home", points: 2 });
  for (let q = 1; q < 4; q++) {
    await change("clock", { clock: 0, running: false });
    await change("clock", { quarter: q + 1, clock: 600, running: false });
  }
  await change("clock", { clock: 0, running: false });
  await change("status", { status: "Ended" });
  await expect(publicPage.locator(".match-scoreboard .tag")).toHaveText(
    "انتهت",
  );
  await publicPage.goto("/standings");
  await expect(publicPage.locator("tbody tr").first()).toContainText(
    "Al Ittihad",
  );
  await publicPage.close();
});
import { readFileSync } from "node:fs";
test("news publication, validated media and session revocation", async ({
  context,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
  const headers = { origin };
  let r = await context.request.post("/api/admin", {
    headers,
    data: { action: "login", password: process.env.E2E_PASSWORD },
  });
  expect(r.ok()).toBe(true);
  const id = "test-" + crypto.randomUUID();
  const article = {
    id,
    slug: id,
    title: "اختبار نشر معزول",
    excerpt: "محتوى اختبار",
    content: "نص اختبار داخل قاعدة البيانات المعزولة",
    author: "Test",
    publishedAt: new Date().toISOString(),
    status: "draft",
  };
  async function save(status: string) {
    const r = await context.request.post("/api/admin", {
      headers,
      data: { action: "save", kind: "news", value: { ...article, status } },
    });
    expect(r.ok()).toBe(true);
  }
  await save("draft");
  expect(await (await context.request.get("/news/" + id)).text()).toContain(
    "الصفحة غير موجودة",
  );
  await save("published");
  expect((await context.request.get("/news/" + id)).status()).toBe(200);
  await save("draft");
  expect(await (await context.request.get("/news/" + id)).text()).toContain(
    "الصفحة غير موجودة",
  );
  r = await context.request.post("/api/media", {
    headers,
    multipart: {
      file: {
        name: "icon.png",
        mimeType: "image/png",
        buffer: readFileSync("public/icon-192.png"),
      },
    },
  });
  expect(r.ok()).toBe(true);
  const media = await r.json();
  expect((await context.request.get(media.url)).headers()["content-type"]).toBe(
    "image/webp",
  );
  r = await context.request.post("/api/media", {
    headers,
    multipart: {
      file: {
        name: "bad.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      },
    },
  });
  expect(r.status()).toBe(400);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "road-session",
  )!;
  r = await context.request.post("/api/admin", {
    headers,
    data: { action: "logout" },
  });
  expect(r.ok()).toBe(true);
  r = await context.request.get("/api/admin", {
    headers: { cookie: "road-session=" + cookie.value },
  });
  expect(r.status()).toBe(401);
});
