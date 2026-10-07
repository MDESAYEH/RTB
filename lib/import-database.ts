import { DatabaseSync, backup } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { InValue } from "@libsql/client";
import { SqlDatabase } from "./sql-database";
import type { MediaStorage } from "./media-storage";
import { validMediaId } from "./media-storage";
import { storageSchema } from "./storage-schema";
import { clubProfiles } from "./club-profile";

const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
type SchemaRow = { type: string; name: string; sql: string };
export type ImportOptions = {
  source: string;
  mediaDirectory: string;
  database: SqlDatabase;
  media: MediaStorage;
  includeAdmins?: boolean;
  includeSessions?: boolean;
};

/** Only the explicit CLI invokes this. Never imports at request startup. */
export async function importDatabase(options: ImportOptions) {
  if (options.includeSessions && !options.includeAdmins)
    throw Error("Session import requires explicit admin credential import");
  const temporary = await mkdtemp(join(tmpdir(), "road-import-"));
  let snapshot: DatabaseSync | undefined;
  try {
    const source = new DatabaseSync(resolve(options.source), {
      readOnly: true,
    });
    try {
      await backup(source, join(temporary, "snapshot.db"));
    } finally {
      source.close();
    }
    snapshot = new DatabaseSync(join(temporary, "snapshot.db"), {
      readOnly: true,
    });
    if (
      snapshot.prepare("PRAGMA integrity_check").get()?.integrity_check !==
        "ok" ||
      snapshot.prepare("PRAGMA foreign_key_check").all().length
    )
      throw Error("Source integrity or foreign keys failed");
    const version = Number(
      snapshot.prepare("PRAGMA user_version").get()?.user_version,
    );
    if (![3, 4].includes(version))
      throw Error(
        "Source must have schema version 3 or 4; upgrade an isolated copy first",
      );
    const schema = snapshot
      .prepare(
        "SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name",
      )
      .all() as SchemaRow[];
    const tables = schema.filter(
      (row) => row.type === "table" && row.name !== "migration_imports",
    );
    const content = tables.map((table) => ({
      ...table,
      columns: (
        snapshot!
          .prepare(`PRAGMA table_info(${identifier(table.name)})`)
          .all() as { name: string }[]
      ).map((row) => row.name),
      rows: snapshot!.prepare(`SELECT * FROM ${identifier(table.name)}`).all(),
    }));
    if (
      !content
        .find((table) => table.name === "records")
        ?.rows.some((row) => row.kind === "settings" && row.id === "tournament")
    )
      throw Error("Source has no tournament settings");
    let names: string[];
    try {
      names = await readdir(options.mediaDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      names = [];
    }
    const media = [] as { id: string; bytes: Buffer }[];
    for (const id of names.sort()) {
      if (id.endsWith(".pending")) continue;
      if (!validMediaId(id))
        throw Error(
          "Unexpected media file; inspect source media directory before import",
        );
      const bytes = await readFile(join(options.mediaDirectory, id));
      if (
        bytes.length > 5242880 ||
        createHash("sha256").update(bytes).digest("hex") !== id.split(".")[0]
      )
        throw Error("Source media checksum or size failed");
      // Validate legacy rasters without changing the immutable original URL or bytes.
      const sharp = (await import("sharp")).default;
      const image = sharp(bytes, {
        limitInputPixels: 16000000,
        failOn: "warning",
        animated: false,
      });
      const metadata = await image.metadata();
      const format = id.endsWith(".jpg") ? "jpeg" : id.split(".")[1];
      if (metadata.format !== format || (metadata.pages || 1) > 1)
        throw Error("Source media format failed");
      await image.raw().toBuffer();
      media.push({ id, bytes });
    }
    const normalized = content.map((table) => ({
      name: table.name,
      columns: table.columns,
      rows: table.rows
        .map((row) =>
          JSON.stringify(row, (_key, value) =>
            value instanceof Uint8Array
              ? { base64: Buffer.from(value).toString("base64") }
              : value,
          ),
        )
        .sort(),
    }));
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          schema,
          normalized,
          media: media.map((m) => m.id),
          admins: !!options.includeAdmins,
          sessions: !!options.includeSessions,
        }),
      )
      .digest("hex");
    const db = options.database;
    const existingTables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    if (existingTables.some((row) => row.name === "migration_imports")) {
      const previous = await db
        .prepare(
          "SELECT fingerprint FROM migration_imports WHERE id='sqlite-import'",
        )
        .get();
      if (previous?.fingerprint === fingerprint)
        return {
          status: "already-imported",
          tables: content.length,
          media: media.length,
        };
      if (previous)
        throw Error(
          "Different source/options already imported; refusing overwrite",
        );
    }
    if (existingTables.some((row) => row.name !== "migration_imports"))
      throw Error("Destination must be empty; refusing merge or overwrite");
    // Publish immutable sanitized source media first; SQL rollback may leave safe unreferenced objects.
    for (const item of media) await options.media.put(item.id, item.bytes);
    return await db.transaction(async () => {
      await db.exec(
        "CREATE TABLE IF NOT EXISTS migration_imports(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,time TEXT NOT NULL)",
      );
      const previous = await db
        .prepare(
          "SELECT fingerprint FROM migration_imports WHERE id='sqlite-import'",
        )
        .get();
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw Error("Concurrent different import; refusing overwrite");
        return {
          status: "already-imported",
          tables: content.length,
          media: media.length,
        };
      }
      const otherTables = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='migration_imports'",
        )
        .all();
      if (otherTables.length)
        throw Error("Destination changed during import; refusing overwrite");
      // FK checks are deferred until the full source graph has been inserted.
      await db.exec("PRAGMA defer_foreign_keys=ON");
      const statements: { sql: string; args?: InValue[] }[] = tables.map(
        (table) => ({ sql: table.sql }),
      );
      const expected: { name: string; count: number }[] = [];
      for (const table of content) {
        const rows =
          (table.name === "admins" && !options.includeAdmins) ||
          (table.name === "sessions" && !options.includeSessions)
            ? []
            : table.rows;
        expected.push({ name: table.name, count: rows.length });
        const sql = `INSERT INTO ${identifier(table.name)}(${table.columns.map(identifier).join(",")}) VALUES(${table.columns.map(() => "?").join(",")})`;
        for (const row of rows)
          statements.push({
            sql,
            args: table.columns.map((column) => row[column] as InValue),
          });
      }
      // Bounded batches reduce round trips without releasing the transaction lock.
      let batch: typeof statements = [];
      let size = 0;
      for (const statement of statements) {
        const bytes = Buffer.byteLength(
          JSON.stringify(statement, (_key, value) =>
            value instanceof Uint8Array
              ? Buffer.from(value).toString("base64")
              : value,
          ),
        );
        if (bytes > 1500000)
          throw Error("Source row exceeds safe import batch size");
        if (batch.length >= 100 || size + bytes > 1500000) {
          await db.batch(batch);
          batch = [];
          size = 0;
        }
        batch.push(statement);
        size += bytes;
      }
      if (batch.length) await db.batch(batch);
      for (const table of expected) {
        const count = await db
          .prepare(`SELECT count(*) n FROM ${identifier(table.name)}`)
          .get();
        if (Number(count?.n) !== table.count)
          throw Error("Imported row count mismatch");
      }
      for (const row of schema.filter((row) => row.type !== "table"))
        await db.exec(row.sql);
      await db.exec(storageSchema);
      await db.exec(
        "CREATE TABLE IF NOT EXISTS club_profiles(id TEXT PRIMARY KEY,body TEXT NOT NULL CHECK(json_valid(body)))",
      );
      await db.batch(
        clubProfiles.map((profile) => ({
          sql: "INSERT OR IGNORE INTO club_profiles VALUES(?,?)",
          args: [profile.id, JSON.stringify(profile)],
        })),
      );
      if ((await db.prepare("PRAGMA foreign_key_check").all()).length)
        throw Error("Destination references failed");
      const sourceRevision = content.find((table) => table.name === "revision")
        ?.rows[0]?.value;
      if (
        (await db.prepare("SELECT value FROM revision WHERE id=1").get())
          ?.value !== sourceRevision
      )
        throw Error("Revision changed during import");
      await db
        .prepare("INSERT INTO migration_imports VALUES('sqlite-import',?,?)")
        .run(fingerprint, new Date().toISOString());
      return {
        status: "imported",
        tables: content.length,
        media: media.length,
      };
    })();
  } finally {
    snapshot?.close();
    // Only our verified OS temporary snapshot directory is removed.
    if (
      resolve(temporary).startsWith(
        resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"),
      )
    )
      await rm(temporary, { recursive: true, force: true });
  }
}
