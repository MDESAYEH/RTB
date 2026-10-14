import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 s), compatible with Google/Microsoft Authenticator, Authy, etc. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw Error("Invalid base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32-encoded for authenticator apps. */
export const generateSecret = () => base32Encode(randomBytes(20));

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const currentStep = (now = Date.now()) =>
  Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Checks a code against the current step and one step either side (clock drift).
 * Returns the matched step so the caller can refuse to accept the same step twice, or null.
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastUsedStep = 0,
  now = Date.now(),
): number | null {
  const given = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const base = currentStep(now);
  let matched: number | null = null;
  // No early exit: the work done does not depend on which step matched.
  for (const step of [base - 1, base, base + 1]) {
    const expected = totpAt(secret, step);
    if (
      timingSafeEqual(Buffer.from(expected), Buffer.from(given)) &&
      step > lastUsedStep
    )
      matched = step;
  }
  return matched;
}

export function otpauthUri(secret: string, account: string, issuer = "Road to BAL") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** Eight single-use recovery codes like "k3f9-7x2m", for a lost phone. */
export function generateRecoveryCodes(count = 8): string[] {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const raw = Array.from(bytes, (b) => chars[b % chars.length]).join("");
    return raw.slice(0, 4) + "-" + raw.slice(4);
  });
}

export const normalizeRecoveryCode = (code: string) =>
  code.trim().toLowerCase().replace(/\s/g, "");
