import { test } from "node:test";
import assert from "node:assert/strict";
import { newsSchema } from "../lib/domain";
import { streamEmbed } from "../lib/stream";

const base = {
  id: "n1",
  slug: "n1",
  title: "عنوان",
  excerpt: "مقدمة",
  content: "نص",
  author: "QA",
  publishedAt: "2026-10-17T10:00:00+02:00",
  status: "published",
};

test("a news article can carry a video link instead of a picture", () => {
  const parsed = newsSchema.parse({ ...base, video: "https://youtu.be/dQw4w9WgXcQ" });
  assert.equal(parsed.video, "https://youtu.be/dQw4w9WgXcQ");
  const embed = streamEmbed(parsed.video);
  assert.equal(embed?.kind, "iframe");
  assert.match(embed && "src" in embed ? embed.src : "", /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
});

test("the video link is optional and must be HTTPS", () => {
  assert.equal(newsSchema.parse({ ...base }).video, undefined);
  assert.equal(newsSchema.parse({ ...base, video: "" }).video, "");
  assert.throws(() => newsSchema.parse({ ...base, video: "http://example.com/v" }));
});

test("direct video files are recognised, other links are not", async () => {
  const { directVideo } = await import("../lib/stream");
  assert.equal(directVideo("https://example.com/clip.mp4"), "https://example.com/clip.mp4");
  assert.equal(directVideo("https://example.com/a/b.WEBM?x=1"), "https://example.com/a/b.WEBM?x=1");
  assert.equal(directVideo("http://example.com/clip.mp4"), null);
  assert.equal(directVideo("https://youtu.be/dQw4w9WgXcQ"), null);
  assert.equal(directVideo(""), null);
});
