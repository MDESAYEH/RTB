"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Newspaper, Search, ArrowLeft } from "lucide-react";
import type { News } from "@/lib/public-domain";
import { useLang } from "./i18n";

export function NewsContent({
  news,
  date,
}: {
  news: News[];
  date: (value: string) => string;
}) {
  const { lang } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const published = news
    .filter((n) => n.status === "published")
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const visible = published.filter((n) =>
    [n.title, n.titleEn, n.excerpt, n.excerptEn].some((v) =>
      v?.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ),
  );
  return (
    <div className="news-design">
      <header className="match-banner">
        <small>
          {copy("أخبار · تقارير · مقابلات", "News · Reports · Interviews")}
        </small>
        <h1>{copy("الأخبار والإعلام", "News & media")}</h1>
        <p>
          {copy(
            "المصدر التحريري الرسمي لكل ما يحدث على الطريق.",
            "The official editorial source for everything on the road.",
          )}
        </p>
      </header>
      <div className="news-body">
        <section className="news-intro">
          <small>{copy("نحو بداية الرحلة", "The journey begins")}</small>
          <h2>
            {copy(
              "خمسة أيام من المنافسة والحماس.. جدول المباريات يُعلن قريبًا!",
              "Five days of competition and excitement. The schedule is coming soon!",
            )}
          </h2>
        </section>
        <form
          id="news-search"
          className="match-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label>
            <Search size={19} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={copy("ابحث في الأخبار...", "Search news...")}
              aria-label={copy("ابحث في الأخبار", "Search news")}
            />
          </label>
          <button
            className="match-reset"
            type="button"
            onClick={() => {
              setSearch("");
              setQuery("");
            }}
          >
            {copy("إعادة ضبط", "Reset")} ↻
          </button>
          <button type="submit">{copy("بحث", "Search")}</button>
        </form>
        {visible.length ? (
          <div className="news-card-grid">
            {visible.map((n) => (
              <Link
                key={n.id}
                href={`/news/${n.slug}`}
                className="news-editorial-card"
              >
                {n.cover ? (
                  <Image
                    src={n.cover}
                    alt=""
                    width={1200}
                    height={640}
                    sizes="(max-width:700px) 100vw, 50vw"
                  />
                ) : (
                  <div className="news-cover-placeholder">
                    <Newspaper size={42} />
                  </div>
                )}
                <div>
                  <time>{date(n.publishedAt)}</time>
                  <h3>{lang === "en" && n.titleEn ? n.titleEn : n.title}</h3>
                  <p>
                    {lang === "en" && n.excerptEn ? n.excerptEn : n.excerpt}
                  </p>
                  <span>
                    {copy("اقرأ الخبر", "Read article")}
                    <ArrowLeft size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <section className="news-empty">
            <span>
              <Newspaper size={43} />
            </span>
            <h2>
              {published.length
                ? copy(
                    "لا توجد أخبار تطابق بحثك",
                    "No news matches your search",
                  )
                : copy("لا توجد أخبار منشورة", "No published news")}
            </h2>
            <p>
              {published.length
                ? copy(
                    "جرّب كلمات أخرى أو أعد ضبط البحث.",
                    "Try other keywords or reset your search.",
                  )
                : copy(
                    "تُنشر المعلومات الرسمية هنا فور اعتمادها.",
                    "Official updates will appear here once approved.",
                  )}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
