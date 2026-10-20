import { join } from "node:path";
import { databaseConfig } from "../lib/sql-database";

// Adds the posts from content/facebook-news (taken from the tournament's Facebook page) as news articles,
// with their Arabic and English text and cover images. Existing articles are never overwritten.
//   --dry-run  only lists what would be added
const dryRun = process.argv.includes("--dry-run");
const target = databaseConfig();
console.log(`Target database: ${target.kind === "sqlite" ? `SQLite ${target.path}` : `libSQL ${new URL(target.url).host}`}`);
const { store } = await import("../lib/store");
const { mediaStorage } = await import("../lib/media-storage");
const { loadFacebookNews, coverFromFile, newsRecord, facebookNewsDirectory } = await import("../lib/facebook-news");
const file = await loadFacebookNews();
let added = 0;
for (const post of file.posts) {
  const id = `facebook-${post.slug}`;
  if (await store.get("news", id)) {
    console.log(`exists, skipped: ${id}`);
    continue;
  }
  const cover = await coverFromFile(join(facebookNewsDirectory, post.image));
  const extra = await Promise.all(
    (post.gallery ?? []).map((name) => coverFromFile(join(facebookNewsDirectory, name))),
  );
  const record = newsRecord(post, file.author, cover.id, extra.map((e) => e.id));
  console.log(`${dryRun ? "would add" : "add"} [${post.status}]: ${id} ${post.title}`);
  if (dryRun) continue;
  await mediaStorage.put(cover.id, cover.bytes);
  for (const e of extra) await mediaStorage.put(e.id, e.bytes);
  await store.write("news", id, record, "system:facebook-import", "facebook-import");
  added++;
}
console.log(`${dryRun ? "Dry run" : "Done"}: ${added} article(s) added.`);
await store.db.close();
