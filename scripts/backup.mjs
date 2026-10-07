import { DatabaseSync, backup } from "node:sqlite";
import { resolve, dirname, join } from "node:path";
import {
  mkdirSync,
  existsSync,
  cpSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
if (process.env.TURSO_DATABASE_URL)
  throw Error(
    "db:backup snapshots local SQLite only. Clear Turso environment explicitly for a local source; use Turso backup/export after cutover.",
  );
const source = resolve(process.env.DATABASE_PATH || "data/road.db");
if (!existsSync(source)) throw Error("Database does not exist");
const directory = resolve(
  process.env.BACKUP_DIRECTORY || "data/backups",
  new Date().toISOString().replaceAll(":", "-") +
    "-" +
    crypto.randomUUID().slice(0, 8),
);
mkdirSync(directory, { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
db.exec("PRAGMA busy_timeout=5000");
await backup(db, join(directory, "road.db"), { rate: 100 });
db.close();
const restored = new DatabaseSync(join(directory, "road.db"), {
  readOnly: true,
});
if (restored.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
  throw Error("Backup integrity check failed");
if (restored.prepare("PRAGMA foreign_key_check").all().length)
  throw Error("Backup references failed");
// A provider-neutral migration inventory. Never log rows, hashes of passwords, or tokens.
const tables = restored
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND (name NOT LIKE 'sqlite_%' OR name='sqlite_sequence') ORDER BY name",
  )
  .all()
  .map(({ name }) => ({
    name,
    count: restored
      .prepare('SELECT count(*) AS n FROM "' + name.replaceAll('"', '""') + '"')
      .get().n,
  }));
const userVersion = restored.prepare("PRAGMA user_version").get().user_version;
const revision = tables.some(({ name }) => name === "revision")
  ? restored.prepare("SELECT value FROM revision WHERE id=1").get()?.value
  : null;
restored.close();
const media = join(dirname(source), "media");
if (existsSync(media))
  cpSync(media, join(directory, "media"), {
    recursive: true,
    errorOnExist: true,
  });
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const copiedMedia = join(directory, "media");
writeFileSync(
  join(directory, "manifest.json"),
  JSON.stringify(
    {
      format: 1,
      userVersion,
      revision,
      tables,
      databaseSha256: sha256(join(directory, "road.db")),
      media: existsSync(copiedMedia)
        ? readdirSync(copiedMedia)
            .filter((name) => /^[a-f0-9]{64}\.(png|jpg|webp)$/.test(name))
            .sort()
            .map((name) => ({ name, sha256: sha256(join(copiedMedia, name)) }))
        : [],
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    backup: directory,
    integrity: "ok",
    media: "copied when present",
  }),
);
