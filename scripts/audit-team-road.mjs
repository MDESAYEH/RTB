import { chromium } from "@playwright/test";
import fs from "node:fs";
const teams = JSON.parse(
  fs.readFileSync("lib/team-identity.json", "utf8"),
).teams;
const b = await chromium.launch();
const report = [];
const faults = [];
const p = await b.newPage();
for (const t of teams) {
  await p.goto("http://127.0.0.1:3000/teams/" + t.slug);
  await p.evaluate(() => document.fonts.ready);
  for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
    await p.setViewportSize({ width, height: 900 });
    await p.emulateMedia({ reducedMotion: "reduce" });
    const check = await p.evaluate(() => {
      const rect = (e) => e.getBoundingClientRect();
      const intersect = (a, b) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      const nodes = [...document.querySelectorAll(".hub-club")];
      const overlaps = nodes.flatMap((a, i) =>
        nodes
          .slice(i + 1)
          .filter((b) => intersect(rect(a), rect(b)))
          .map((b) => [a.dataset.team, b.dataset.team]),
      );
      const text = [
        ...document.querySelectorAll(
          ".club-name-block h1 span,.club-arabic-statement h2,.podium-number strong,.podium-caption h2",
        ),
      ]
        .filter((e) => {
          const r = document.createRange();
          r.selectNodeContents(e);
          const box = r.getBoundingClientRect();
          return box.left < 0 || box.right > innerWidth + 1;
        })
        .map((e) => e.textContent);
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        overlaps,
        text,
        broken: [...document.images]
          .filter((i) => i.complete && !i.naturalWidth)
          .map((i) => i.src),
        anchor: document
          .querySelector(".current-club")
          ?.getAttribute("data-team"),
      };
    });
    report.push({ slug: t.slug, width, ...check });
    if (
      check.overflow ||
      check.overlaps.length ||
      check.text.length ||
      check.broken.length ||
      check.anchor !== t.id
    )
      faults.push(report.at(-1));
  }
}
fs.writeFileSync(
  "verification/team-road/responsive.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(faults, null, 2));
await b.close();
if (faults.length) process.exitCode = 1;
