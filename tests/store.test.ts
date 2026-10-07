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
  assert.equal((await provider.getTeams()).length, 10);
  assert.equal((await provider.getGames()).length, 0);
  assert.equal(await authorize("bad"), null);
  assert.equal(
    (
      (await db.prepare("PRAGMA busy_timeout").get()) as {
        timeout: number;
      }
    ).timeout,
    5000,
  );
  assert.equal(
    (
      (await db.prepare("PRAGMA user_version").get()) as {
        user_version: number;
      }
    ).user_version,
    4,
  );
  await provision("test-only-long-password");
  assert.equal(await login("bad"), null);
  const token = await login("test-only-long-password");
  assert.ok(token);
  assert.equal(await authorize(token!), "admin");
  await revoke(token!);
  assert.equal(await authorize(token!), null);
  const expired = await login("test-only-long-password");
  assert.ok(expired);
  await db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal(await authorize(expired), null);
  const row = (await db.prepare("SELECT hash FROM admins").get()) as {
    hash: string;
  };
  assert.notEqual(row.hash, "test-only-long-password");
  await assert.rejects(
    async () =>
      await db.transaction(async () => {
        await write("test", "id", { ok: true }, "admin");
        throw Error("rollback");
      })(),
  );
  assert.equal(await get("test", "id"), undefined);
  await assert.rejects(
    async () =>
      await write(
        "players",
        "invalid-reference",
        { id: "invalid-reference", team: "missing" },
        "admin",
      ),
  );
  assert.equal(await get("players", "invalid-reference"), undefined);
  assert.equal((await db.prepare("PRAGMA foreign_key_check").all()).length, 0);
  await write("test", "id", { ok: true }, "admin");
  assert.equal(
    (
      (await db
        .prepare("SELECT count(*) n FROM audit WHERE kind='test'")
        .get()) as {
        n: number;
      }
    ).n,
    1,
  );
  assert.ok(await rateLimit("test", 1));
  assert.equal(await rateLimit("test", 1), false);
  await db.close();
});
