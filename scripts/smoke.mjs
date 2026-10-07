import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:3000/");
await page.getByRole("heading", { name: "طرابلس تستضيف أفريقيا" }).waitFor();
const data = await (
  await page.request.get("http://127.0.0.1:3000/api/data")
).json();
if (data.games.length || data.players.length || data.stats.length)
  throw Error("Unexpected demo data in public DB");
mkdirSync("verification", { recursive: true });
for (const width of [1280, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({
    path: `verification/home-${width}.png`,
    fullPage: true,
  });
}
const og = await page.request.get("http://127.0.0.1:3000/api/og");
if (!og.ok() || !og.headers()["content-type"]?.includes("image/png"))
  throw Error("OG image failed");
if (errors.length) throw Error(errors.join("\n"));
console.log(
  JSON.stringify({
    production: true,
    publicTeams: data.teams.length,
    publicGames: data.games.length,
    consoleErrors: errors.length,
    ogStatus: og.status(),
    ogBytes: (await og.body()).length,
  }),
);
await browser.close();
