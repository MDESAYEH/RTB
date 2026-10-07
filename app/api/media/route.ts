import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorize, rateLimit, db } from "@/lib/store";
import { privateBlobStorage, mediaStorage } from "@/lib/media-storage";
import { mediaStaging, chunkSize } from "@/lib/media-staging";
import { boundedBody, PayloadLimit, trustedOrigin } from "@/lib/request";
import { validateImage } from "@/lib/image-upload";
export const runtime = "nodejs";
export const maxDuration = 60;
async function actorFor(req: Request) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  const actor = await authorize((await cookies()).get("road-session")?.value);
  if (!actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return actor;
}
export async function POST(req: NextRequest) {
  const actor = await actorFor(req);
  if (typeof actor !== "string") return actor;
  try {
    if (req.headers.get("content-type")?.startsWith("application/json")) {
      const value = JSON.parse(
        new TextDecoder().decode(await boundedBody(req, 10000)),
      );
      if (value.action === "start") {
        if (!(await rateLimit("upload:" + actor, 20)))
          return NextResponse.json(
            { error: "Too many uploads" },
            { status: 429 },
          );
        const upload = await mediaStaging.start(value, actor);
        return NextResponse.json(
          process.env.BLOB_READ_WRITE_TOKEN
            ? {
                ...upload,
                ...(await mediaStaging.credential(upload.uploadId, actor)),
              }
            : upload,
        );
      }
      if (value.action !== "complete" || typeof value.uploadId !== "string")
        throw Error("Invalid upload action");
      if (!(await rateLimit("upload-complete:" + actor, 40)))
        return NextResponse.json(
          { error: "Too many upload attempts" },
          { status: 429 },
        );
      const upload = await mediaStaging.assemble(value.uploadId, actor);
      if (upload.result) {
        if (process.env.BLOB_READ_WRITE_TOKEN)
          await privateBlobStorage()
            .removeStaged(value.uploadId)
            .catch(() => undefined);
        return NextResponse.json({ url: "/api/media/" + upload.result });
      }
      const { id, bytes } = await validateImage(upload.file!);
      await mediaStorage.put(id, bytes);
      await mediaStaging.finish(value.uploadId, actor, id, bytes.length);
      // Cleanup after commit only. Retry can return the persisted result if deletion fails.
      if (process.env.BLOB_READ_WRITE_TOKEN)
        await privateBlobStorage()
          .removeStaged(value.uploadId)
          .catch(() => undefined);
      return NextResponse.json({ url: "/api/media/" + id });
    }
    // Keep the existing multipart API for small uploads and local integrations.
    if (!(await rateLimit("upload:" + actor, 20)))
      return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
    const bytes = await boundedBody(req, 5250000);
    const form = await new Response(Buffer.from(bytes), {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("�� ������ 5 MB");
    const { id, bytes: clean } = await validateImage(file);
    await mediaStorage.put(id, clean);
    await db.transaction(async () => {
      await db
        .prepare(
          "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'upload')",
        )
        .run(
          actor,
          "media",
          id,
          null,
          JSON.stringify({ bytes: clean.length, format: "webp" }),
          new Date().toISOString(),
        );
      await db
        .prepare("INSERT OR IGNORE INTO media_publications VALUES(?,?)")
        .run(id, clean.length);
    })();
    return NextResponse.json({ url: "/api/media/" + id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "���� ��� ������" },
      {
        status: error instanceof PayloadLimit ? 413 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export async function PUT(req: NextRequest) {
  const actor = await actorFor(req);
  if (typeof actor !== "string") return actor;
  if (process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json(
      { error: "Use private staged upload" },
      { status: 400 },
    );
  if (!(await rateLimit("upload-chunk:" + actor, 400)))
    return NextResponse.json(
      { error: "Too many upload chunks" },
      { status: 429 },
    );
  try {
    const upload = req.nextUrl.searchParams.get("upload") || "";
    const rawPart = req.nextUrl.searchParams.get("part");
    if (!rawPart || !/^\d+$/.test(rawPart)) throw Error("Invalid upload part");
    await mediaStaging.chunk(
      upload,
      Number(rawPart),
      await boundedBody(req, chunkSize),
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "���� ��� ������" },
      {
        status: error instanceof PayloadLimit ? 413 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
