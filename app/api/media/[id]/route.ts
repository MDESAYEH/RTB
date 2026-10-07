import { mediaStorage, validMediaId } from "@/lib/media-storage";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validMediaId(id)) return new Response(null, { status: 404 });
  try {
    const bytes = await mediaStorage.get(id);
    if (!bytes) return new Response(null, { status: 404 });
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
