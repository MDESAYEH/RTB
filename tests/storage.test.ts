import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  existsSync,
  rmSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { LocalDatabase } from "../lib/database";
import { LocalMediaStorage } from "../lib/media-storage";
import { assertLocalStorageAllowed } from "../lib/storage-config";

test("Vercel storage fails closed regardless of DATABASE_PATH", () => {
  for (const DATABASE_PATH of ["/var/task/data/road.db", "/tmp/road.db"])
    assert.throws(
      () => assertLocalStorageAllowed({ VERCEL: "1", DATABASE_PATH }),
      /Persistent storage is not configured/,
    );
  assert.throws(() => assertLocalStorageAllowed({ VERCEL_ENV: "production" }));
  assert.doesNotThrow(() =>
    assertLocalStorageAllowed({ NODE_ENV: "production" }),
  );
});

test("production-like imports do not create SQLite or media directories", () => {
  const root = mkdtempSync(join(tmpdir(), "road-vercel-"));
  try {
    const path = join(root, "absent", "road.db");
    const code = `import assert from 'node:assert/strict';
      const {db}=await import('./lib/store.ts');
      await import('./lib/club-repository.ts');
      const {mediaStorage}=await import('./lib/media-storage.ts');
      await assert.rejects(db.prepare('SELECT 1').get(), /TURSO_DATABASE_URL/);
      await assert.rejects(mediaStorage.put('a'.repeat(64)+'.webp', new Uint8Array([1])), /BLOB_READ_WRITE_TOKEN/);
      await assert.rejects(mediaStorage.get('a'.repeat(64)+'.webp'), /BLOB_READ_WRITE_TOKEN/);`;
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", code],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          VERCEL: "1",
          DATABASE_PATH: path,
          TURSO_DATABASE_URL: "",
          TURSO_AUTH_TOKEN: "",
          BLOB_READ_WRITE_TOKEN: "",
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(root, "absent")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite transactions rollback and persist across independent connections", () => {
  const root = mkdtempSync(join(tmpdir(), "road-persistence-"));
  const db = new LocalDatabase(join(root, "test.db"));
  const second = new LocalDatabase(join(root, "test.db"));
  try {
    db.exec(
      "CREATE TABLE value(id INTEGER PRIMARY KEY, version INTEGER); INSERT INTO value VALUES(1,0)",
    );
    assert.throws(() =>
      db.transaction(() => {
        db.exec("UPDATE value SET version=1");
        throw Error("rollback");
      })(),
    );
    assert.equal(second.prepare("SELECT version FROM value").get()?.version, 0);
    db.transaction(() => db.exec("UPDATE value SET version=1"))();
    assert.equal(second.prepare("SELECT version FROM value").get()?.version, 1);
  } finally {
    second.close();
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("media survives adapter recreation, deduplicates and rejects traversal", async () => {
  const root = mkdtempSync(join(tmpdir(), "road-media-"));
  try {
    const id = "a".repeat(64) + ".webp";
    const storage = new LocalMediaStorage(join(root, "media"));
    const bytes = new Uint8Array([1, 2, 3]);
    await Promise.all([storage.put(id, bytes), storage.put(id, bytes)]);
    assert.deepEqual(
      await new LocalMediaStorage(join(root, "media")).get(id),
      Buffer.from(bytes),
    );
    assert.equal(await storage.get("b".repeat(64) + ".webp"), undefined);
    await assert.rejects(
      storage.put(id, new Uint8Array([4])),
      /Immutable media content mismatch/,
    );
    assert.deepEqual(await storage.get(id), Buffer.from(bytes));
    await assert.rejects(storage.put("../outside", bytes), /Invalid media ID/);
    await assert.rejects(storage.get("../outside"), /Invalid media ID/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migration snapshot retains all tables, revision, sessions and WAL writes", () => {
  const root = mkdtempSync(join(tmpdir(), "road-snapshot-"));
  const path = join(root, "source.db");
  const db = new LocalDatabase(path);
  try {
    db.pragma("journal_mode=WAL");
    db.exec(
      "CREATE TABLE revision(id INTEGER PRIMARY KEY,value INTEGER); INSERT INTO revision VALUES(1,42); CREATE TABLE sessions(token TEXT); INSERT INTO sessions VALUES('private-test-token'); CREATE TABLE future_table(value TEXT); INSERT INTO future_table VALUES('retained'); PRAGMA user_version=3",
    );
    const result = spawnSync(process.execPath, ["scripts/backup.mjs"], {
      env: {
        ...process.env,
        DATABASE_PATH: path,
        BACKUP_DIRECTORY: join(root, "backups"),
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes("private-test-token"));
    const folder = join(root, "backups", readdirSync(join(root, "backups"))[0]);
    const manifest = JSON.parse(
      readFileSync(join(folder, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.revision, 42);
    assert.equal(manifest.userVersion, 3);
    assert.ok(
      manifest.tables.some(
        (t: { name: string; count: number }) =>
          t.name === "future_table" && t.count === 1,
      ),
    );
    const restored = new LocalDatabase(join(folder, "road.db"));
    try {
      assert.equal(
        restored.prepare("SELECT token FROM sessions").get()?.token,
        "private-test-token",
      );
    } finally {
      restored.close();
    }
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
