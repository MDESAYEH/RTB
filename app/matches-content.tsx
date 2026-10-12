"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, Search } from "lucide-react";
import type { Game, Team } from "@/lib/public-domain";
import { useLang } from "./i18n";
import { statusLabel } from "./site-shared";
import { getTeamIdentity } from "@/lib/team-identity";

export function MatchesContent({
  games,
  teams,
  count,
  seconds,
  filter,
  setFilter,
  day,
  setDay,
  dayKey,
  today,
  date,
  badge,
  liveContent,
}: {
  games: Game[];
  teams: Team[];
  count: number[];
  seconds: number;
  filter: string;
  setFilter: (value: string) => void;
  day: string;
  setDay: (value: string) => void;
  dayKey: (value: string) => string;
  today: string;
  date: (value: string) => string;
  badge: (team: Team) => ReactNode;
  liveContent: ReactNode;
}) {
  const { lang, tr } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const visible = games.filter(
    (g) =>
      (!day || dayKey(g.date) === day) &&
      (filter === "all" ||
        (filter === "today" && dayKey(g.date) === today) ||
        (filter === "live" && ["Live", "Halftime"].includes(g.status)) ||
        (filter === "finished" && g.status === "Ended") ||
        (filter === "upcoming" &&
          ["Scheduled", "Warmup"].includes(g.status))) &&
      (!query ||
        teams.some(
          (t) =>
            [g.home, g.away].includes(t.id) &&
            `${t.name} ${getTeamIdentity(t.id)?.arabicName ?? ""}`.toLowerCase().includes(query.toLowerCase()),
        )),
  );
  const pending = !games.length && filter === "all" && !day && !query;
  return (
    <div className="match-design">
      <header className="match-banner">
        <small>{copy("جدول البطولة", "Tournament schedule")}</small>
        <h1>{copy("المباريات والنتائج", "Matches & results")}</h1>
        <p>
          {copy(
            "مواعيد محلية ونتائج معتمدة وحالة كل مباراة في مكان واحد.",
            "Local times, approved results and every match status in one place.",
          )}
        </p>
      </header>
      <div className="match-body">
        {!games.length && (
          <section className="match-countdown">
            <small>{copy("نحو بداية الرحلة", "The journey begins soon")}</small>
            <h2>
              {copy(
                "خمسة أيام من المنافسة والحماس.. جدول المباريات يُعلن قريبًا!",
                "Five days of competition and excitement. The schedule is coming soon!",
              )}
            </h2>
            {seconds > 0 && (
              <div className="match-clock" dir="ltr">
                {count.map((n, i) => (
                  <div key={i}>
                    <b>{String(n).padStart(2, "0")}</b>
                    <span>
                      {
                        [
                          copy("يوم", "Days"),
                          copy("ساعة", "Hours"),
                          copy("دقيقة", "Minutes"),
                          copy("ثانية", "Seconds"),
                        ][i]
                      }
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        <div className="match-filter-row">
          <div className="match-tabs">
            {[
              ["all", "الكل"],
              ["today", "اليوم"],
              ["upcoming", "القادمة"],
              ["finished", "المنتهية"],
              ["live", "مباشر"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {tr(label)}
              </button>
            ))}
          </div>
          <label className="match-day">
            <span>{copy("حدد التاريخ", "Select date")}</span>
            <input
              type="date"
              aria-label={copy("حدد التاريخ", "Select date")}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        </div>
        <form
          className="match-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label>
            <Search size={20} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={copy("بحث عن اسم الفريق...", "Search team name...")}
              aria-label={copy("بحث عن اسم الفريق", "Search team name")}
            />
          </label>
          <button
            type="button"
            className="match-reset"
            onClick={() => {
              setSearch("");
              setQuery("");
              setDay("");
              setFilter("all");
            }}
          >
            {copy("إعادة ضبط", "Reset")} ↻
          </button>
          <button type="submit">{tr("بحث")}</button>
        </form>
        {!games.length && (
          <p className="match-notice">
            <Clock size={18} />
            {copy(
              "لم تُنشر روزنامة رسمية حتى الآن. البطاقات أدناه حالات مؤقتة وليست مواعيد مباريات.",
              "No official schedule has been published yet. The cards below are placeholders, not match appointments.",
            )}
          </p>
        )}
        {filter === "live" && liveContent}
        <div className="match-cards">
          {(pending ? [null, null, null, null] : visible).map((g, i) => {
            const home = teams.find((t) => t.id === g?.home),
              away = teams.find((t) => t.id === g?.away);
            return (
              <article className="match-card" key={g?.id ?? i}>
                <header>
                  <small>
                    {copy("المباراة", "Match")} {String(i + 1).padStart(2, "0")}
                  </small>
                  <span
                    className={
                      g && ["Live", "Halftime"].includes(g.status)
                        ? "is-live"
                        : ""
                    }
                  >
                    {g
                      ? tr(statusLabel[g.status])
                      : copy("بانتظار الاعتماد", "Pending approval")}
                  </span>
                </header>
                <div className="match-opponents">
                  {[home, away].map((t, j) => (
                    <div key={j}>
                      {t ? (
                        <Link href={`/teams/${t.id}`}>
                          {badge(t)}
                          <b>{t.name}</b>
                        </Link>
                      ) : (
                        <>
                          <span className="match-unknown">—</span>
                          <b>
                            {copy(
                              "الفريق يُعلن لاحقًا",
                              "Team to be announced",
                            )}
                          </b>
                        </>
                      )}
                    </div>
                  ))}
                  <strong className="match-score" dir="ltr">
                    {g && ["Live", "Halftime", "Ended"].includes(g.status)
                      ? `${g.homeScore} : ${g.awayScore}`
                      : "VS"}
                    <small>{g ? `GROUP ${g.group}` : "— : —"}</small>
                  </strong>
                </div>
                <footer>
                  <span>
                    <CalendarDays size={14} />
                    {g
                      ? date(g.date)
                      : copy(
                          "الموعد بانتظار الاعتماد",
                          "Date pending approval",
                        )}
                  </span>
                  {g ? (
                    <Link href={`/matches/${g.id}`}>
                      {copy("عرض التفاصيل", "View details")} ↗
                    </Link>
                  ) : (
                    <span className="match-pending-detail">
                      {copy("التفاصيل بعد الاعتماد", "Details after approval")}
                    </span>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
        {!pending && !visible.length && (
          <p className="match-empty">
            {copy(
              "لا توجد مباريات تطابق الفلاتر المحددة.",
              "No matches match the selected filters.",
            )}
          </p>
        )}
        <nav className="match-links">
          {[
            ["/teams", "تعرّف على الفرق"],
            ["/standings", "شاهد المجموعات"],
            ["/the-road", "اكتشف THE ROAD"],
          ].map(([href, label]) => (
            <Link key={href} href={href}>
              {tr(label)}
              <ArrowLeft size={17} />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
