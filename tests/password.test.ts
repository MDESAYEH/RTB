import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, scryptSync } from "node:crypto";
import { ARGON2_PARAMS, hashPassword, verifyPassword } from "../lib/password";

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "road-pw-")),
  "password.db",
);

test("passwords are hashed with Argon2id, salted, and verified in constant shape", async () => {
  const pw = "correct horse battery staple";
  const a = await hashPassword(pw);
  const b = await hashPassword(pw);
  assert.match(a.hash, /^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
  assert.notEqual(a.hash, b.hash, "a fresh random salt every time");
  assert.ok(!a.hash.includes(pw));
  assert.deepEqual(await verifyPassword(pw, a), { ok: true, needsRehash: false });
  assert.equal((await verifyPassword("wrong password!!", a)).ok, false);
  assert.equal((await verifyPassword("", a)).ok, false);
  // Corrupt or hostile stored values fail closed instead of throwing or exhausting memory.
  assert.equal((await verifyPassword(pw, { salt: a.salt, hash: "$argon2id$garbage" })).ok, false);
  assert.equal(
    (await verifyPassword(pw, { salt: a.salt, hash: "$argon2id$v=19$m=99999999,t=3,p=1$AAAA$AAAA" })).ok,
    false,
  );
  assert.equal(ARGON2_PARAMS.memory >= 19456, true, "at or above the OWASP minimum");
});

test("older scrypt hashes and weaker Argon2 settings still verify and ask to be upgraded", async () => {
  const pw = "an-older-password-1234";
  const salt = randomBytes(16).toString("hex");
  const legacy = { salt, hash: scryptSync(pw, salt, 64).toString("hex") };
  assert.deepEqual(await verifyPassword(pw, legacy), { ok: true, needsRehash: true });
  assert.deepEqual(await verifyPassword("nope-nope-nope-1", legacy), { ok: false, needsRehash: false });

  // An Argon2id hash made with weaker parameters (e.g. an earlier release) is accepted and flagged.
  const { argon2Sync } = await import("node:crypto");
  const s = randomBytes(16);
  const tag = argon2Sync("argon2id", {
    message: Buffer.from(pw),
    nonce: s,
    memory: 19456,
    passes: 2,
    parallelism: 1,
    tagLength: 32,
  });
  const b64 = (x: Uint8Array) => Buffer.from(x).toString("base64").replace(/=+$/, "");
  const weak = { salt: s.toString("hex"), hash: `$argon2id$v=19$m=19456,t=2,p=1$${b64(s)}$${b64(tag)}` };
  assert.deepEqual(await verifyPassword(pw, weak), { ok: true, needsRehash: true });
});

test("an existing scrypt account signs in once and is upgraded to Argon2id automatically", async () => {
  const { db, provision, authenticate, resetPassword, createUser } = await import("../lib/store");
  const pw = "legacy-account-password";
  const id = await provision("temporary-password-1234", { identifier: "legacy@example.com" });
  // Put the account back into the format earlier versions stored.
  const salt = randomBytes(16).toString("hex");
  await db
    .prepare("UPDATE admins SET salt=?,hash=? WHERE id=?")
    .run(salt, scryptSync(pw, salt, 64).toString("hex"), id);

  assert.equal((await authenticate("wrong-password-xyz-1", "legacy@example.com")).status, "fail");
  const stillLegacy = (await db.prepare("SELECT hash FROM admins WHERE id=?").get(id)) as { hash: string };
  assert.ok(!stillLegacy.hash.startsWith("$argon2id$"), "a failed sign-in never rewrites the hash");

  assert.equal((await authenticate(pw, "legacy@example.com")).status, "ok");
  const upgraded = (await db.prepare("SELECT hash FROM admins WHERE id=?").get(id)) as { hash: string };
  assert.match(upgraded.hash, /^\$argon2id\$/);
  // The same password keeps working after the upgrade.
  assert.equal((await authenticate(pw, "legacy@example.com")).status, "ok");
  assert.equal((await authenticate("temporary-password-1234", "legacy@example.com")).status, "fail");

  // New accounts and password resets also store Argon2id.
  await createUser("fresh@example.com", "fresh-account-password", "editor");
  await resetPassword("fresh@example.com", "another-fresh-password");
  const fresh = (await db.prepare("SELECT hash FROM admins WHERE id='fresh@example.com'").get()) as { hash: string };
  assert.match(fresh.hash, /^\$argon2id\$/);
  assert.equal((await authenticate("another-fresh-password", "fresh@example.com")).status, "ok");
});
