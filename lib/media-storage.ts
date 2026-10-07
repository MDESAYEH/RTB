import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertLocalStorageAllowed } from "./storage-config";
import { isVercel } from "./storage-config";
import { createHash } from "node:crypto";
import { head, put, BlobNotFoundError } from "@vercel/blob";

export interface MediaStorage {
  put(id: string, bytes: Uint8Array): Promise<void>;
  get(id: string): Promise<Uint8Array | undefined>;
  publicUrl?(id: string): Promise<string | undefined>;
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
  head: typeof head;
  put: typeof put;
  fetch: typeof fetch;
};
export class PublicBlobStorage implements MediaStorage {
  constructor(
    private token: string,
    private operations: BlobOperations = { head, put, fetch },
  ) {}
  private pathname(id: string) {
    if (!validMediaId(id)) throw Error("Invalid media ID");
    if (!this.token)
      throw Error("BLOB_READ_WRITE_TOKEN is required for Public Vercel Blob");
    return "media/" + id;
  }
  async publicUrl(id: string) {
    try {
      const blob = await this.operations.head(this.pathname(id), {
        token: this.token,
      });
      const url = new URL(blob.url);
      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        url.pathname !== "/media/" + id
      )
        throw Error(
          "Expected a Public Blob store and canonical media pathname",
        );
      return url.href;
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
        access: "public",
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
      // Duplicate requests may race. Only a byte-identical existing object counts as success.
      const existing = await this.get(id);
      if (!existing || !Buffer.from(existing).equals(Buffer.from(bytes)))
        throw error;
    }
  }
  async get(id: string) {
    const url = await this.publicUrl(id);
    if (!url) return undefined;
    const response = await this.operations.fetch(url, {
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw Error("Blob media read failed");
    const { boundedBody } = await import("./request");
    const bytes = await boundedBody(response, 5242880);
    if (createHash("sha256").update(bytes).digest("hex") !== id.split(".")[0])
      throw Error("Blob content hash mismatch");
    return bytes;
  }
}

function configuredMediaStorage(): MediaStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN)
    return new PublicBlobStorage(process.env.BLOB_READ_WRITE_TOKEN);
  if (isVercel())
    throw Error(
      "BLOB_READ_WRITE_TOKEN is required on Vercel (Public Blob store)",
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
  publicUrl: async (id) =>
    configuredMediaStorage().publicUrl?.(id) ?? Promise.resolve(undefined),
};
