"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Play } from "lucide-react";
import type { News } from "@/lib/public-domain";
import { directVideo, streamEmbed } from "@/lib/stream";
import { useLang } from "./i18n";
import { importedNewsDetails } from "@/lib/providers/fiba/news-details";

export function NewsArticle({
  news: record,
  date,
}: {
  news: News;
  date: (value: string) => string;
}) {
  const news = importedNewsDetails(record);
  const { lang } = useLang();
  const [playing, setPlaying] = useState(false);
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const title = lang === "en" && news.titleEn ? news.titleEn : news.title;
  const embed = streamEmbed(news.video);
  const file = directVideo(news.video);
  const excerpt = lang === "en" && news.excerptEn ? news.excerptEn : news.excerpt;
  const body = lang === "en" && news.contentEn ? news.contentEn : news.content;
  // Imported posts open with their own summary: do not print it twice, even when the text only adds a title line
  // or different punctuation in front of it.
  const plain = (s: string) => s.replace(/[sp{P}p{S}]/gu, "");
  const lead = plain(excerpt).slice(0, 36);
  const bodyRepeatsExcerpt = !lead || plain(body).includes(lead);
  // A story with several pictures shows them together, whole, under the words; a single picture stays beside them.
  const photos =
    !file && !embed && news.gallery?.length
      ? [news.cover || news.sourceCover, ...news.gallery].filter((src): src is string => !!src)
      : null;
  return (
    <div className="news-design">
      <header className="match-banner">
        <small>
          {copy("أخبار، تقارير، مقابلات", "News, Reports, Interviews")}
        </small>
        <h2>{copy("الأخبار والإعلام", "News & media")}</h2>
        <p>
          {copy(
            "المصدر التحريري الرسمي لكل ما يحدث على الطريق.",
            "The official editorial source for everything on the road.",
          )}
        </p>
      </header>
      <article className={"news-article-body" + (photos ? " news-article-body--set" : "")}>
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
        {file ? (
          <video
            className="news-article-video-file"
            src={file}
            poster={news.cover || undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={title}
          />
        ) : embed?.kind === "iframe" && embed.label === "Facebook" ? (
          // Facebook may refuse to play a video outside facebook.com, so the picture comes first with two ways in:
          // play it here (embedded) or open it on Facebook.
          <div
            className={
              "news-article-video news-video-card" +
              (embed.href.includes("/reel/") ? " news-article-video-reel" : "")
            }
          >
            {playing ? (
              <div className="stream-frame">
                <iframe
                  src={embed.src}
                  title={title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <button
                type="button"
                className="news-video-poster"
                onClick={() => setPlaying(true)}
                aria-label={copy("شغّل الفيديو هنا", "Play the video here")}
              >
                {(news.cover || news.sourceCover) && (
                  <Image
                    src={(news.cover || news.sourceCover)!}
                    alt={title}
                    fill
                    sizes="(max-width:700px) 100vw, 460px"
                  />
                )}
                <span className="news-video-play" aria-hidden="true">
                  <Play size={34} />
                </span>
                <span className="news-video-label">
                  {copy("شغّل الفيديو هنا", "Play the video here")}
                </span>
              </button>
            )}
            <a
              className="news-video-open"
              href={embed.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy("افتح الفيديو على فيسبوك", "Open the video on Facebook")}{" "}
              {lang === "ar" ? "↖" : "↗"}
            </a>
          </div>
        ) : embed?.kind === "iframe" ? (
          <div
            className={
              "stream-player news-article-video" +
              (embed.href.includes("/reel/") ? " news-article-video-reel" : "")
            }
          >
            <div className="stream-frame">
              <iframe
                src={embed.src}
                title={title}
                loading="lazy"
                scrolling="no"
                allow="encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        ) : embed?.kind === "link" ? (
          <p>
            <a
              className="stream-open"
              href={embed.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy("شاهد الفيديو على", "Watch the video on")} {embed.label} ↗
            </a>
          </p>
        ) : !photos && (news.cover || news.sourceCover) && (
          <Image
            className="news-article-cover"
            src={(news.cover || news.sourceCover)!}
            unoptimized={!!news.sourceCover && !news.cover}
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
        {!bodyRepeatsExcerpt && (
          <p className="news-article-excerpt">{excerpt}</p>
        )}
        {news.sourceUrl && news.content !== news.excerpt && (
          <h3 className="news-details-label">
            {copy(
              "تفاصيل الخبر",
              "Story details",
            )}
          </h3>
        )}
        {(news.content !== news.excerpt ||
          news.contentEn !== news.excerptEn) && (
          <div
            className="news-article-text"
            dir={lang === "en" ? "ltr" : "rtl"}
          >
            {lang === "en" && news.contentEn ? news.contentEn : news.content}
          </div>
        )}
        {!!(photos ?? news.gallery)?.length && (
          <div
            className={"news-article-gallery" + (photos ? " news-article-photoset" : "")}
            data-count={(photos ?? news.gallery)!.length}
          >
            {(photos ?? news.gallery)!.map((src, i) => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                <Image
                  src={src}
                  alt={`${title} (${i + 1})`}
                  width={1080}
                  height={1350}
                  sizes="(max-width:700px) 100vw, 560px"
                />
              </a>
            ))}
          </div>
        )}
        {news.sourceUrl && (
          <p>
            <a
              className="news-source-link"
              href={news.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy(
                "اقرأ الخبر كاملًا على FIBA",
                "Read the full article on FIBA",
              )}{" "}
              ↗
            </a>
          </p>
        )}
      </article>
    </div>
  );
}
