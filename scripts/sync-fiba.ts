import { databaseConfig } from "../lib/sql-database";

// Default: apply FIBA data to the configured database (SQLite locally, Turso when TURSO_* is set).
//   --dry-run  plan only: prints what would change, writes nothing
//   --report   phase-1 comparison against the static registry, never opens the database
const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => !["--dry-run", "--report"].includes(arg));
if (unknown.length) {
  console.error(`Unknown option: ${unknown.join(", ")}\nUse --dry-run or --report.`);
  process.exit(2);
}

try {
  if (args.has("--report")) {
    const { formatReport, runDryRun } = await import("../lib/providers/fiba/sync");
    console.log(formatReport(await runDryRun()));
  } else {
    const target = databaseConfig();
    const where = target.kind === "sqlite" ? `SQLite ${target.path}` : `libSQL ${new URL(target.url).host}`;
    console.log(`Target database: ${where}`);
    const { store } = await import("../lib/store");
    const { runSync, formatSyncResult } = await import("../lib/providers/fiba/apply");
    console.log(formatSyncResult(await runSync(store, { apply: !args.has("--dry-run") })));
    await store.db.close();
  }
} catch (error) {
  console.error(
    `FIBA sync failed closed — no partial data was written.\n${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
