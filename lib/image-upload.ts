import sharp from "sharp";
import { createHash } from "node:crypto";
export async function validateImage(file: File) {
  if (file.size > 5242880 || !file.size) throw Error("حد الصورة 5 MB");
  if (/[\\/\x00]/.test(file.name) || file.name.includes(".."))
    throw Error("اسم الملف غير مقبول");
  const extension = file.name.toLowerCase().split(".").pop();
  const expected = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  }[extension || ""];
  if (!expected || file.type !== expected)
    throw Error("صيغة أو محتوى الصورة غير مقبول");
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = sharp(bytes, {
    limitInputPixels: 16000000,
    failOn: "warning",
    animated: false,
  });
  const meta = await image.metadata();
  const format =
    extension === "jpg" || extension === "jpeg" ? "jpeg" : extension;
  if (
    meta.format !== format ||
    (meta.pages || 1) > 1 ||
    !meta.width ||
    !meta.height
  )
    throw Error("صيغة أو محتوى الصورة غير مقبول");
  // Full decode rejects truncated/fake headers. Re-encoding removes metadata and appended payloads.
  const clean = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toBuffer();
  if (clean.length > 5242880) throw Error("حد الصورة 5 MB");
  const id = createHash("sha256").update(clean).digest("hex") + ".webp";
  return { id, bytes: clean };
}
