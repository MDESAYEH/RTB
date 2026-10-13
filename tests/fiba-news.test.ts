import { test } from "node:test";
import assert from "node:assert/strict";
import { newsLinks, parseNews, planNews } from "../lib/providers/fiba/news";
const url =
  "https://www.fiba.basketball/en/events/fiba-africa-champions-clubs-road-to-bal-2027/news/official-story";
const html = `<h1>Official story</h1><meta property="og:image" content="http://assets.fiba.basketball/story.jpg"><script type="application/ld+json">${JSON.stringify({ "@type": "Article", about: "Official story", abstract: "Official summary", datePublished: "2026-10-01T10:00:00Z" })}</script>`;
test("news discovery stays within the tournament and deduplicates links", () => {
  assert.deepEqual(
    newsLinks(
      `<a href="${url}">a</a><a href="${url}">b</a><a href="https://evil.test/news/a">bad</a><a href="/en/news/other">other</a>`,
    ),
    [url],
  );
});
test("news metadata produces a validated summary and secure source image", () => {
  const news = parseNews(html, url);
  assert.equal(news.sourceCover, "https://assets.fiba.basketball/story.jpg");
  assert.equal(news.content, "Official summary");
  assert.equal(news.sourceUrl, url);
  assert.throws(() => parseNews("<h1>Broken</h1>", url));
});
test("news sync is idempotent and preserves manual changes", () => {
  const n = parseNews(html, url);
  assert.equal(planNews([n], [], new Set())[0].action, "create");
  assert.equal(planNews([n], [n], new Set())[0].action, "unchanged");
  assert.equal(
    planNews([n], [{ ...n, title: "Edited" }], new Set([`news:${n.id}`]))[0]
      .action,
    "ignored",
  );
});
