/** Read-only cutover verification; never modifies source, database, or Blob. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { SqlDatabase, databaseConfig } from "../lib/sql-database";
import { mediaStorage, validMediaId } from "../lib/media-storage";
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const sourcePath = resolve(option("--source") || "data/road.db");
const source = new DatabaseSync(sourcePath, { readOnly: true });
const config = databaseConfig();
if (config.kind !== "libsql")
  throw Error("db:verify requires remote Turso configuration");
const target = new SqlDatabase(() => config);
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const digest = (rows: unknown[]) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        rows
          .map((row) =>
            JSON.stringify(row, (_key, value) =>
              value instanceof Uint8Array
                ? { base64: Buffer.from(value).toString("base64") }
                : value,
            ),
          )
          .sort(),
      ),
    )
    .digest("hex");
try {
  if (
    source.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
    source.prepare("PRAGMA foreign_key_check").all().length
  )
    throw Error("Source integrity failed");
  const tables = source
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND (name NOT LIKE 'sqlite_%' OR name='sqlite_sequence') AND name!='migration_imports' ORDER BY name",
    )
    .all();
  const counts = [];
  for (const table of tables) {
    const name = String(table.name);
    const omitted =
      (name === "admins" && !args.includes("--include-admins")) ||
      (name === "sessions" && !args.includes("--include-sessions"));
    const expected = omitted
      ? []
      : source.prepare(`SELECT * FROM ${quote(name)}`).all();
    if (name === "media_publications") {
      const directory = resolve(
        option("--media") || join(dirname(sourcePath), "media"),
      );
      let names: string[] = [];
      try {
        names = await readdir(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      for (const id of names.filter(validMediaId))
        if (!expected.some((row) => row.id === id))
          expected.push({
            id,
            bytes: (await readFile(join(directory, id))).length,
          });
    }
    const actual = await target.prepare(`SELECT * FROM ${quote(name)}`).all();
    if (
      expected.length !== actual.length ||
      digest(expected) !== digest(actual)
    )
      throw Error("Table count/checksum differs: " + name);
    counts.push({ table: name, count: actual.length, checksum: "ok" });
  }
  if (
    (await target.prepare("PRAGMA integrity_check").get())?.integrity_check !==
      "ok" ||
    (await target.prepare("PRAGMA foreign_key_check").all()).length
  )
    throw Error("Destination integrity failed");
  const revision = await target
    .prepare("SELECT value FROM revision WHERE id=1")
    .get();
  if (
    revision?.value !==
    source.prepare("SELECT value FROM revision WHERE id=1").get()?.value
  )
    throw Error("Revision mismatch");
  let media = 0;
  const directory = resolve(
    option("--media") || join(dirname(sourcePath), "media"),
  );
  let names: string[] = [];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const id of names) {
    if (id.endsWith(".pending")) continue;
    if (!validMediaId(id)) throw Error("Unexpected source media");
    const bytes = await readFile(join(directory, id));
    const stored = await mediaStorage.get(id);
    if (
      !stored ||
      !Buffer.from(stored).equals(bytes) ||
      createHash("sha256").update(bytes).digest("hex") !== id.split(".")[0] ||
      !(await target
        .prepare("SELECT id FROM media_publications WHERE id=?")
        .get(id))
    )
      throw Error("Media checksum/publication mismatch");
    media++;
  }
  console.log(
    JSON.stringify({
      tables: counts,
      media,
      revision: revision?.value,
      integrity: "ok",
    }),
  );
} catch {
  console.error(
    "Verification failed. Inspect source/options/destination before enabling writers. No rows or secrets logged.",
  );
  process.exitCode = 1;
} finally {
  source.close();
  await target.close();
}
