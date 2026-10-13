import { test } from "node:test";
import assert from "node:assert/strict";
import { newsLinks, parseNews, planNews } from "../lib/providers/fiba/news";
import { reviewedNewsDetails, importedNewsDetails } from "../lib/providers/fiba/news-details";
import { automaticNewsDetails } from "../lib/providers/fiba/automatic-news-details";
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
test("reviewed details require matching source facts and differ from the teaser", () => {
  const details = reviewedNewsDetails(
    "giants-win-back-to-back-south-african-titles",
    "99-57 Whitbread Mahlong",
  );
  assert.ok(details?.ar.includes("99–57"));
  assert.equal(
    reviewedNewsDetails(
      "giants-win-back-to-back-south-african-titles",
      "unrelated changed story",
    ),
    undefined,
  );
  assert.equal(
    reviewedNewsDetails("unseen-story", "99-57 Whitbread Mahlong"),
    undefined,
  );
});
test("unseen news automatically receives factual details without copying prose", () => {
  const body =
    "New Club beat Opponent 88-71 on 13 October. John Smith scored 25 points and made 4/6 attempts.";
  const details = automaticNewsDetails(body)!;
  assert.ok(details.ar.includes("88-71"));
  assert.ok(details.en.includes("John Smith: 25 points"));
  assert.ok(!details.en.includes("New Club beat Opponent"));
  const item = parseNews(
    `<script type="application/ld+json">${JSON.stringify({ "@type": "Article", about: "New official report", abstract: "Short teaser", articleBody: body, datePublished: "2026-10-13T00:00:00Z" })}</script>`,
    "https://www.fiba.basketball/en/news/new-official-report",
  );
  assert.notEqual(item.content, item.excerpt);
  assert.ok(item.content.includes("88-71"));
  assert.equal(automaticNewsDetails(undefined), undefined);
});
test("previously imported official stories display details without waiting for sync",()=>{
 const n=parseNews(html,"https://www.fiba.basketball/en/news/introducing-the-road-to-bal-2027");
 assert.notEqual(importedNewsDetails(n).content,n.excerpt);
 assert.equal(importedNewsDetails({...n,content:"Custom detailed report"}).content,"Custom detailed report");
 assert.equal(importedNewsDetails({...n,sourceUrl:undefined}).content,n.content);
});
