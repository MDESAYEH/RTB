import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "road-test-")),
  "test.db",
);
test("fresh database, hashed auth, audit rollback, manual provider", async () => {
  const {
    db,
    provider,
    provision,
    login,
    authorize,
    revoke,
    write,
    get,
    rateLimit,
  } = await import("../lib/store");
  assert.equal(provider.getTeams().length, 10);
  assert.equal(provider.getGames().length, 0);
  assert.equal(authorize("bad"), null);
  assert.equal(
    (db.prepare("PRAGMA busy_timeout").get() as { timeout: number }).timeout,
    5000,
  );
  assert.equal(
    (db.prepare("PRAGMA user_version").get() as { user_version: number })
      .user_version,
    3,
  );
  provision("test-only-long-password");
  assert.equal(login("bad"), null);
  const token = login("test-only-long-password");
  assert.ok(token);
  assert.equal(authorize(token!), "admin");
  revoke(token!);
  assert.equal(authorize(token!), null);
  const expired = login("test-only-long-password");
  assert.ok(expired);
  db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal(authorize(expired), null);
  const row = db.prepare("SELECT hash FROM admins").get() as { hash: string };
  assert.notEqual(row.hash, "test-only-long-password");
  assert.throws(() =>
    db.transaction(() => {
      write("test", "id", { ok: true }, "admin");
      throw Error("rollback");
    })(),
  );
  assert.equal(get("test", "id"), undefined);
  assert.throws(() =>
    write(
      "players",
      "invalid-reference",
      { id: "invalid-reference", team: "missing" },
      "admin",
    ),
  );
  assert.equal(get("players", "invalid-reference"), undefined);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  write("test", "id", { ok: true }, "admin");
  assert.equal(
    (
      db.prepare("SELECT count(*) n FROM audit WHERE kind='test'").get() as {
        n: number;
      }
    ).n,
    1,
  );
  assert.ok(rateLimit("test", 1));
  assert.equal(rateLimit("test", 1), false);
  db.close();
});
