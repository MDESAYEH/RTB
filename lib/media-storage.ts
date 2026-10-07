import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertLocalStorageAllowed } from "./storage-config";
import { isVercel } from "./storage-config";
import { createHash } from "node:crypto";
import { get, put, del, BlobNotFoundError } from "@vercel/blob";

export interface MediaStorage {
  put(id: string, bytes: Uint8Array): Promise<void>;
  get(id: string): Promise<Uint8Array | undefined>;
}

export function validMediaId(id: string) {
  return /^[a-f0-9]{64}\.(png|jpg|webp)$/.test(id);
}

/** Immutable content-addressed files; construction never touches the filesystem. */
export class LocalMediaStorage implements MediaStorage {
  constructor(private root: string) {}
  private path(id: string) {
    assertLocalStorageAllowed();
    if (!validMediaId(id)) throw Error("Invalid media ID");
    return resolve(this.root, id);
  }
  async put(id: string, bytes: Uint8Array) {
    const path = this.path(id);
    await mkdir(dirname(path), { recursive: true });
    // Atomic publication: readers must never see a partially written image.
    const temporary = path + "." + crypto.randomUUID() + ".pending";
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      try {
        await link(temporary, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (!Buffer.from(bytes).equals(await readFile(path)))
          throw Error("Immutable media content mismatch");
      }
    } finally {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  async get(id: string) {
    const path = this.path(id);
    try {
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}

export type BlobOperations = {
  get: typeof get;
  put: typeof put;
  del: typeof del;
};
export class PrivateBlobStorage implements MediaStorage {
  constructor(
    private token: string,
    private operations: BlobOperations = { get, put, del },
  ) {}
  private pathname(id: string) {
    if (!validMediaId(id)) throw Error("Invalid media ID");
    if (!this.token)
      throw Error("BLOB_READ_WRITE_TOKEN is required for Private Vercel Blob");
    return "media/" + id;
  }
  private async read(pathname: string, useCache: boolean) {
    try {
      const result = await this.operations.get(pathname, {
        token: this.token,
        access: "private",
        useCache,
      });
      if (!result) return undefined;
      if (result.statusCode !== 200) throw Error("Unexpected Blob response");
      const url = new URL(result.blob.url);
      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".private.blob.vercel-storage.com") ||
        result.blob.pathname !== pathname ||
        url.pathname !== "/" + pathname
      )
        throw Error("Expected Private Blob store and exact object path");
      const { boundedBody } = await import("./request");
      return boundedBody(
        { headers: result.headers, body: result.stream },
        5242880,
      );
    } catch (error) {
      if (error instanceof BlobNotFoundError) return undefined;
      throw error;
    }
  }
  async put(id: string, bytes: Uint8Array) {
    const pathname = this.pathname(id);
    if (
      bytes.length > 5242880 ||
      createHash("sha256").update(bytes).digest("hex") !== id.split(".")[0]
    )
      throw Error("Media size or content hash mismatch");
    try {
      await this.operations.put(pathname, Buffer.from(bytes), {
        token: this.token,
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: id.endsWith(".webp")
          ? "image/webp"
          : id.endsWith(".png")
            ? "image/png"
            : "image/jpeg",
        cacheControlMaxAge: 31536000,
      });
    } catch (error) {
      const existing = await this.get(id);
      if (!existing || !Buffer.from(existing).equals(Buffer.from(bytes)))
        throw error;
    }
  }
  async get(id: string) {
    const bytes = await this.read(this.pathname(id), true);
    if (
      bytes &&
      createHash("sha256").update(bytes).digest("hex") !== id.split(".")[0]
    )
      throw Error("Blob content hash mismatch");
    return bytes;
  }
  async staged(id: string) {
    return this.read(stagingPath(id), false);
  }
  async removeStaged(id: string) {
    await this.operations.del(stagingPath(id), { token: this.token });
  }
}
export function stagingPath(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid upload ID");
  return "staging/" + id;
}
export function privateBlobStorage() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token)
    throw Error("BLOB_READ_WRITE_TOKEN is required for Private Blob uploads");
  return new PrivateBlobStorage(token);
}

function configuredMediaStorage(): MediaStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN)
    return new PrivateBlobStorage(process.env.BLOB_READ_WRITE_TOKEN);
  if (isVercel())
    throw Error(
      "BLOB_READ_WRITE_TOKEN is required on Vercel (Private Blob store)",
    );
  return new LocalMediaStorage(
    resolve(
      dirname(
        /* turbopackIgnore: true */ process.env.DATABASE_PATH || "data/road.db",
      ),
      "media",
    ),
  );
}
export const mediaStorage: MediaStorage = {
  put: async (id, bytes) => configuredMediaStorage().put(id, bytes),
  get: async (id) => configuredMediaStorage().get(id),
};
