import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  base32Decode,
  base32Encode,
  currentStep,
  generateRecoveryCodes,
  generateSecret,
  otpauthUri,
  totpAt,
  verifyTotp,
} from "../lib/totp";
import { open, seal } from "../lib/secret-box";

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "road-2fa-")),
  "twofactor.db",
);
process.env.TWO_FACTOR_KEY = "test-only-two-factor-key-0123456789abcdef";

test("TOTP matches the RFC 6238 SHA-1 vectors and base32 round-trips", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(base32Decode(secret).toString(), "12345678901234567890");
  // RFC 6238 appendix B (6-digit truncation of the published 8-digit codes).
  const vectors: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ];
  for (const [seconds, code] of vectors)
    assert.equal(totpAt(secret, Math.floor(seconds / 30)), code, String(seconds));
  assert.match(generateSecret(), /^[A-Z2-7]{32}$/);
  assert.match(
    otpauthUri("ABC", "me@example.com"),
    /^otpauth:\/\/totp\/Road%20to%20BAL%3Ame%40example\.com\?secret=ABC&issuer=Road%20to%20BAL/,
  );
});

test("codes accept one step of drift and never the same step twice", () => {
  const secret = generateSecret();
  const now = 1_700_000_000_000;
  const step = currentStep(now);
  assert.equal(verifyTotp(secret, totpAt(secret, step), 0, now), step);
  assert.equal(verifyTotp(secret, totpAt(secret, step - 1), 0, now), step - 1);
  assert.equal(verifyTotp(secret, totpAt(secret, step + 1), 0, now), step + 1);
  assert.equal(verifyTotp(secret, totpAt(secret, step + 2), 0, now), null);
  assert.equal(verifyTotp(secret, totpAt(secret, step), step, now), null);
  assert.equal(verifyTotp(secret, "12345", 0, now), null);
  assert.equal(verifyTotp(secret, "abcdef", 0, now), null);
  const codes = generateRecoveryCodes();
  assert.equal(new Set(codes).size, 8);
  for (const c of codes) assert.match(c, /^[a-z0-9]{4}-[a-z0-9]{4}$/);
});

test("stored secrets are encrypted and tamper-evident", () => {
  const sealed = seal("JBSWY3DPEHPK3PXP");
  assert.ok(!sealed.includes("JBSWY3DPEHPK3PXP"));
  assert.equal(open(sealed), "JBSWY3DPEHPK3PXP");
  const parts = sealed.split(".");
  parts[2] = Buffer.from("tampered").toString("base64");
  assert.throws(() => open(parts.join(".")));
});

test("enrolment, login with a code, replay, recovery codes and disabling", async () => {
  const {
    provision,
    authenticate,
    principal,
    beginTwoFactor,
    confirmTwoFactor,
    disableTwoFactor,
    resetTwoFactor,
    listUsers,
    db,
  } = await import("../lib/store");
  const pw = "test-only-long-password";
  const id = await provision(pw, { identifier: "owner@example.com" });

  // Without an authenticator, password alone signs in.
  const plain = await authenticate(pw, "owner@example.com");
  assert.equal(plain.status, "ok");

  // Enrol: wrong code is refused, the right one enables it and returns recovery codes.
  const { secret, uri } = await beginTwoFactor(id);
  assert.match(uri, /^otpauth:\/\/totp\//);
  const stored = (await db
    .prepare("SELECT totp_secret FROM admins WHERE id=?")
    .get(id)) as { totp_secret: string };
  assert.ok(!stored.totp_secret.includes(secret));
  await assert.rejects(() => confirmTwoFactor(id, "000000"));
  const t = Date.now();
  const first = totpAt(secret, currentStep(t));
  const recovery = await confirmTwoFactor(id, first);
  assert.equal(recovery.length, 8);
  await assert.rejects(() => beginTwoFactor(id));
  const row = (await db.prepare("SELECT recovery FROM admins WHERE id=?").get(id)) as {
    recovery: string;
  };
  assert.ok(!row.recovery.includes(recovery[0]));
  assert.equal((await listUsers())[0].twoFactor, 1);

  // Password alone no longer signs in; it asks for the code.
  assert.equal((await authenticate(pw, "owner@example.com")).status, "otp");
  assert.equal((await authenticate("wrong-password-123", "owner@example.com", first)).status, "fail");
  assert.equal((await authenticate(pw, "owner@example.com", "123456")).status, "fail");
  // The code used to enrol cannot be replayed; the next step's code works once.
  assert.equal((await authenticate(pw, "owner@example.com", first)).status, "fail");
  const next = totpAt(secret, currentStep(t) + 1);
  const ok = await authenticate(pw, "owner@example.com", next);
  assert.equal(ok.status, "ok");
  assert.equal((await authenticate(pw, "owner@example.com", next)).status, "fail");
  const who = await principal(ok.status === "ok" ? ok.token : "");
  assert.equal(who?.twoFactor, 1);

  // A recovery code works once.
  assert.equal((await authenticate(pw, "owner@example.com", recovery[0])).status, "ok");
  assert.equal((await authenticate(pw, "owner@example.com", recovery[0])).status, "fail");
  assert.equal((await authenticate(pw, "owner@example.com", recovery[1].toUpperCase())).status, "ok");

  // Disabling needs password and a valid code.
  await assert.rejects(() => disableTwoFactor(id, "wrong-password-123", recovery[2]));
  await assert.rejects(() => disableTwoFactor(id, pw, "000000"));
  await disableTwoFactor(id, pw, recovery[2]);
  assert.equal((await authenticate(pw, "owner@example.com")).status, "ok");

  // An owner can clear a colleague's authenticator after a lost phone.
  const again = await beginTwoFactor(id);
  await confirmTwoFactor(id, totpAt(again.secret, currentStep()));
  assert.equal((await authenticate(pw, "owner@example.com")).status, "otp");
  await resetTwoFactor(id);
  assert.equal((await authenticate(pw, "owner@example.com")).status, "ok");
});
