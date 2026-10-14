import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { normalizeIdentifier } from "../lib/identifier";
import { can, requiredPermission, permissionsOf } from "../lib/permissions";

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "road-rbac-")),
  "rbac.db",
);

test("identifier accepts an email or an international phone, nothing else", () => {
  assert.deepEqual(normalizeIdentifier("  Admin@Example.COM "), {
    type: "email",
    value: "admin@example.com",
  });
  assert.deepEqual(normalizeIdentifier("+218 91-234 5678"), {
    type: "phone",
    value: "+218912345678",
  });
  assert.deepEqual(normalizeIdentifier("00218912345678"), {
    type: "phone",
    value: "+218912345678",
  });
  for (const bad of ["", "admin", "0912345678", "a@b", "+12", "x".repeat(300), 5])
    assert.equal(normalizeIdentifier(bad), null, String(bad));
});

test("roles hold only the permissions they need and unknown commands fail closed", () => {
  assert.ok(can("owner", "users:manage"));
  assert.ok(!can("manager", "users:manage"));
  assert.ok(can("manager", "game:correct"));
  assert.ok(can("scorer", "game:control"));
  assert.ok(!can("scorer", "content:write"));
  assert.ok(!can("scorer", "media:upload"));
  assert.ok(can("editor", "content:write"));
  assert.ok(!can("editor", "game:control"));
  assert.ok(!can("editor", "tournament:write"));
  assert.deepEqual(permissionsOf("hacker"), []);
  assert.equal(requiredPermission({ action: "score" }), "game:control");
  assert.equal(requiredPermission({ action: "correct" }), "game:correct");
  assert.equal(requiredPermission({ action: "save", kind: "news" }), "content:write");
  assert.equal(requiredPermission({ action: "save", kind: "games" }), "tournament:write");
  assert.equal(requiredPermission({ action: "save", kind: "admins" }), "users:manage");
  assert.equal(requiredPermission({ action: "something-new" }), "users:manage");
  assert.equal(requiredPermission({ action: "user:delete" }), "users:manage");
});

test("accounts sign in by identifier, roles are enforced and the last owner is protected", async () => {
  const {
    db,
    provision,
    login,
    principal,
    authorize,
    createUser,
    setUserRole,
    setUserDisabled,
    resetPassword,
    deleteUser,
    listUsers,
  } = await import("../lib/store");
  const pw = "test-only-long-password";

  // A legacy password-only account exists first, as in the current production database.
  await provision(pw);
  const legacy = await login(pw);
  assert.ok(legacy);
  assert.equal((await principal(legacy!))?.role, "owner");

  // A named owner retires the legacy account.
  await assert.rejects(() => provision(pw, { identifier: "not-valid" }));
  await provision(pw, { identifier: "Owner@Example.com" });
  assert.equal(await authorize(legacy!), null);
  assert.equal(await login(pw), null);
  assert.equal(await login(pw, "nobody@example.com"), null);
  assert.equal(await login("wrong-password-123", "owner@example.com"), null);
  const owner = await login(pw, "OWNER@example.com");
  assert.ok(owner);
  const who = await principal(owner!);
  assert.equal(who?.id, "owner@example.com");
  assert.equal(who?.identifier, "owner@example.com");
  assert.equal(who?.role, "owner");
  const stored = (await db
    .prepare("SELECT hash,salt FROM admins WHERE identifier='owner@example.com'")
    .get()) as { hash: string; salt: string };
  assert.notEqual(stored.hash, pw);

  // Create staff with a phone number and an email.
  const scorerId = await createUser("+218 91 234 5678", "scorer-password-123", "scorer");
  assert.equal(scorerId, "+218912345678");
  await assert.rejects(() => createUser("+218912345678", "scorer-password-123", "scorer"));
  await assert.rejects(() => createUser("short@example.com", "tooshort", "editor"));
  await assert.rejects(() => createUser("x@example.com", "long-enough-password", "god"));
  const scorerToken = await login("scorer-password-123", "+218912345678");
  assert.ok(scorerToken);
  const scorer = await principal(scorerToken!);
  assert.equal(scorer?.role, "scorer");
  assert.ok(can(scorer!.role, "game:control"));
  assert.ok(!can(scorer!.role, "users:manage"));

  // Role changes apply to live sessions immediately.
  await setUserRole(scorerId, "editor");
  assert.equal((await principal(scorerToken!))?.role, "editor");

  // A disabled account loses its sessions and cannot sign in.
  await setUserDisabled(scorerId, true);
  assert.equal(await principal(scorerToken!), null);
  assert.equal(await login("scorer-password-123", "+218912345678"), null);
  await setUserDisabled(scorerId, false);
  assert.ok(await login("scorer-password-123", "+218912345678"));

  // Password reset invalidates sessions and the old password.
  const before = await login("scorer-password-123", "+218912345678");
  await resetPassword(scorerId, "a-brand-new-password-1");
  assert.equal(await principal(before!), null);
  assert.equal(await login("scorer-password-123", "+218912345678"), null);
  assert.ok(await login("a-brand-new-password-1", "+218912345678"));

  // The last active owner cannot be demoted, disabled or deleted.
  await assert.rejects(() => setUserRole("owner@example.com", "editor"));
  await assert.rejects(() => setUserDisabled("owner@example.com", true));
  await assert.rejects(() => deleteUser("owner@example.com"));
  await createUser("second@example.com", "second-owner-password", "owner");
  await setUserRole("owner@example.com", "manager");
  assert.equal((await principal(owner!))?.role, "manager");

  await deleteUser(scorerId);
  const ids = (await listUsers()).map((u) => u.id).sort();
  assert.deepEqual(ids, ["owner@example.com", "second@example.com"]);
});
