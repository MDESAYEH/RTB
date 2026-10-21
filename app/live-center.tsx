"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Radio, Play, CalendarDays, ArrowLeft } from "lucide-react";
import { remainingClock, type Team } from "@/lib/public-domain";
import { broadcastPlaceholder, matchStream } from "@/lib/stream";
import { useLang } from "./i18n";
import { StreamPlayer } from "./stream-player";
import { TournamentLogo } from "./tournament-logo";
import { statusLabel, type Data } from "./site-shared";

export function LiveCenter({
  data,
  now,
  connected,
  clockNow,
  badge,
}: {
  data: Data;
  now: number;
  connected: boolean;
  clockNow: number;
  badge: (team: Team) => ReactNode;
}) {
  const { lang, tr } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("events");
  const active = data.games.filter((g) =>
    ["Live", "Halftime", "Warmup"].includes(g.status),
  );
  const next = data.games
    .filter((g) => g.status === "Scheduled" && Date.parse(g.date) >= now)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
  const game = active.find((g) => g.id === selected) ?? active[0] ?? next;
  const playing = game && ["Live", "Halftime"].includes(game.status);
  // Per-match broadcast: a link entered ahead of time appears once the match is live.
  const broadcast = game ? matchStream(game, now) : { state: "not-started" as const };
  const waiting = broadcastPlaceholder(broadcast.state, lang === "ar" ? "ar" : "en");
  const team = (id?: string) => data.teams.find((t) => t.id === id);
  const events = data.events.filter((e) => e.game === game?.id);
  const stats = data.teamStats.filter((s) => s.game === game?.id);
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(game?.date ?? data.settings.start) - now) / 1000),
  );
  // Countdown clocks disappear everywhere once the first game of the tournament has started.
  const beforeStart = Date.parse(data.settings.start) > now;
  const clock = game ? remainingClock(game, clockNow) : 0;
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-LY" : "en-GB", {
      timeZone: data.settings.timezone,
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  return (
    <section className="live-center">
      <header className="live-center-heading">
        <div>
          <small>ROAD TO BAL / 2027</small>
          <h2>{copy("من قلب الملعب", "From the court")}</h2>
          <p>
            {copy(
              "شاهد اللحظة. تابع النتيجة. عِش المنافسة.",
              "Watch the moment. Follow the score. Feel the competition.",
            )}
          </p>
        </div>
        <span
          className={
            playing && connected ? "live-status on-air" : "live-status"
          }
        >
          <Radio size={17} />
          {!connected
            ? copy(
                "الاتصال منقطع، آخر بيانات مستلمة",
                "Offline, last received data",
              )
            : playing
              ? tr(statusLabel[game.status])
              : copy("بانتظار انطلاق المنافسة", "Waiting for tip-off")}
        </span>
      </header>
      {active.length > 1 && (
        <div className="live-selector">
          {active.map((g) => (
            <button
              key={g.id}
              aria-pressed={game?.id === g.id}
              onClick={() => setSelected(g.id)}
            >
              {team(g.home)?.name} × {team(g.away)?.name}
            </button>
          ))}
        </div>
      )}
      <div className="live-stage">
        <div className="live-screen">
          {broadcast.state === "show" ? (
            <>
              <div className="live-screen-label">
                <Play size={15} />
                {copy("بث البطولة", "Tournament broadcast")}
              </div>
              <StreamPlayer url={broadcast.url} />
            </>
          ) : (
            <div className="live-waiting">
              <TournamentLogo />
              <span className="live-waiting-icon">
                <Play size={28} />
              </span>
              <h3>{waiting.title}</h3>
              <p>{waiting.body}</p>
              {beforeStart && seconds > 0 && (
                <div className="live-wait-clock" dir="ltr">
                  {[
                    Math.floor(seconds / 86400),
                    Math.floor(seconds / 3600) % 24,
                    Math.floor(seconds / 60) % 60,
                  ].map((n, i) => (
                    <div key={i}>
                      <b>{String(n).padStart(2, "0")}</b>
                      <small>
                        {
                          [
                            copy("يوم", "Days"),
                            copy("ساعة", "Hours"),
                            copy("دقيقة", "Minutes"),
                          ][i]
                        }
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <aside className="live-scoreboard">
          <small>
            {game
              ? copy("مركز المباراة", "Match center")
              : copy("الرحلة إلى BAL", "The road to BAL")}
          </small>
          <h3>{game ? `GROUP ${game.group}` : "TRIPOLI 2027"}</h3>
          <div className="live-score-teams">
            {[game?.home, game?.away].map((id, i) => {
              const t = team(id);
              return (
                <div key={i}>
                  {t ? (
                    badge(t)
                  ) : (
                    <span className="live-team-placeholder">—</span>
                  )}
                  <b>
                    {t?.name ??
                      copy("الفريق يُعلن لاحقًا", "Team to be announced")}
                  </b>
                  <strong>
                    {playing || game?.status === "Ended"
                      ? i === 0
                        ? game?.homeScore
                        : game?.awayScore
                      : "—"}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="live-period">
            {playing ? (
              <>
                <span>
                  {copy("الربع", "Quarter")} {game.quarter}
                </span>
                <b dir="ltr">
                  {Math.floor(clock / 60)}:{String(clock % 60).padStart(2, "0")}
                </b>
              </>
            ) : (
              <span>
                <CalendarDays size={15} />
                {game
                  ? date(game.date)
                  : copy(
                      "الجدول بانتظار الاعتماد",
                      "Schedule pending approval",
                    )}
              </span>
            )}
          </div>
          {game && (
            <Link className="live-detail" href={`/matches/${game.id}`}>
              {copy("تفاصيل المباراة", "Match details")}
              <ArrowLeft size={16} />
            </Link>
          )}
          <p>
            {copy("التوقيت المحلي لطرابلس", "Tripoli local time")}{copy("،", ",")}{" "}
            {data.settings.timezone}
          </p>
        </aside>
      </div>
      <div className="live-data">
        <div className="live-data-tabs">
          {[
            ["events", copy("أحداث المباراة", "Match events")],
            ["stats", copy("إحصائيات الفريقين", "Team statistics")],
            ["other", copy("المباريات الأخرى", "Other matches")],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="live-data-body">
          {tab === "events" ? (
            events.length ? (
              events.map((e) => (
                <div className="live-event" key={e.id}>
                  <time dir="ltr">
                    Q{e.period} · {e.clock}
                  </time>
                  <p>{lang === "en" && e.textEn ? e.textEn : e.text}</p>
                </div>
              ))
            ) : (
              <p className="live-data-empty">
                {copy(
                  "ستظهر أحداث المباراة هنا مع أول تحديث من الملعب.",
                  "Match events will appear with the first update from the court.",
                )}
              </p>
            )
          ) : tab === "stats" ? (
            stats.length ? (
              <div className="live-stats-grid">
                {stats.map((s) => (
                  <article key={String(s.id)}>
                    <h4>{team(String(s.team))?.name}</h4>
                    {Object.entries(s)
                      .filter(([k]) => !["id", "game", "team"].includes(k))
                      .map(([k, v]) => (
                        <div key={k}>
                          <span>{tr(k)}</span>
                          <b>{v}</b>
                        </div>
                      ))}
                  </article>
                ))}
              </div>
            ) : (
              <p className="live-data-empty">
                {copy(
                  "إحصائيات الفريقين بانتظار التحديث الرسمي.",
                  "Team statistics are awaiting an official update.",
                )}
              </p>
            )
          ) : (
            <div className="live-other">
              {data.games
                .filter(
                  (g) =>
                    g.id !== game?.id &&
                    !["Cancelled", "Ended"].includes(g.status),
                )
                .slice(0, 4)
                .map((g) => (
                  <Link key={g.id} href={`/matches/${g.id}`}>
                    <span>{tr(statusLabel[g.status])}</span>
                    <b>
                      {team(g.home)?.name} × {team(g.away)?.name}
                    </b>
                    <small>{date(g.date)}</small>
                  </Link>
                ))}
              {!data.games.some(
                (g) =>
                  g.id !== game?.id &&
                  !["Cancelled", "Ended"].includes(g.status),
              ) && (
                <p className="live-data-empty">
                  {copy(
                    "ستظهر المباريات الأخرى بعد نشر جدول البطولة.",
                    "Other matches will appear once the schedule is published.",
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
