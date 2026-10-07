/** Explicit maintenance CLI; defaults to a read-only inventory. Never deletes canonical media. */
import { list } from "@vercel/blob";
import { db } from "../lib/store";
import { privateBlobStorage } from "../lib/media-storage";
if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.TURSO_DATABASE_URL)
  throw Error("Private Blob and Turso credentials are required");
const apply = process.argv.includes("--apply");
const before = Date.now() - 24 * 60 * 60 * 1000;
let cursor: string | undefined;
let eligible = 0,
  removed = 0;
try {
  do {
    const page = await list({
      prefix: "staging/",
      cursor,
      limit: 100,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    for (const blob of page.blobs) {
      const id = blob.pathname.slice("staging/".length);
      if (!/^[a-f0-9]{64}$/.test(id) || blob.uploadedAt.getTime() > before)
        continue;
      const upload = await db
        .prepare("SELECT expires FROM media_uploads WHERE id=?")
        .get(id);
      if (upload && Number(upload.expires) > Date.now()) continue;
      eligible++;
      if (apply) {
        await privateBlobStorage().removeStaged(id);
        removed++;
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      eligible,
      removed,
      canonicalObjects: "untouched",
    }),
  );
} catch {
  console.error(
    "Staging cleanup failed; retry safely. No credentials or object data logged.",
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
