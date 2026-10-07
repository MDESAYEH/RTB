import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { getPayloadFromClientToken } from "@vercel/blob/client";
import { createTournamentStore } from "../lib/store";
import { createMediaStaging } from "../lib/media-staging";
import { PrivateBlobStorage, type BlobOperations } from "../lib/media-storage";
import { validateImage } from "../lib/image-upload";

test("private staging signs exact scoped credentials, sanitizes bytes and gates publication on atomic audit", async () => {
  const root = await mkdtemp(join(tmpdir(), "road-private-flow-"));
  const repo = createTournamentStore(() => ({
    kind: "sqlite",
    path: join(root, "road.db"),
  }));
  const stage = createMediaStaging(repo);
  const old = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_testonlysecret";
  const blobs = new Map<string, Buffer>();
  const ops: BlobOperations = {
    get: async (path, options) => {
      assert.equal(options.access, "private");
      const bytes = blobs.get(path);
      if (!bytes) return null;
      return {
        statusCode: 200,
        headers: new Headers(),
        stream: new Response(Buffer.from(bytes)).body!,
        blob: {
          pathname: path,
          url: "https://test.private.blob.vercel-storage.com/" + path,
        },
      } as unknown as Awaited<ReturnType<BlobOperations["get"]>>;
    },
    put: async (path, body, options) => {
      assert.equal(options.access, "private");
      blobs.set(path, Buffer.from(body as Buffer));
      return {} as Awaited<ReturnType<BlobOperations["put"]>>;
    },
    del: async (path) => {
      blobs.delete(path as string);
    },
  };
  const remote = new PrivateBlobStorage(process.env.BLOB_READ_WRITE_TOKEN, ops);
  try {
    const raw = await sharp({
      create: { width: 48, height: 48, channels: 3, background: "#ff5500" },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    const started = await stage.start(
      { name: "test.jpg", type: "image/jpeg", size: raw.length },
      "admin",
    );
    await assert.rejects(
      stage.credential(started.uploadId, "other"),
      /missing/,
    );
    const signed = await stage.credential(started.uploadId, "admin");
    const payload = getPayloadFromClientToken(signed.clientToken);
    assert.equal(payload.pathname, "staging/" + started.uploadId);
    assert.equal(payload.maximumSizeInBytes, raw.length);
    assert.deepEqual(payload.allowedContentTypes, ["image/jpeg"]);
    assert.equal(payload.allowOverwrite, false);
    assert.equal(payload.addRandomSuffix, false);
    assert.ok(payload.validUntil <= Date.now() + 5 * 60000);
    blobs.set(signed.pathname, raw);
    const input = await stage.assemble(started.uploadId, "admin", remote);
    const clean = await validateImage(input.file!);
    const metadata = await sharp(clean.bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    await remote.put(clean.id, clean.bytes);
    await repo.db.exec(
      "CREATE TRIGGER fail_media BEFORE INSERT ON audit WHEN NEW.kind='media' BEGIN SELECT RAISE(ABORT,'audit failure'); END",
    );
    await assert.rejects(
      stage.finish(started.uploadId, "admin", clean.id, clean.bytes.length),
      /audit failure/,
    );
    assert.equal(
      await repo.db
        .prepare("SELECT * FROM media_publications WHERE id=?")
        .get(clean.id),
      undefined,
    );
    assert.equal(
      (
        await repo.db
          .prepare("SELECT result FROM media_uploads WHERE id=?")
          .get(started.uploadId)
      ).result,
      null,
    );
    assert.ok(blobs.has(signed.pathname));
    assert.ok(blobs.has("media/" + clean.id));
    await repo.db.exec("DROP TRIGGER fail_media");
    await stage.finish(started.uploadId, "admin", clean.id, clean.bytes.length);
    await stage.finish(started.uploadId, "admin", clean.id, clean.bytes.length);
    assert.equal(
      (
        await repo.db
          .prepare("SELECT count(*) n FROM audit WHERE kind='media'")
          .get()
      ).n,
      1,
    );
    assert.ok(
      await repo.db
        .prepare("SELECT * FROM media_publications WHERE id=?")
        .get(clean.id),
    );
    await remote.removeStaged(started.uploadId);
    assert.equal(await remote.staged(started.uploadId), undefined);
    await assert.rejects(
      stage.credential(started.uploadId, "admin"),
      /completed/,
    );
  } finally {
    if (old === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = old;
    await repo.db.close();
    await rm(root, { recursive: true, force: true });
  }
});
