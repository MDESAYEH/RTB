import { test, expect } from "@playwright/test";
test("live commands: replay, concurrency, undo, invalid clock and audited corrections", async ({
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
  const id = "safety-" + crypto.randomUUID();
  expect(
    (
      await post({
        action: "save",
        kind: "games",
        value: {
          id: "invalid-" + id,
          home: "al-ittihad",
          away: "stade-malien",
          group: "A",
          date: "2026-10-21T18:00:00+02:00",
          periods: [{ home: 3, away: 0 }],
        },
      })
    ).status(),
  ).toBe(400);
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
  const current = async () =>
    (await (await context.request.get("/api/data")).json()).games.find(
      (g: { id: string }) => g.id === id,
    );
  const change = async (action: string, extra: object = {}) =>
    post({ action, id, version: (await current()).version, ...extra });
  expect((await change("status", { status: "Warmup" })).ok()).toBe(true);
  expect((await change("status", { status: "Live" })).ok()).toBe(true);
  const snapshot = await current(),
    requestId = crypto.randomUUID();
  const command = {
    action: "score",
    id,
    version: snapshot.version,
    side: "home",
    points: 3,
    requestId,
  };
  const replay = await Promise.all([post(command), post(command)]);
  expect(replay.map((r) => r.status())).toEqual([200, 200]);
  expect((await current()).homeScore).toBe(3);
  const before = await current();
  const concurrent = await Promise.all([
    post({
      ...command,
      version: before.version,
      requestId: crypto.randomUUID(),
    }),
    post({
      ...command,
      version: before.version,
      requestId: crypto.randomUUID(),
    }),
  ]);
  expect(concurrent.map((r) => r.status()).sort()).toEqual([200, 409]);
  expect((await current()).homeScore).toBe(6);
  expect((await change("undo")).ok()).toBe(true);
  expect((await current()).homeScore).toBe(3);
  expect((await change("undo")).ok()).toBe(true);
  expect((await current()).homeScore).toBe(0);
  expect((await change("undo")).status()).toBe(400);
  for (const extra of [
    { clock: -1 },
    { clock: 601 },
    { clock: 1.5 },
    { quarter: 4 },
    { running: true, clock: NaN },
  ])
    expect((await change("clock", extra)).status()).toBe(400);
  expect((await change("score", { points: 3 })).status()).toBe(400);
  expect((await change("status", { status: "Ended" })).status()).toBe(400);
  const g = await current();
  const corrected = {
    ...g,
    status: "Ended",
    homeScore: 80,
    awayScore: 70,
    quarter: 4,
    clock: 0,
    periods: [
      { home: 20, away: 18 },
      { home: 20, away: 17 },
      { home: 20, away: 17 },
      { home: 20, away: 18 },
    ],
  };
  expect(
    (
      await change("correct", {
        value: corrected,
        confirmed: true,
        reason: "تثبيت نتيجة اختبار معزولة",
      })
    ).ok(),
  ).toBe(true);
  expect((await change("score", { points: 1, side: "home" })).status()).toBe(
    400,
  );
  expect((await change("status", { status: "Live" })).status()).toBe(400);
  expect(
    (
      await change("correct", {
        value: { ...corrected, homeScore: -1 },
        confirmed: true,
        reason: "تصحيح نتيجة غير صالحة",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await change("correct", {
        value: { ...corrected, homeScore: 81 },
        confirmed: true,
        reason: "تصحيح مجموع غير متطابق",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await change("correct", {
        value: {
          ...corrected,
          status: "Live",
          quarter: 2,
          clock: 100,
          periods: [
            { home: 40, away: 35 },
            { home: 40, away: 35 },
          ],
        },
        reason: "إعادة فتح دون تأكيد",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await change("correct", {
        value: {
          ...corrected,
          status: "Live",
          quarter: 2,
          clock: 100,
          periods: [
            { home: 40, away: 35 },
            { home: 40, away: 35 },
          ],
        },
        confirmed: true,
        reason: "تصحيح الفترة وإعادة فتح مقصودة",
      })
    ).ok(),
  ).toBe(true);
  expect((await change("clock", { quarter: 1 })).status()).toBe(400);
  const audit = (await (await context.request.get("/api/admin")).json()).audit;
  expect(
    audit.some(
      (a: { target: string; reason: string }) =>
        a.target === id && a.reason === "تصحيح الفترة وإعادة فتح مقصودة",
    ),
  ).toBe(true);
  await page.goto("/matches/" + id);
  await expect(page.locator(".score")).toHaveText("80 : 70");
  await page.reload();
  await expect(page.locator(".score")).toHaveText("80 : 70");
  const tab = await context.newPage();
  await tab.goto("/matches/" + id);
  expect((await change("score", { points: 2, side: "home" })).ok()).toBe(true);
  await expect(page.locator(".score")).toHaveText("82 : 70");
  await expect(tab.locator(".score")).toHaveText("82 : 70");
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("أنت غير متصل");
  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 15000 });
  await page.goto("/admin");
  await page.getByLabel("المباراة", { exact: true }).selectOption(id);
  await page
    .getByRole("button", { name: "إضافة 3 إلى Al Ittihad", exact: true })
    .dblclick();
  await expect(page.locator(".live-room strong").first()).toHaveText("85");
  expect((await current()).homeScore).toBe(85);
  for (const [points, total] of [
    [1, 86],
    [2, 88],
  ]) {
    await expect(page.locator(".admin")).toHaveAttribute("aria-busy", "false");
    await page
      .getByRole("button", {
        name: "إضافة " + points + " إلى Al Ittihad",
        exact: true,
      })
      .dblclick();
    await expect(page.locator(".live-room strong").first()).toHaveText(
      String(total),
    );
  }
  for (const total of [86, 85, 82]) {
    await expect(page.locator(".admin")).toHaveAttribute("aria-busy", "false");
    await page
      .getByRole("button", { name: "تراجع / Undo", exact: true })
      .click();
    await expect(page.locator(".live-room strong").first()).toHaveText(
      String(total),
    );
  }
  const adminTab = await context.newPage();
  await adminTab.route("**/api/live", (route) => route.abort());
  await adminTab.goto("/admin");
  await adminTab.getByLabel("المباراة", { exact: true }).selectOption(id);
  await expect(page.locator(".admin")).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", { name: "إضافة 1 إلى Al Ittihad", exact: true })
    .click();
  await expect(page.locator(".live-room strong").first()).toHaveText("83");
  await adminTab
    .getByRole("button", { name: "إضافة 2 إلى Al Ittihad", exact: true })
    .click();
  await expect(adminTab.locator('.admin [role="alert"]')).toContainText(
    "محرر آخر",
  );
  expect((await current()).homeScore).toBe(83);
  await adminTab.close();
  const auditNow = (await (await context.request.get("/api/admin")).json())
    .audit;
  const logged = auditNow.find(
    (a: { target: string; action: string }) =>
      a.target === id && a.action === "score",
  );
  expect(logged.actor).toBe("admin");
  expect(JSON.parse(logged.new).homeScore).toBe(
    JSON.parse(logged.old).homeScore + 1,
  );
  expect(Number.isFinite(Date.parse(logged.time))).toBe(true);
  const version = (await current()).version;
  await page.getByRole("button", { name: "انتهت", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await current()).version).toBe(version);
  await page.goto("/matches/" + id);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".match-scoreboard .tag.live")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await tab.close();
});
test("public SSE handshake, heartbeat, reconnect and no private records", async () => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
  for (const last of [undefined, "0", "999999"]) {
    const controller = new AbortController();
    const response = await fetch(origin + "/api/live", {
      headers: last ? { "Last-Event-ID": last } : {},
      signal: controller.signal,
    });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader(),
      decoder = new TextDecoder();
    let text = "";
    while (!text.includes("event: heartbeat")) {
      text += decoder.decode((await reader.read()).value);
    }
    expect(text).toContain("retry: 2000");
    expect(text).toMatch(/id: \d+/);
    expect(text).not.toContain("admin");
    expect(text).not.toContain("road-session");
    controller.abort();
  }
});
test("media rejects forged images and public news escapes executable HTML", async ({
  context,
  page,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001",
    headers = { origin };
  await context.request.post("/api/admin", {
    headers,
    data: { action: "login", password: process.env.E2E_PASSWORD },
  });
  for (const file of [
    {
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    },
    {
      name: "../escape.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake"),
    },
    { name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5242881) },
  ]) {
    const r = await context.request.post("/api/media", {
      headers,
      multipart: { file },
    });
    expect([400, 413]).toContain(r.status());
  }
  const id = "xss-" + crypto.randomUUID(),
    text =
      '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
  const r = await context.request.post("/api/admin", {
    headers,
    data: {
      action: "save",
      kind: "news",
      value: {
        id,
        slug: id,
        title: "خبر اختبار أمان",
        excerpt: "اختبار",
        content: text,
        author: "QA",
        publishedAt: new Date().toISOString(),
        status: "published",
      },
    },
  });
  expect(r.ok()).toBe(true);
  await page.goto("/news/" + id);
  await expect(page.locator(".article-body")).toHaveText(text);
  expect(await page.evaluate(() => "__xss" in window)).toBe(false);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    origin + "/news/" + id,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "خبر اختبار أمان",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  expect(
    (await context.request.get("/api/og?type=news&id=" + id)).status(),
  ).toBe(200);
});
