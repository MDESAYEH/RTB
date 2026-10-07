import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertLocalStorageAllowed } from "./storage-config";

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

export const mediaStorage: MediaStorage = new LocalMediaStorage(
  resolve(
    dirname(
      /* turbopackIgnore: true */ process.env.DATABASE_PATH || "data/road.db",
    ),
    "media",
  ),
);
