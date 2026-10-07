import { chromium } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync("verification/team-road", { recursive: true });
const browser = await chromium.launch();
for (const [slug, width] of [
  ["al-ittihad", 1440],
  ["stade-malien", 1440],
  ["kriol-star", 1440],
  ["nabaya-sofas", 390],
  ["npa-pythons", 390],
  ["red-flames", 1440],
]) {
  const page = await browser.newPage({
    viewport: { width, height: width === 390 ? 844 : 900 },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:3000/teams/" + slug);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete),
  );
  await page.screenshot({
    path: `verification/team-road/${slug}-${width}.png`,
    fullPage: true,
  });
  await page.close();
}
await browser.close();
