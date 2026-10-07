import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorize, rateLimit, db } from "@/lib/store";
import { mediaStorage } from "@/lib/media-storage";
import { boundedBody, PayloadLimit, trustedOrigin } from "@/lib/request";
import { validateImage } from "@/lib/image-upload";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  const actor = authorize((await cookies()).get("road-session")?.value);
  if (!actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit("upload:" + actor, 20))
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  if (Number(req.headers.get("content-length") || 0) > 5250000)
    return NextResponse.json({ error: "حد الصورة 5 MB" }, { status: 413 });
  try {
    const bytes = await boundedBody(req, 5250000);
    if (bytes.byteLength > 5250000) throw Error("حد الصورة 5 MB");
    const form = await new Response(Buffer.from(bytes), {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5242880)
      throw Error("حد الصورة 5 MB");
    const { id, bytes: clean } = await validateImage(file);
    await mediaStorage.put(id, clean);
    db.prepare(
      "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'upload')",
    ).run(
      actor,
      "media",
      id,
      null,
      JSON.stringify({ bytes: clean.length, format: "webp" }),
      new Date().toISOString(),
    );
    return NextResponse.json({ url: "/api/media/" + id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذر رفع الصورة" },
      { status: e instanceof PayloadLimit ? 413 : 400 },
    );
  }
}
