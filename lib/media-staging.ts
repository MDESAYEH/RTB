import { randomBytes } from "node:crypto";
import { z } from "zod";
import { store, type TournamentStore } from "./store";
export const chunkSize = 512 * 1024;
export const uploadMetadata = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .refine((name) => !/[\\/\x00]/.test(name) && !name.includes("..")),
  type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  size: z.number().int().min(1).max(5242880),
});
type Upload = z.infer<typeof uploadMetadata> & {
  id: string;
  actor: string;
  expires: number;
  result: string | null;
};
export function createMediaStaging(repository: TournamentStore = store) {
  const { db } = repository;
  const lookup = async (id: string, actor: string) => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid upload ID");
    const row = (await db
      .prepare(
        "SELECT * FROM media_uploads WHERE id=? AND actor=? AND expires>?",
      )
      .get(id, actor, Date.now())) as Upload | undefined;
    if (!row) throw Error("Upload missing or expired");
    return row;
  };
  return {
    async start(value: unknown, actor: string) {
      const metadata = uploadMetadata.parse(value);
      const id = randomBytes(32).toString("hex");
      await db.transaction(async () => {
        await db
          .prepare("DELETE FROM media_uploads WHERE expires<=?")
          .run(Date.now());
        // Bound retained private staging data even if the administrator abandons uploads.
        const count = await db
          .prepare(
            "SELECT count(*) n FROM media_uploads WHERE actor=? AND result IS NULL",
          )
          .get(actor);
        if (Number(count?.n) >= 20)
          throw Error("Too many pending uploads; retry after expiry");
        await db
          .prepare(
            "INSERT INTO media_uploads(id,actor,name,type,size,expires) VALUES(?,?,?,?,?,?)",
          )
          .run(
            id,
            actor,
            metadata.name,
            metadata.type,
            metadata.size,
            Date.now() + 15 * 60000,
          );
      })();
      return { uploadId: id, chunkSize };
    },
    async chunk(id: string, part: number, bytes: Uint8Array, actor: string) {
      await db.transaction(async () => {
        const upload = await lookup(id, actor);
        const parts = Math.ceil(upload.size / chunkSize);
        if (
          upload.result ||
          !Number.isInteger(part) ||
          part < 0 ||
          part >= parts ||
          bytes.length !== Math.min(chunkSize, upload.size - part * chunkSize)
        )
          throw Error("Invalid upload chunk");
        const previous = await db
          .prepare("SELECT bytes FROM media_chunks WHERE upload=? AND part=?")
          .get(id, part);
        if (previous) {
          if (
            !Buffer.from(previous.bytes as Uint8Array).equals(
              Buffer.from(bytes),
            )
          )
            throw Error("Upload chunk conflict");
          return;
        }
        await db
          .prepare("INSERT INTO media_chunks VALUES(?,?,?)")
          .run(id, part, Buffer.from(bytes));
      })();
    },
    async assemble(id: string, actor: string) {
      const upload = await lookup(id, actor);
      if (upload.result) return { result: upload.result };
      const chunks: Uint8Array[] = [];
      for (let part = 0; part < Math.ceil(upload.size / chunkSize); part++) {
        const row = await db
          .prepare("SELECT bytes FROM media_chunks WHERE upload=? AND part=?")
          .get(id, part);
        if (!row) throw Error("Upload incomplete");
        chunks.push(new Uint8Array(row.bytes as ArrayBuffer));
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length !== upload.size) throw Error("Upload size mismatch");
      return { file: new File([bytes], upload.name, { type: upload.type }) };
    },
    async finish(id: string, actor: string, mediaId: string, length: number) {
      return db.transaction(async () => {
        const upload = await lookup(id, actor);
        if (upload.result) {
          if (upload.result !== mediaId) throw Error("Upload result conflict");
          return;
        }
        await db
          .prepare(
            "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'upload')",
          )
          .run(
            actor,
            "media",
            mediaId,
            null,
            JSON.stringify({ bytes: length, format: "webp" }),
            new Date().toISOString(),
          );
        await db
          .prepare("UPDATE media_uploads SET result=? WHERE id=?")
          .run(mediaId, id);
        await db.prepare("DELETE FROM media_chunks WHERE upload=?").run(id);
      })();
    },
  };
}
export const mediaStaging = createMediaStaging();
