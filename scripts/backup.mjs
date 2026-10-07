import { DatabaseSync, backup } from "node:sqlite";
import { resolve, dirname, join } from "node:path";
import { mkdirSync, existsSync, cpSync } from "node:fs";
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
restored.close();
const media = join(dirname(source), "media");
if (existsSync(media))
  cpSync(media, join(directory, "media"), {
    recursive: true,
    errorOnExist: true,
  });
console.log(
  JSON.stringify({
    backup: directory,
    integrity: "ok",
    media: "copied when present",
  }),
);
