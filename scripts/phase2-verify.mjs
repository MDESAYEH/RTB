import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { realtimeAudit } from "./realtime-audit.mjs";
import { performanceAudit } from "./performance-audit.mjs";
import { restoreAudit } from "./restore-audit.mjs";
const root = resolve("data/phase2-" + Date.now());
mkdirSync(root, { recursive: true });
const origin = "http://127.0.0.1:3001",
  password = crypto.randomUUID() + crypto.randomUUID();
const env = {
  ...process.env,
  DATABASE_PATH: resolve(root, "road.db"),
  SITE_URL: origin,
  ADMIN_PASSWORD: password,
  E2E_PASSWORD: password,
  E2E_BASE_URL: origin,
};
const provision = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/admin.ts"],
  { env, encoding: "utf8" },
);
if (provision.status !== 0) throw Error(provision.stderr);
let logs = "";
const start = () => {
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3001",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  return child;
};
let server = start();
const ready = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/api/data")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(logs);
};
try {
  await ready();
  const run = await new Promise((r) => {
    const c = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test"],
      { env, stdio: "inherit" },
    );
    c.on("exit", r);
  });
  if (run !== 0) throw Error("Browser regression failed");
  await realtimeAudit({
    origin,
    password,
    restart: async () => {
      const stopped = new Promise((r) => server.once("exit", r));
      server.kill();
      await stopped;
      await new Promise((r) => setTimeout(r, 1200));
      server = start();
      await ready();
    },
  });
  const login = await fetch(origin + "/api/admin", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ action: "login", password }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const post = async (body) => {
    const r = await fetch(origin + "/api/admin", {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const v = await r.json();
    if (!r.ok) throw Error(JSON.stringify(v));
    return v;
  };
  for (const status of ["Scheduled", "Live", "Halftime", "Ended"]) {
    const id = "visual-" + status.toLowerCase();
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
    });
    if (status !== "Scheduled") {
      await post({ action: "status", id, version: 0, status: "Warmup" });
      await post({ action: "status", id, version: 1, status: "Live" });
      const g = (await (await fetch(origin + "/api/data")).json()).games.find(
        (g) => g.id === id,
      );
      const periods =
        status === "Halftime"
          ? [
              { home: 18, away: 16 },
              { home: 20, away: 18 },
            ]
          : status === "Ended"
            ? [
                { home: 18, away: 16 },
                { home: 20, away: 18 },
                { home: 23, away: 21 },
                { home: 19, away: 20 },
              ]
            : [
                { home: 18, away: 16 },
                { home: 20, away: 18 },
                { home: 29, away: 28 },
              ];
      await post({
        action: "correct",
        id,
        version: g.version,
        confirmed: true,
        reason: "Isolated visual QA fixture only",
        value: {
          ...g,
          status,
          periods,
          quarter: status === "Halftime" ? 2 : status === "Ended" ? 4 : 3,
          clock: status === "Live" ? 268 : 0,
          homeScore: periods.reduce((n, p) => n + p.home, 0),
          awayScore: periods.reduce((n, p) => n + p.away, 0),
        },
      });
    }
  }
  await post({
    action: "save",
    kind: "players",
    value: {
      id: "visual-player",
      team: "al-ittihad",
      name: "لاعب اختبار بصري",
      number: 7,
      position: "Guard",
    },
  });
  const uploadForm = new FormData();
  uploadForm.append(
    "file",
    new File(
      [await (await fetch(origin + "/icon-192.png")).arrayBuffer()],
      "qa-logo.png",
      { type: "image/png" },
    ),
  );
  const uploaded = await fetch(origin + "/api/media", {
    method: "POST",
    headers: { origin, cookie },
    body: uploadForm,
  });
  if (!uploaded.ok) throw Error("QA image upload failed");
  const image = (await uploaded.json()).url;
  const team = (await (await fetch(origin + "/api/data")).json()).teams.find(
    (t) => t.id === "al-ittihad",
  );
  await post({
    action: "save",
    kind: "teams",
    value: { ...team, logo: image },
  });
  await post({
    action: "save",
    kind: "news",
    value: {
      id: "visual-news",
      slug: "visual-news",
      title: "خبر تجريبي للمراجعة البصرية",
      excerpt: "محتوى اختبار في قاعدة معزولة فقط.",
      content: "هذا محتوى اختبار، لا يمثل إعلانًا رسميًا أو خبرًا حقيقيًا.",
      author: "QA",
      publishedAt: new Date().toISOString(),
      status: "published",
      cover: image,
    },
  });
  const capture = await new Promise((r) => {
    const c = spawn(
      process.execPath,
      ["scripts/visual-audit.mjs", "fixture-final"],
      { env, stdio: "inherit" },
    );
    c.on("exit", r);
  });
  if (capture !== 0) throw Error("Visual capture failed");
  await performanceAudit(origin, "/matches/visual-live");
  const backup = spawnSync(process.execPath, ["scripts/backup.mjs"], {
    env: { ...env, BACKUP_DIRECTORY: resolve(root, "backups") },
    encoding: "utf8",
  });
  if (backup.status !== 0) throw Error(backup.stderr);
  console.log(backup.stdout.trim());
  await restoreAudit({
    snapshot: JSON.parse(backup.stdout.trim()).backup,
    root,
    env,
    expected: await (await fetch(origin + "/api/data")).json(),
  });
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const r = await fetch(origin + "/api/admin", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        action: "login",
        password: "incorrect-test-password",
      }),
    });
    statuses.push(r.status);
    if (r.status === 429) break;
  }
  if (statuses.at(-1) !== 429 || statuses.some((s) => s !== 401 && s !== 429))
    throw Error("Login rate limit failed");
  writeFileSync(
    "verification/phase2/login-limit.json",
    JSON.stringify(
      {
        statuses,
        persistentBucket: true,
        localGlobalBucket: true,
        productionProxyConfigurationRequired: true,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    "verification/phase2/qa-database.json",
    JSON.stringify(
      {
        database: env.DATABASE_PATH,
        isolated: true,
        publicDataUntouched: true,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
  writeFileSync("verification/phase2/qa-server.log", logs);
}
