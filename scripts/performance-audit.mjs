import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
export async function performanceAudit(base, match = "/matches") {
  const browser = await chromium.launch({ channel: "chrome" }),
    results = [];
  for (const route of ["/", match]) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1600000 / 8,
      uploadThroughput: 750000 / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0 };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          if (!e.hadRecentInput) window.__perf.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.locator("footer").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3500);
    results.push({
      route,
      ...(await page.evaluate(() => ({
        ...window.__perf,
        jsBytes: performance
          .getEntriesByType("resource")
          .filter((r) => r.initiatorType === "script")
          .reduce((n, r) => n + r.encodedBodySize, 0),
        fontBytes: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes(".woff"))
          .reduce((n, r) => n + r.encodedBodySize, 0),
        documentBytes:
          performance.getEntriesByType("navigation")[0].encodedBodySize,
      }))),
    });
    await context.close();
  }
  await browser.close();
  const report = {
    conditions:
      "Local Chrome, cold cache, 390x844, CPU 4x, 150ms RTT, 1.6Mbps down. One synthetic sample per screen; no field Core Web Vitals claim.",
    results,
  };
  writeFileSync(
    "verification/phase2/performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
