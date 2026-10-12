"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Globe2, Layers, Users } from "lucide-react";
import type { Game, News, Settings, Team } from "@/lib/public-domain";
import { getTeamIdentity } from "@/lib/team-identity";
import { useLang } from "./i18n";
import { EventSponsors } from "./event-sponsors";
import { TournamentLogo } from "./tournament-logo";

export function HomeTopbar() {
  const { lang, toggle } = useLang();
  return (
    <div className="topbar rd-topbar" dir="ltr">
      <span>ROAD TO BAL 2027 · TRIPOLI · 21—25 OCT 2026</span>
      <div>
        <button
          type="button"
          lang="en"
          aria-pressed={lang === "en"}
          onClick={() => {
            if (lang !== "en") toggle();
          }}
        >
          English
        </button>
        <button
          type="button"
          lang="ar"
          aria-pressed={lang === "ar"}
          onClick={() => {
            if (lang !== "ar") toggle();
          }}
        >
          العربية
        </button>
      </div>
    </div>
  );
}

export function HomeContent({
  hero,
  teams,
  games,
  news,
  settings,
  count,
  seconds,
  now,
  badge,
  gameCard,
}: {
  hero: ReactNode;
  teams: Team[];
  games: Game[];
  news: News[];
  settings: Settings;
  count: number[];
  seconds: number;
  now: number;
  badge: (team: Team) => ReactNode;
  gameCard: (game: Game) => ReactNode;
}) {
  const { lang, tr } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const ended = now > Date.parse(settings.end);
  const live = games.filter((g) => ["Live", "Halftime"].includes(g.status));
  const fixtures = live.length
    ? live
    : games
        .filter((g) =>
          ended
            ? g.status === "Ended"
            : !["Ended", "Cancelled", "Postponed"].includes(g.status),
        )
        .sort((a, b) =>
          ended ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
        );
  const articles = [...news]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
  const datePart = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-LY" : "en-GB", {
      timeZone: settings.timezone,
      ...options,
    }).format(new Date(value));
  const action = (href: string, label: string) => (
    <Link className="rd-action" href={href}>
      {label}
      <ArrowLeft size={16} aria-hidden="true" />
    </Link>
  );
  return (
    <>
      {hero}
      <div className="rd-home">
        <section
          className="rd-countdown rd-pattern"
          aria-label={copy("العد التنازلي للبطولة", "Tournament countdown")}
        >
          <h2>
            {seconds > 0
              ? tr("العد التنازلي بدأ")
              : ended
                ? tr("النتائج النهائية")
                : copy("المنافسة انطلقت", "The competition has begun")}
          </h2>
          {seconds > 0 ? (
            <div className="rd-clock" dir="ltr">
              {count.map((n, i) => (
                <div key={i}>
                  <strong suppressHydrationWarning>
                    {String(n).padStart(2, "0")}
                  </strong>
                  <span>
                    {copy(
                      ["يوم", "ساعة", "دقيقة", "ثانية"][i],
                      ["Days", "Hours", "Minutes", "Seconds"][i],
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            action("/matches", tr("تابع المباريات"))
          )}
        </section>
        <section className="rd-overview rd-container">
          <h2>{tr("الإحصائيات")}</h2>
          <div className="rd-stats">
            {[
              {
                icon: Globe2,
                value: new Set(teams.map((t) => t.country)).size,
                title: copy("عدد الدول المشاركة", "Participating nations"),
                unit: copy("دول أفريقية", "African nations"),
              },
              {
                icon: Users,
                value: teams.length,
                title: copy("عدد الفرق المشاركة", "Participating teams"),
                unit: copy("فرق مشاركة", "Teams"),
              },
              {
                icon: Layers,
                value: settings.groups.length,
                title: copy("عدد المجموعات المشاركة", "Tournament groups"),
                unit: copy("مجموعات", "Groups"),
              },
            ].map(({ icon: Icon, value, title, unit }) => (
              <div className="rd-stat rd-pattern" key={title}>
                <span>
                  <Icon size={18} aria-hidden="true" />
                  {title}
                </span>
                <strong>{value}</strong>
                <small>{unit}</small>
              </div>
            ))}
          </div>
          <div className="rd-schedule rd-pattern">
            <div className="rd-schedule-date">
              <strong dir="ltr">
                {datePart(settings.start, { day: "2-digit" })}—
                {datePart(
                  new Date(Date.parse(settings.end) - 1).toISOString(),
                  { day: "2-digit" },
                )}
              </strong>
              <span>
                {datePart(settings.start, { month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="rd-schedule-copy">
              <h3>
                {copy(
                  "جدول المباريات، خمسة أيام من الإثارة الأفريقية",
                  "Five days of African basketball",
                )}
              </h3>
              <p>
                {tr(
                  "خمسة أيام من كرة السلة الأفريقية في قلب طرابلس. تابع هنا مواعيد المباريات عند اعتمادها.",
                )}
              </p>
            </div>
            {action("/matches", tr("المباريات"))}
          </div>
        </section>
        <section className="rd-teams rd-container">
          <div className="rd-heading">
            <div>
              <h2>{tr("أفريقيا تلتقي في طرابلس")}</h2>
              <p>
                {copy(
                  "عشرة أندية أفريقية. مجموعتان. هنا تبدأ حكايات المنافسة.",
                  "Ten African clubs. Two groups. The competition starts here.",
                )}
              </p>
            </div>
            {action("/teams", tr("كل الفرق"))}
          </div>
          <div className="rd-groups">
            {settings.groups.map((group, i) => (
              <div className={`rd-group rd-group-${i % 2}`} key={group}>
                <div className="rd-group-head rd-pattern">
                  <div>
                    <h3 dir="ltr">GROUP {group}</h3>
                    <small>
                      {copy(
                        group === "A"
                          ? "المجموعة الأولى"
                          : group === "B"
                            ? "المجموعة الثانية"
                            : `المجموعة ${group}`,
                        `Group ${group}`,
                      )}{" "}
                      · {teams.filter((t) => t.group === group).length}{" "}
                      {tr("فرق")}
                    </small>
                  </div>
                  <b>{group}</b>
                </div>
                {teams
                  .filter((t) => t.group === group)
                  .map((t) => (
                    <Link
                      className="rd-team"
                      href={`/teams/${t.id}`}
                      key={t.id}
                    >
                      {badge(t)}
                      <div>
                        <strong dir="auto">{t.name}</strong>
                        <small dir="rtl">
                          {getTeamIdentity(t.id)?.arabicName || t.name}
                        </small>
                      </div>
                      <span>{tr(t.country)}</span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        </section>
        <section className="rd-fixtures rd-pattern">
          <div className="rd-container">
            <div className="rd-heading">
              <div>
                <h2>
                  {live.length
                    ? tr("مباشر الآن")
                    : ended
                      ? tr("نتائج البطولة")
                      : copy(
                          "المنافسة تبدأ من هنا",
                          "The competition starts here",
                        )}
                </h2>
                <p>
                  {copy(
                    fixtures.length
                      ? "تابع المواعيد والنتائج المعتمدة من قلب المنافسة."
                      : "ستظهر المواعيد والنتائج المعتمدة فقط. لا توجد مباريات رسمية منشورة حاليًا.",
                    "Only confirmed schedules and results are published here.",
                  )}
                </p>
              </div>
              {action("/matches", tr("كل المباريات"))}
            </div>
            <div className="rd-match-grid">
              {fixtures.length
                ? fixtures.slice(0, 2).map((g) => (
                    <div className="rd-match" key={g.id}>
                      {gameCard(g)}
                    </div>
                  ))
                : [1, 2].map((i) => (
                    <article className="rd-placeholder" key={i}>
                      <div className="rd-match-top">
                        <small>
                          {copy("المباراة", "Match")}{" "}
                          {String(i).padStart(2, "0")}
                        </small>
                        <span>
                          {copy("بانتظار اعتماد", "Awaiting confirmation")}
                        </span>
                      </div>
                      <div className="rd-match-body">
                        <div>
                          <b>—</b>
                          <small>
                            {copy(
                              "الفريق يُعلن لاحقًا",
                              "Team to be announced",
                            )}
                          </small>
                        </div>
                        <strong>
                          VS<small>— : —</small>
                        </strong>
                        <div>
                          <b>—</b>
                          <small>
                            {copy(
                              "الفريق يُعلن لاحقًا",
                              "Team to be announced",
                            )}
                          </small>
                        </div>
                      </div>
                      <div className="rd-match-bottom">
                        <span>
                          <CalendarDays size={14} />
                          {copy(
                            "الموعد بانتظار الاعتماد",
                            "Schedule awaiting confirmation",
                          )}
                        </span>
                        <Link href="/matches">
                          {copy("عرض التفاصيل", "View details")} ↖
                        </Link>
                      </div>
                    </article>
                  ))}
            </div>
          </div>
        </section>
        <section className="rd-news rd-container">
          <div className="rd-heading">
            <div>
              <span className="rd-eyebrow">
                {copy("غرفة الأخبار", "Newsroom")}
              </span>
              <h2>
                {copy("من قلب المنافسة", "From the heart of the competition")}
              </h2>
              <p>
                {copy(
                  "من استعدادات الفرق إلى صافرة النهاية، كن على اطلاع بكل ما يصنع الحدث في البطولة.",
                  "From team preparations to the final whistle, follow the stories of the tournament.",
                )}
              </p>
            </div>
            {action("/news", copy("كل الأخبار", "All news"))}
          </div>
          {articles.length ? (
            <div className="rd-news-grid">
              {articles.map((n) => (
                <Link
                  className={`rd-story${n.cover ? "" : " rd-story-no-image"}`}
                  href={`/news/${n.slug}`}
                  key={n.id}
                >
                  {n.cover && (
                    <Image
                      src={n.cover}
                      alt=""
                      fill
                      sizes="(max-width: 700px) 90vw, 48vw"
                    />
                  )}
                  <div>
                    <span>{tr("الأخبار")}</span>
                    <h3>{lang === "en" && n.titleEn ? n.titleEn : n.title}</h3>
                    <p>
                      {lang === "en" && n.excerptEn ? n.excerptEn : n.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rd-news-empty">
              <h3>{tr("أخبار البطولة، من المصدر.")}</h3>
              <p>{tr("ستُنشر التحديثات المعتمدة هنا فور توفرها.")}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function TournamentFooter() {
  const { lang, tr } = useLang();
  return (
    <footer className="rd-footer rd-pattern">
      <div className="rd-container rd-footer-grid">
        <div className="rd-footer-about">
          <Link className="rd-footer-brand" href="/">
            <TournamentLogo />
            <span>
              <strong>ROAD TO BAL</strong>
              <small>TRIPOLI · LIBYA</small>
            </span>
          </Link>
          <p>
            {lang === "ar"
              ? "طرابلس تستضيف أفريقيا. منصة لمتابعة تصفيات Road to BAL 2027، وأخبار الأندية والمباريات والنتائج المعتمدة، من صافرة البداية إلى آخر مقعد في Elite 16."
              : "Tripoli hosts Africa. Follow the Road to BAL 2027 qualifiers, club news, confirmed schedules and results, from tip-off to the final Elite 16 place."}
          </p>
        </div>
        <nav aria-label={tr("أقسام البطولة")}>
          {[
            ["/", "الرئيسية"],
            ["/matches", "المباريات"],
            ["/news", "الأخبار"],
            ["/standings", "الترتيب"],
            ["/teams", "الفرق"],
            ["/the-road", "The Road"],
            ["/stats", "الإحصائيات"],
          ].map(([href, label]) => (
            <Link href={href} key={href}>
              {tr(label)}
            </Link>
          ))}
        </nav>
        <div className="rd-footer-sponsors">
          <span>{tr("رعاة الحدث")}</span>
          <EventSponsors />
        </div>
      </div>
      <div className="rd-container rd-footer-bottom">
        <small dir="ltr">2027 TRIPOLI IS THE COURT. © ROAD TO BAL</small>
        <span className="rd-footer-legal">
          <span>{tr("سياسة الخصوصية")}</span>
          <span>{tr("الشروط والأحكام")}</span>
          <span>{tr("إمكانية الوصول")}</span>
        </span>
      </div>
    </footer>
  );
}
