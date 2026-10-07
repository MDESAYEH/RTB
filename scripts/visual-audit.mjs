import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const stage = process.argv[2] || "baseline";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const root = `verification/phase2/${stage}`;
mkdirSync(root, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const errors = [],
  expectedUnauthorized = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  if (page.url() === base + "/admin" && message.location().url === base + "/api/admin" && message.text().includes("401 (Unauthorized)") && !stage.startsWith("fixture")) {
    expectedUnauthorized.push({ url: message.location().url, status: 401 });
    return;
  }
  errors.push(message.text());
});
await page.addInitScript(() => {
  window.__metrics = { lcp: 0, cls: 0 };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__metrics.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (!e.hadRecentInput) window.__metrics.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
});
const data = await (await page.request.get(base + "/api/data")).json();
if (stage.startsWith("fixture") && process.env.E2E_PASSWORD) {
  const login = await page.request.post(base + "/api/admin", {
    headers: { origin: base },
    data: { action: "login", password: process.env.E2E_PASSWORD },
  });
  if (!login.ok()) throw Error("QA admin login failed");
}
if (stage.startsWith("fixture")) {
  for (const [type, id] of [
    ["news", "visual-news"],
    ["matches", "visual-ended"],
  ]) {
    const response = await page.request.get(
      base + "/api/og?type=" + type + "&id=" + id,
    );
    if (!response.ok()) throw Error("Social image failed");
    writeFileSync(`${root}/og-${type}.png`, await response.body());
  }
}
const routes = [
  "/",
  "/matches",
  "/standings",
  "/teams",
  "/stats",
  "/news",
  "/the-road",
  "/road",
  "/team/al-ittihad",
  "/admin",
  ...data.games
    .filter((g) => g.id.startsWith("visual-"))
    .map((g) => "/matches/" + g.id),
  ...data.news
    .filter((n) => n.id === "visual-news")
    .map((n) => "/news/" + n.slug),
  ...data.players
    .filter((p) => p.id === "visual-player")
    .map((p) => "/players/" + p.id),
];
for (const [width, height] of [
  [390, 844],
  [430, 932],
  [768, 1024],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await page.setViewportSize({ width, height });
  for (const route of routes) {
    await page.goto(base + route);
    await page
      .locator("footer")
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    if (route === "/admin" && stage.startsWith("fixture")) {
      await page
        .getByLabel("المباراة", { exact: true })
        .selectOption("visual-live");
    }
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const view = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      metrics: window.__metrics,
      h1: document.querySelector("h1")?.textContent,
      resources: performance
        .getEntriesByType("resource")
        .filter((r) => r.initiatorType === "script")
        .reduce((s, r) => s + r.encodedBodySize, 0),
    }));
    results.push({ width, height, route, ...view });
    await page.screenshot({
      path: `${root}/${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${width}.png`,
      fullPage: true,
    });
    if (route === "/") await page.screenshot({path: `${root}/hero-${width}.png`, fullPage: false});
  }
}
writeFileSync(
  `${root}/results.json`,
  JSON.stringify({ base, errors, expectedUnauthorized, views: results }, null, 2),
);
console.log(
  JSON.stringify({
    stage,
    views: results.length,
    errors,
    overflow: results.filter((r) => r.overflow),
    missing: results.filter((r) => !r.h1),
  }),
);
await browser.close();
if (errors.length || results.some((view) => view.overflow || !view.h1))
  throw Error("Final visual/browser smoke failed; inspect results.json");
