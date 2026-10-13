import { load } from "cheerio";
import { newsSchema, type News } from "../../domain";
import { fetchFibaPage, FIBA_EVENT_SLUG, type FetchLike } from "./client";
import { boundedBody } from "../../request";
import type { PlanEntry } from "./plan";

export function newsLinks(html: string): string[] {
  const $ = load(html);
  const prefix = `/en/events/${FIBA_EVENT_SLUG}/news/`;
  return [
    ...new Set(
      $("a[href]")
        .map((_, e) => {
          const u = new URL($(e).attr("href")!, "https://www.fiba.basketball");
          return u.origin === "https://www.fiba.basketball" &&
            u.pathname.startsWith(prefix) &&
            /^[a-z0-9-]+$/.test(u.pathname.slice(prefix.length))
            ? u.href
            : "";
        })
        .get()
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

export function parseNews(html: string, url: string): News {
  const $ = load(html);
  let article: Record<string, unknown> | undefined;
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw: unknown = JSON.parse($(el).text());
    const candidates = Array.isArray(raw) ? raw : [raw];
    article =
      candidates.find(
        (v) => v && ["Article", "NewsArticle"].includes(v["@type"]),
      ) ?? article;
  }
  if (!article) throw Error(`FIBA article metadata missing: ${url}`);
  const slug = new URL(url).pathname.split("/").pop()!;
  const title = String(article.about || $("h1").first().text()).trim();
  const excerpt = String(
    article.abstract ||
      $('meta[property="og:description"]').attr("content") ||
      "",
  )
    .replace(/\\n/g, " ")
    .trim()
    .slice(0, 400);
  const rawCover = $('meta[property="og:image"]')
    .attr("content")
    ?.replace(/^http:/, "https:");
  return newsSchema.parse({
    id: `fiba-news-${slug}`,
    slug: `fiba-${slug}`,
    title,
    titleEn: title,
    excerpt,
    excerptEn: excerpt,
    content: excerpt,
    contentEn: excerpt,
    author: "FIBA",
    publishedAt: article.datePublished,
    status: "published",
    sourceUrl: url,
    sourceCover: rawCover?.startsWith("https://assets.fiba.basketball/")
      ? rawCover
      : undefined,
  });
}

export async function fetchNews(fetchImpl: FetchLike = fetch): Promise<News[]> {
  const { html } = await fetchFibaPage("news", fetchImpl);
  const links = newsLinks(html);
  return Promise.all(
    links.map(async (eventUrl) => {
      const url = `https://www.fiba.basketball/en/news/${new URL(eventUrl).pathname.split("/").pop()}`;
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(15000),
        headers: { accept: "text/html" },
      });
      if (
        !response.ok ||
        !(response.headers.get("content-type") || "").includes("text/html")
      )
        throw Error(`FIBA news HTTP ${response.status}`);
      if (
        response.url &&
        new URL(response.url).origin !== "https://www.fiba.basketball"
      )
        throw Error("Unexpected FIBA news redirect");
      return parseNews(
        new TextDecoder().decode(await boundedBody(response, 5 * 1024 * 1024)),
        url,
      );
    }),
  );
}

export function planNews(
  incoming: News[],
  existing: News[],
  overridden: Set<string>,
  authoritative = false,
): PlanEntry[] {
  return incoming.map((n) => {
    const old = existing.find(
      (e) => e.id === n.id || e.slug === n.slug || e.sourceUrl === n.sourceUrl,
    );
    if (!authoritative && old && overridden.has(`news:${old.id}`))
      return {
        kind: "news",
        id: old.id,
        action: "ignored",
        reason: "manual override",
      };
    const value = old ? { ...old, ...n, id: old.id } : n;
    return {
      kind: "news",
      id: value.id,
      action: !old
        ? "create"
        : JSON.stringify(old) === JSON.stringify(value)
          ? "unchanged"
          : "update",
      reason: "official FIBA news summary",
      value,
    };
  });
}
