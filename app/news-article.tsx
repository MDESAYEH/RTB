"use client";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { News } from "@/lib/public-domain";
import { useLang } from "./i18n";

export function NewsArticle({
  news,
  date,
}: {
  news: News;
  date: (value: string) => string;
}) {
  const { lang } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const title = lang === "en" && news.titleEn ? news.titleEn : news.title;
  return (
    <div className="news-design">
      <header className="match-banner">
        <small>
          {copy("أخبار · تقارير · مقابلات", "News · Reports · Interviews")}
        </small>
        <h2>{copy("الأخبار والإعلام", "News & media")}</h2>
        <p>
          {copy(
            "المصدر التحريري الرسمي لكل ما يحدث على الطريق.",
            "The official editorial source for everything on the road.",
          )}
        </p>
      </header>
      <article className="news-article-body">
        <nav
          className="news-breadcrumb"
          aria-label={copy("مسار التنقل", "Breadcrumb")}
        >
          <Link href="/">{copy("الرئيسية", "Home")}</Link>
          <ChevronLeft size={16} />
          <Link href="/news">{copy("الأخبار", "News")}</Link>
          <ChevronLeft size={16} />
          <span aria-current="page">{copy("غرفة الأخبار", "Newsroom")}</span>
        </nav>
        <header className="news-article-title">
          <span>{copy("نحو بداية الرحلة", "The journey begins")}</span>
          <h1>{title}</h1>
        </header>
        {news.cover && (
          <Image
            className="news-article-cover"
            src={news.cover}
            alt={title}
            width={1440}
            height={640}
            sizes="(max-width:700px) 100vw, 1280px"
          />
        )}
        <div className="news-article-meta">
          <time dateTime={news.publishedAt}>{date(news.publishedAt)}</time>
          {news.author && <span>{news.author}</span>}
        </div>
        <p className="news-article-excerpt">
          {lang === "en" && news.excerptEn ? news.excerptEn : news.excerpt}
        </p>
        <div className="news-article-text">
          {lang === "en" && news.contentEn ? news.contentEn : news.content}
        </div>
      </article>
    </div>
  );
}
