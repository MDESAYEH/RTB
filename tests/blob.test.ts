import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { BlobNotFoundError } from "@vercel/blob";
import { PublicBlobStorage, type BlobOperations } from "../lib/media-storage";
import { uploadMedia } from "../lib/media-client";

test("Public Blob keeps immutable canonical hashes, deduplicates, and validates the store URL", async () => {
  const blobs = new Map<string, Buffer>();
  const calls: unknown[] = [];
  const operations: BlobOperations = {
    head: async (path) => {
      if (!blobs.has(path)) throw new BlobNotFoundError();
      return {
        url: "https://test.public.blob.vercel-storage.com/" + path,
      } as Awaited<ReturnType<BlobOperations["head"]>>;
    },
    put: async (path, body, options) => {
      calls.push(options);
      assert.equal(options.access, "public");
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.cacheControlMaxAge, 31536000);
      if (blobs.has(path)) throw Error("already exists");
      blobs.set(path, Buffer.from(body as Buffer));
      return {
        url: "https://test.public.blob.vercel-storage.com/" + path,
      } as Awaited<ReturnType<BlobOperations["put"]>>;
    },
    fetch: async (url) =>
      new Response(
        Buffer.from(blobs.get(new URL(String(url)).pathname.slice(1))!),
      ),
  };
  const storage = new PublicBlobStorage("test-token", operations);
  const bytes = Buffer.from("test sanitized content");
  const id = createHash("sha256").update(bytes).digest("hex") + ".webp";
  assert.equal(await storage.publicUrl(id), undefined);
  await storage.put(id, bytes);
  await storage.put(id, bytes);
  assert.equal(calls.length, 2);
  assert.deepEqual(await storage.get(id), new Uint8Array(bytes));
  assert.equal(
    await storage.publicUrl(id),
    "https://test.public.blob.vercel-storage.com/media/" + id,
  );
  await assert.rejects(
    storage.put(id, Buffer.from("changed")),
    /hash mismatch/,
  );
  await assert.rejects(storage.put("../bad", bytes), /Invalid media ID/);
  const privateStore = new PublicBlobStorage("test-token", {
    ...operations,
    head: async () =>
      ({
        url: "https://test.private.blob.vercel-storage.com/media/" + id,
      }) as Awaited<ReturnType<BlobOperations["head"]>>,
  });
  await assert.rejects(privateStore.publicUrl(id), /Public Blob/);
  const failedStore = new PublicBlobStorage("test-token", {
    ...operations,
    head: async () => {
      throw Error("storage unavailable");
    },
  });
  await assert.rejects(failedStore.publicUrl(id), /unavailable/);
});

test("media client sends 5 MB as bounded requests and preserves final API URL", async () => {
  const before = globalThis.fetch;
  const chunks: number[] = [];
  try {
    globalThis.fetch = async (url, options) => {
      if (options?.method === "PUT") {
        chunks.push((options.body as Blob).size);
        assert.match(String(url), /^\/api\/media\?upload=/);
        return Response.json({ ok: true });
      }
      const command = JSON.parse(String(options?.body));
      if (command.action === "start")
        return Response.json({ uploadId: "a".repeat(64), chunkSize: 524288 });
      return Response.json({ url: "/api/media/" + "b".repeat(64) + ".webp" });
    };
    const value = await uploadMedia(
      new File([new Uint8Array(5242880)], "large.png", { type: "image/png" }),
    );
    assert.equal(chunks.length, 10);
    assert.equal(
      chunks.reduce((sum, value) => sum + value, 0),
      5242880,
    );
    assert.ok(chunks.every((size) => size <= 524288));
    assert.match(value.url, /^\/api\/media\/[a-f0-9]{64}\.webp$/);
    await assert.rejects(
      uploadMedia(
        new File([new Uint8Array(5242881)], "too-large.png", {
          type: "image/png",
        }),
      ),
      /5 MB/,
    );
  } finally {
    globalThis.fetch = before;
  }
});
