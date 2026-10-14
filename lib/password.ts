import { argon2, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with Argon2id (RFC 9106), built into Node 24 (no dependency).
 * Parameters follow OWASP's guidance for Argon2id and are stored in each hash, so they can be raised later
 * without invalidating existing passwords: an older hash is accepted and re-hashed at the next sign-in.
 * Hashes written by earlier versions used scrypt; those still verify and are upgraded the same way.
 */
if (typeof argon2 !== "function")
  throw new Error("Argon2id needs Node 24.7 or newer (crypto.argon2); run: nvm use 24");
const argon2Async = promisify(argon2);

export const ARGON2_PARAMS = {
  memory: 65536, // KiB = 64 MiB
  passes: 3,
  parallelism: 1,
  tagLength: 32,
} as const;
const PREFIX = "$argon2id$";

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64").replace(/=+$/, "");
const fromB64 = (text: string) => Buffer.from(text, "base64");

/** At most this many hashes run at once (each briefly holds 64 MiB), so a burst of attempts queues instead of exhausting memory. */
const MAX_CONCURRENT = 2;
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT)
    await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function derive(
  password: string,
  salt: Buffer,
  params: { memory: number; passes: number; parallelism: number; tagLength: number },
) {
  return slot(
    async () =>
      (await argon2Async("argon2id", {
        message: Buffer.from(password, "utf8"),
        nonce: salt,
        ...params,
      })) as Buffer,
  );
}

/** A fresh salted Argon2id hash in PHC string format. `salt` is also returned for the legacy salt column. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const tag = await derive(password, salt, ARGON2_PARAMS);
  const { memory, passes, parallelism } = ARGON2_PARAMS;
  return {
    salt: salt.toString("hex"),
    hash: `${PREFIX}v=19$m=${memory},t=${passes},p=${parallelism}$${b64(salt)}$${b64(tag)}`,
  };
}

type Parsed = {
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  tag: Buffer;
};
function parse(hash: string): Parsed | null {
  // $argon2id$v=19$m=65536,t=3,p=1$<salt>$<tag>
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[1] !== "argon2id") return null;
  const m = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(parts[3]);
  if (!m) return null;
  return {
    memory: Number(m[1]),
    passes: Number(m[2]),
    parallelism: Number(m[3]),
    salt: fromB64(parts[4]),
    tag: fromB64(parts[5]),
  };
}

/** `ok` is the password check; `needsRehash` says the stored hash is scrypt or uses weaker parameters. */
export async function verifyPassword(
  password: string,
  stored: { salt: string; hash: string },
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.hash.startsWith(PREFIX)) {
    const p = parse(stored.hash);
    if (!p || p.memory > 1024 * 1024 || p.passes > 20 || p.parallelism > 16)
      return { ok: false, needsRehash: false };
    const tag = await derive(password, p.salt, {
      memory: p.memory,
      passes: p.passes,
      parallelism: p.parallelism,
      tagLength: p.tag.length,
    });
    const ok = tag.length === p.tag.length && timingSafeEqual(tag, p.tag);
    const weaker =
      p.memory < ARGON2_PARAMS.memory ||
      p.passes < ARGON2_PARAMS.passes ||
      p.parallelism !== ARGON2_PARAMS.parallelism;
    return { ok, needsRehash: ok && weaker };
  }
  // Legacy scrypt (hex digest of 64 bytes).
  const legacy = Buffer.from(stored.hash, "hex");
  const given = scryptSync(password, stored.salt, 64);
  const ok = legacy.length === given.length && timingSafeEqual(given, legacy);
  return { ok, needsRehash: ok };
}

const DUMMY_SALT = randomBytes(16);
/** Burns the same work as a real check so an unknown account cannot be told apart by response time. */
export async function dummyVerify(password: string) {
  await derive(password, DUMMY_SALT, ARGON2_PARAMS);
}
