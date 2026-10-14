import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Authenticated encryption (AES-256-GCM) for secrets kept in the database, so a copied database file
 * alone does not hand over every account's authenticator secret. The key comes from TWO_FACTOR_KEY.
 */
function key(): Buffer {
  const raw = process.env.TWO_FACTOR_KEY;
  if (!raw || raw.length < 32)
    throw new Error(
      "TWO_FACTOR_KEY must be set (at least 32 characters; generate one with: openssl rand -hex 32)",
    );
  return createHash("sha256").update(raw).digest();
}

export const twoFactorConfigured = () =>
  (process.env.TWO_FACTOR_KEY ?? "").length >= 32;

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function open(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
