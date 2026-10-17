import { databaseConfig } from "../lib/sql-database";

// Deletes every news article (audited, one by one). The news page stays empty until new items are added.
//   --dry-run  only lists what would be deleted
const dryRun = process.argv.includes("--dry-run");
const target = databaseConfig();
const where = target.kind === "sqlite" ? `SQLite ${target.path}` : `libSQL ${new URL(target.url).host}`;
console.log(`Target database: ${where}`);
const { store } = await import("../lib/store");
const items = await store.list<{ id: string; title?: string }>("news");
for (const item of items) {
  console.log(`${dryRun ? "would delete" : "delete"}: ${item.id} ${item.title ?? ""}`);
  if (!dryRun && !(await store.remove("news", item.id, "system:clear-news", "clear-news")))
    console.warn(`kept (still referenced): ${item.id}`);
}
console.log(`${items.length} article(s) ${dryRun ? "found" : "processed"}.`);
await store.db.close();
