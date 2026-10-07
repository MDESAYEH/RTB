import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";
const output = resolve("verification/design-rebuild");
const password = crypto.randomUUID() + crypto.randomUUID();
const env = {
  ...process.env,
  DATABASE_PATH: resolve(output, "browser-" + Date.now() + ".db"),
  SITE_URL: "https://road-to-bal-preview-mahara-boot-camp.vercel.app",
  ADMIN_PASSWORD: password,
  E2E_PASSWORD: password,
  E2E_BASE_URL: "https://road-to-bal-preview-mahara-boot-camp.vercel.app",
};
const provision = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/admin.ts"],
  { env, encoding: "utf8" },
);
if (provision.status !== 0) throw Error(provision.stderr);
const server = spawn(
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
let logs = "";
server.stdout.on("data", (x) => (logs += x));
server.stderr.on("data", (x) => (logs += x));
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(env.SITE_URL + "/api/data")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw Error(logs);
  const code = await new Promise((r) => {
    const child = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test"],
      { env, stdio: "inherit" },
    );
    child.on("exit", r);
  });
  process.exitCode = code;
  fs.writeFileSync(resolve(output, "browser-server.log"), logs);
} finally {
  server.kill();
}
