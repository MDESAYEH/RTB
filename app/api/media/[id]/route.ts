import { mediaStorage, validMediaId } from "@/lib/media-storage";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validMediaId(id)) return new Response(null, { status: 404 });
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { db } = await import("@/lib/store");
      if (
        !(await db
          .prepare("SELECT id FROM media_publications WHERE id=?")
          .get(id))
      )
        return new Response(null, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
    }
    const bytes = await mediaStorage.get(id);
    if (!bytes)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": id.endsWith(".jpg")
          ? "image/jpeg"
          : id.endsWith(".png")
            ? "image/png"
            : "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
