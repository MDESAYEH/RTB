import { resolve, dirname, join } from "node:path";
import { importDatabase } from "../lib/import-database";
import { SqlDatabase, databaseConfig } from "../lib/sql-database";
import { mediaStorage } from "../lib/media-storage";
const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw Error("Missing value for " + flag);
  return args[index + 1];
};
if (!args.includes("--confirm-empty-destination"))
  throw Error(
    "Use --confirm-empty-destination after stopping all writers and checking target credentials",
  );
const config = databaseConfig();
if (config.kind !== "libsql")
  throw Error(
    "db:import requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN; local source cannot be the destination",
  );
if (!process.env.BLOB_READ_WRITE_TOKEN)
  throw Error("BLOB_READ_WRITE_TOKEN is required for the media destination");
const source = resolve(value("--source") || "data/road.db");
const database = new SqlDatabase(() => config);
try {
  console.log(
    await importDatabase({
      source,
      mediaDirectory: resolve(
        value("--media") || join(dirname(source), "media"),
      ),
      database,
      media: mediaStorage,
      includeAdmins: args.includes("--include-admins"),
      includeSessions: args.includes("--include-sessions"),
    }),
  );
} catch {
  // SDK errors can contain SQL parameters or service URLs. Do not log them from a credential import.
  console.error(
    "Import failed; destination transaction was not confirmed. Check configuration/source integrity and retry the identical snapshot. No rows or secrets were logged.",
  );
  process.exitCode = 1;
} finally {
  await database.close();
}
