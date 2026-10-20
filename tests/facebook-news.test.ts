import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { access } from "node:fs/promises";
import {
  coverFromFile,
  facebookNewsDirectory,
  loadFacebookNews,
  newsRecord,
} from "../lib/facebook-news";

test("every imported Facebook post is valid, translated and has a cover", async () => {
  const file = await loadFacebookNews();
  assert.ok(file.posts.length >= 4);
  const slugs = new Set<string>();
  for (const post of file.posts) {
    assert.ok(!slugs.has(post.slug), `duplicate slug ${post.slug}`);
    slugs.add(post.slug);
    for (const key of ["titleEn", "excerptEn", "contentEn"] as const)
      assert.ok(post[key].trim(), `${post.slug}: ${key} is empty`);
    assert.doesNotMatch(post.titleEn, /[\u0600-\u06FF]/, `${post.slug}: Arabic left in titleEn`);
    assert.doesNotMatch(post.contentEn, /[\u0600-\u06FF]/, `${post.slug}: Arabic left in contentEn`);
    await access(join(facebookNewsDirectory, post.image));
    const cover = await coverFromFile(join(facebookNewsDirectory, post.image));
    const record = newsRecord(post, file.author, cover.id);
    assert.match(record.cover ?? "", /^\/api\/media\/[a-f0-9]{64}\.webp$/);
  }
});

test("posts that are videos carry a link the site can embed", async () => {
  const { streamEmbed } = await import("../lib/stream");
  const file = await loadFacebookNews();
  const videos = file.posts.filter((p) => p.video);
  for (const post of videos)
    assert.ok(
      streamEmbed(post.video)?.kind === "iframe" || post.video!.startsWith("/videos/"),
      `${post.slug}: video link cannot be shown`,
    );
});

test("gallery pictures exist and become media links", async () => {
  const file = await loadFacebookNews();
  const withGallery = file.posts.filter((p) => p.gallery?.length);
  assert.ok(withGallery.length >= 1);
  for (const post of withGallery) {
    const ids: string[] = [];
    for (const name of post.gallery!) {
      await access(join(facebookNewsDirectory, name));
      ids.push((await coverFromFile(join(facebookNewsDirectory, name))).id);
    }
    const cover = await coverFromFile(join(facebookNewsDirectory, post.image));
    const record = newsRecord(post, file.author, cover.id, ids);
    assert.equal(record.gallery?.length, post.gallery!.length);
  }
});
