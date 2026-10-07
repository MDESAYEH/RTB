import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
export async function restoreAudit({ snapshot, root, env, expected }) {
  const directory = join(root, "restored");
  mkdirSync(directory, { recursive: true });
  cpSync(snapshot, directory, { recursive: true });
  const restored = new DatabaseSync(join(directory, "road.db"));
  restored.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
  );
  const pragmas = Object.fromEntries(
    [
      "journal_mode",
      "busy_timeout",
      "foreign_keys",
      "integrity_check",
      "foreign_key_check",
    ].map((key) => [key, restored.prepare("PRAGMA " + key).all()]),
  );
  if (
    pragmas.integrity_check[0].integrity_check !== "ok" ||
    pragmas.foreign_key_check.length
  )
    throw Error("Restore integrity failed");
  restored.close();
  const origin = "http://127.0.0.1:3003",
    publicOrigin = "https://event.example",
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3003",
      ],
      {
        env: {
          ...env,
          DATABASE_PATH: join(directory, "road.db"),
          SITE_URL: publicOrigin,
        },
        stdio: "ignore",
      },
    );
  try {
    let actual;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(origin + "/api/data");
        if (r.ok) {
          actual = await r.json();
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!actual || JSON.stringify(actual) !== JSON.stringify(expected))
      throw Error("Restored public data differs");
    const auth = await fetch(origin + "/api/admin");
    if (auth.status !== 401) throw Error("Restored admin access unprotected");
    const login = await fetch(origin + "/api/admin", {
      method: "POST",
      headers: { origin: publicOrigin, "content-type": "application/json" },
      body: JSON.stringify({ action: "login", password: env.ADMIN_PASSWORD }),
    });
    const header = login.headers.get("set-cookie") || "";
    if (
      !login.ok ||
      !/; Secure/i.test(header) ||
      !/; HttpOnly/i.test(header) ||
      !/SameSite=strict/i.test(header)
    )
      throw Error("HTTPS cookie configuration failed");
    const report = {
      pragmas,
      restoredRuntime: "production",
      publicSnapshotEqual: true,
      unauthenticatedAdmin: 401,
      httpsCookieFlags:
        "Secure / HttpOnly / SameSite Strict asserted with configured public HTTPS origin; no real TLS transport claim",
      temporaryOnly: true,
    };
    writeFileSync(
      "verification/phase2/sqlite-restore.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    server.kill();
  }
}
