import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(id))
    return new Response(null, { status: 404 });
  try {
    const bytes = readFileSync(
      resolve(
        dirname(process.env.DATABASE_PATH || "data/road.db"),
        "media",
        id,
      ),
    );
    return new Response(bytes, {
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
    return new Response(null, { status: 404 });
  }
}
