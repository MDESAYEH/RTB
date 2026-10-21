import { databaseConfig } from "../lib/sql-database";

// Links every match to its live broadcast on FIBA's YouTube channel (see lib/match-streams.ts).
// A link an organiser already set by hand is left alone. FIBA sync never overwrites a match's streamUrl.
//   --dry-run  only lists what would change
const dryRun = process.argv.includes("--dry-run");
const target = databaseConfig();
console.log(`Target database: ${target.kind === "sqlite" ? `SQLite ${target.path}` : `libSQL ${new URL(target.url).host}`}`);
const { store } = await import("../lib/store");
const { gameSchema } = await import("../lib/domain");
const { streamForTeams } = await import("../lib/match-streams");
const games = await store.list<{ id: string; home: string; away: string; streamUrl?: string; version: number; date: string }>("games");
let set = 0, same = 0, kept = 0, none = 0;
for (const g of games) {
  const url = streamForTeams(g.home, g.away);
  if (!url) { none++; console.log(`no stream known: ${g.id} ${g.home} v ${g.away}`); continue; }
  if (g.streamUrl === url) { same++; continue; }
  if (g.streamUrl) { kept++; console.log(`kept the manual link: ${g.id} (${g.streamUrl})`); continue; }
  console.log(`${dryRun ? "would link" : "link"}: ${g.id} ${g.home} v ${g.away} -> ${url}`);
  if (dryRun) { set++; continue; }
  await store.write(
    "games",
    g.id,
    gameSchema.parse({ ...g, streamUrl: url, version: g.version + 1, updatedAt: new Date().toISOString() }),
    "system:streams",
    "stream",
  );
  set++;
}
console.log(`${dryRun ? "Dry run" : "Done"}: ${set} linked, ${same} already linked, ${kept} manual kept, ${none} without a known stream.`);
await store.db.close();
