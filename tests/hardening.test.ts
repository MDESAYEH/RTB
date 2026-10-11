import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sharedRevision } from "../lib/revision-cache";
import { loginBucket } from "../lib/login-limit";
import { LocalDatabase } from "../lib/database";

test("live feed shares one revision read between concurrent connections", async () => {
  let reads = 0;
  let clock = 0;
  const revision = sharedRevision(
    async () => {
      reads++;
      return 7;
    },
    1000,
    () => clock,
  );
  const values = await Promise.all(
    Array.from({ length: 500 }, () => revision()),
  );
  assert.ok(values.every((v) => v === 7));
  assert.equal(reads, 1, "500 viewers cause one database read");
  clock = 999;
  await revision();
  assert.equal(reads, 1, "cached within max age");
  clock = 1000;
  await revision();
  assert.equal(reads, 2, "refreshed after max age");
});

test("a failed revision read is not cached", async () => {
  let fail = true;
  const revision = sharedRevision(async () => {
    if (fail) throw Error("storage down");
    return 3;
  });
  await assert.rejects(revision());
  fail = false;
  assert.equal(await revision(), 3);
});

test("Vercel login limits use the edge-provided client address", () => {
  const before = {
    trust: process.env.TRUST_PROXY_IP,
    vercel: process.env.VERCEL,
  };
  try {
    delete process.env.TRUST_PROXY_IP;
    process.env.VERCEL = "1";
    assert.equal(
      loginBucket(
        new Request("http://localhost", {
          headers: { "x-real-ip": "5.6.7.8" },
        }),
      ),
      "login:5.6.7.8",
    );
    assert.throws(() => loginBucket(new Request("http://localhost")));
  } finally {
    if (before.trust === undefined) delete process.env.TRUST_PROXY_IP;
    else process.env.TRUST_PROXY_IP = before.trust;
    if (before.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = before.vercel;
  }
});

test("LocalDatabase rejects async transaction callbacks and rolls back", () => {
  const root = mkdtempSync(join(tmpdir(), "rtb-tx-"));
  const db = new LocalDatabase(join(root, "t.db"));
  try {
    db.exec("CREATE TABLE t(v INTEGER)");
    const run = db.transaction((async () => {
      db.prepare("INSERT INTO t VALUES(1)").run();
    }) as unknown as () => void);
    assert.throws(run, /synchronous callback/);
    assert.equal(
      (db.prepare("SELECT count(*) AS n FROM t").get() as { n: number }).n,
      0,
    );
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
