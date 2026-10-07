import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrivateBlobStorage, type BlobOperations } from "../lib/media-storage";
import { uploadMedia } from "../lib/media-client";
test("Private Blob authenticates reads, enforces immutable hashes and refuses public objects", async () => {
  const blobs = new Map<string, Buffer>();
  const operations: BlobOperations = {
    get: async (path, options) => {
      assert.equal(options.access, "private");
      assert.equal(options.token, "test-token");
      const bytes = blobs.get(path);
      if (!bytes) return null;
      return {
        statusCode: 200,
        stream: new Response(Buffer.from(bytes)).body!,
        headers: new Headers(),
        blob: {
          url: "https://test.private.blob.vercel-storage.com/" + path,
          pathname: path,
        },
      } as unknown as Awaited<ReturnType<BlobOperations["get"]>>;
    },
    put: async (path, body, options) => {
      assert.equal(options.access, "private");
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      if (blobs.has(path)) throw Error("already exists");
      blobs.set(path, Buffer.from(body as Buffer));
      return {} as Awaited<ReturnType<BlobOperations["put"]>>;
    },
    del: async (path) => {
      blobs.delete(path as string);
    },
  };
  const storage = new PrivateBlobStorage("test-token", operations);
  const bytes = Buffer.from("test sanitized content");
  const id = createHash("sha256").update(bytes).digest("hex") + ".webp";
  assert.equal(await storage.get(id), undefined);
  await storage.put(id, bytes);
  await storage.put(id, bytes);
  assert.deepEqual(await storage.get(id), new Uint8Array(bytes));
  await assert.rejects(
    storage.put(id, Buffer.from("changed")),
    /hash mismatch/,
  );
  await assert.rejects(storage.get("../raw"), /Invalid media/);
  const publicStore = new PrivateBlobStorage("test-token", {
    ...operations,
    get: async (path) =>
      ({
        statusCode: 200,
        stream: new Response(bytes).body!,
        headers: new Headers(),
        blob: {
          url: "https://test.public.blob.vercel-storage.com/" + path,
          pathname: path,
        },
      }) as unknown as Awaited<ReturnType<BlobOperations["get"]>>,
  });
  await assert.rejects(publicStore.get(id), /Private Blob/);
  const failed = new PrivateBlobStorage("test-token", {
    ...operations,
    get: async () => {
      throw Error("backend unavailable");
    },
  });
  await assert.rejects(failed.get(id), /unavailable/);
  const stage = "a".repeat(64);
  blobs.set("staging/" + stage, bytes);
  assert.deepEqual(await storage.staged(stage), new Uint8Array(bytes));
  await storage.removeStaged(stage);
  assert.equal(await storage.staged(stage), undefined);
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
