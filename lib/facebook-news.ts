import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import { newsSchema, type News } from "./domain";

export interface FacebookPost {
  slug: string;
  image: string;
  publishedAt: string;
  status: "draft" | "published";
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  content: string;
  contentEn: string;
  /** YouTube / Facebook video link shown on the article instead of the picture. */
  video?: string;
  /** Extra pictures (file names in this folder) shown under the text. */
  gallery?: string[];
}
export interface FacebookNewsFile {
  author: string;
  posts: FacebookPost[];
}

export const facebookNewsDirectory = join(process.cwd(), "content", "facebook-news");

export async function loadFacebookNews(
  directory = facebookNewsDirectory,
): Promise<FacebookNewsFile> {
  return JSON.parse(await readFile(join(directory, "posts.json"), "utf8"));
}

/** Same cleaning as the admin upload: re-encoded WebP, content-addressed by its SHA-256. */
export async function coverFromFile(path: string) {
  const bytes = await sharp(await readFile(path), { limitInputPixels: 16000000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  return { id: createHash("sha256").update(bytes).digest("hex") + ".webp", bytes };
}

export function newsRecord(
  post: FacebookPost,
  author: string,
  coverId: string,
  galleryIds: string[] = [],
): News {
  return newsSchema.parse({
    id: `facebook-${post.slug}`,
    slug: post.slug,
    title: post.title,
    titleEn: post.titleEn,
    excerpt: post.excerpt,
    excerptEn: post.excerptEn,
    content: post.content,
    contentEn: post.contentEn,
    author,
    publishedAt: new Date(post.publishedAt).toISOString(),
    status: post.status,
    cover: `/api/media/${coverId}`,
    ...(post.video ? { video: post.video } : {}),
    ...(galleryIds.length ? { gallery: galleryIds.map((id) => `/api/media/${id}`) } : {}),
  });
}
