"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClubProfile } from "@/lib/club-profile";

import { EditorialClubProfile } from "./editorial-club-profile";
import { StadeTournamentHub } from "./stade-tournament-hub";
import { ClubRoadLine } from "./club-road-primitives";
import { TournamentHeader, CampaignHero } from "./tournament-campaign";
import Image from "next/image";
import dynamic from "next/dynamic";
import { CourtArc } from "./brand-primitives";
import { EventSponsors } from "./event-sponsors";
import { HomeContent, HomeFooter, HomeTopbar } from "./home-content";
import { useLang } from "./i18n";
import { Empty, statusLabel, type Data } from "./site-shared";
import { StreamPlayer } from "./stream-player";
import { TournamentLogo } from "./tournament-logo";
import { DEFAULT_STREAM_URL, streamEmbed } from "@/lib/stream";
import { getTeamIdentity } from "@/lib/team-identity";
import { Trophy, ChevronLeft } from "lucide-react";
import {
  standings,
  qualification,
  remainingClock,
  stale,
  type Team,
  type Game,
} from "@/lib/public-domain";
type Player = {
  id: string;
  name: string;
  team: string;
  number: number;
  position: string;
  photo?: string;
};
type Stat = {
  id: string;
  game: string;
  player: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  efficiency: number;
};
function Badge({ team }: { team: Team }) {
  const { tr } = useLang();
  const logo = team.logo || getTeamIdentity(team.id)?.logoAsset;
  if (logo)
    return (
      <Image
        className="team-logo"
        src={logo}
        alt={team.name}
        width={42}
        height={42}
        sizes="42px"
      />
    );
  return (
    <span
      className={"team-badge " + (team.id === "al-ittihad" ? "host" : "")}
      aria-label={tr("رمز نصي · ") + team.name}
    >
      {team.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 3)}
    </span>
  );
}
// Admin UI (editors, audit log, uploads) loads only on /admin.
const Admin = dynamic(() => import("./admin-panel").then((m) => m.Admin));
export default function Site({
  path,
  initial,
  historicalProfile,
  serverNow,
}: {
  path: string[];
  initial: Data;
  historicalProfile?: ClubProfile;
  /** Server render time: the first client render must match the server HTML. */
  serverNow: number;
}) {
  const { lang, dir, tr } = useLang();
  const [data, setData] = useState(initial),
    [now, setNow] = useState(serverNow),
    [connected, setConnected] = useState(true),
    [filter, setFilter] = useState("all"),
    [day, setDay] = useState(""),
    [group, setGroup] = useState("A"),
    [previewStream, setPreviewStream] = useState("");
  const route = path[0] === "the-road" ? "road" : path[0] || "home";
  const [lastReceived, setLastReceived] = useState<number | null>(null);
  const [newsSearch, setNewsSearch] = useState("");
  const acceptData = (next: Data) =>
    setData((previous) =>
      next.revision >= previous.revision ? next : previous,
    );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const day = params.get("day"),
      filter = params.get("filter"),
      link = params.get("stream");
    if (day) setDay(day);
    if (link) setPreviewStream(link);
    if (
      filter &&
      ["all", "today", "upcoming", "finished", "live"].includes(filter)
    )
      setFilter(filter);
  }, []);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const stream = new EventSource("/api/live");
    let active = true,
      fetching = false,
      pending = false,
      heartbeat = Date.now();
    const abort = new AbortController();
    const touch = () => {
      heartbeat = Date.now();
      setConnected(navigator.onLine);
    };
    const refresh = async () => {
      pending = true;
      if (fetching) return;
      fetching = true;
      try {
        while (pending && active) {
          pending = false;
          const response = await fetch("/api/data", {
            cache: "no-store",
            signal: abort.signal,
          });
          if (!response.ok) throw Error("Data unavailable");
          const snapshot = await response.json();
          if (active) {
            setData((previous) =>
              snapshot.revision >= previous.revision ? snapshot : previous,
            );
            setLastReceived(Date.now());
            touch();
          }
        }
      } catch {
        if (active) setConnected(false);
      } finally {
        fetching = false;
      }
    };
    stream.onopen = touch;
    stream.addEventListener("heartbeat", touch);
    stream.onmessage = () => {
      touch();
      void refresh();
    };
    stream.onerror = () => setConnected(false);
    const offline = () => setConnected(false);
    const online = () => {
      void refresh();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    const watchdog = setInterval(() => {
      if (Date.now() - heartbeat > 10000 || !navigator.onLine)
        setConnected(false);
    }, 2000);
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    return () => {
      active = false;
      abort.abort();
      clearInterval(watchdog);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      clearInterval(timer);
      stream.close();
    };
  }, []);
  const s = data.settings,
    streamUrl = previewStream || s.streamUrl || DEFAULT_STREAM_URL,
    teams = data.teams,
    games = data.games;
  const team = (id: string) => teams.find((t) => t.id === id);
  const live = games.filter(
    (g) => g.status === "Live" || g.status === "Halftime",
  );
  const date = (v: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-LY" : "en-GB", {
      timeZone: s.timezone,
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(v));
  const dayKey = (v: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: s.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(v));
  const today = dayKey(new Date(now).toISOString());
  const days = Array.from(
    {
      length: Math.max(
        1,
        Math.min(
          14,
          Math.ceil((Date.parse(s.end) - Date.parse(s.start)) / 86400000),
        ),
      ),
    },
    (_, i) => new Date(Date.parse(s.start) + i * 86400000).toISOString(),
  );
  const seconds = Math.max(0, Math.floor((Date.parse(s.start) - now) / 1000));
  const count = [
    Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
  // Render helpers, not components: a component declared inside Site would get a
  // new identity on every render, and Site re-renders every second for the clock,
  // remounting every card and table.
  function gameCard(g: Game) {
    const h = team(g.home),
      a = team(g.away);
    return (
      <article
        key={g.id}
        className={"game-row state-" + g.status.toLowerCase()}
      >
        <span
          className={"tag " + (g.status === "Live" && connected ? "live" : "")}
        >
          {!connected && ["Live", "Halftime"].includes(g.status)
            ? tr("آخر نتيجة")
            : tr(statusLabel[g.status])}
        </span>
        <Link href={"/teams/" + g.home} className="game-team">
          {h && <Badge team={h} />}
          <b dir="auto">{h?.name}</b>
        </Link>
        <Link
          href={"/matches/" + g.id}
          className="fixture-center"
          aria-label={`${h?.name} ${tr("ضد")} ${a?.name} — ${tr("مركز المباراة")}`}
        >
          <strong
            className="score"
            dir="ltr"
            key={`${g.homeScore}:${g.awayScore}`}
          >
            {["Live", "Halftime", "Ended"].includes(g.status)
              ? `${g.homeScore} : ${g.awayScore}`
              : new Intl.DateTimeFormat("en-GB", {
                  timeZone: s.timezone,
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(g.date))}
          </strong>
        </Link>
        <Link href={"/teams/" + g.away} className="game-team">
          {a && <Badge team={a} />}
          <b dir="auto">{a?.name}</b>
        </Link>
        <Link href={"/matches/" + g.id} className="game-date">
          <b>GROUP {g.group}</b>
          <span>{date(g.date)}</span>
          {["Live", "Halftime"].includes(g.status) && (
            <span dir="ltr">
              Q{g.quarter} ·{" "}
              {Math.floor(
                remainingClock(g, connected ? now : (lastReceived ?? now)) / 60,
              )}
              :
              {String(
                remainingClock(g, connected ? now : (lastReceived ?? now)) % 60,
              ).padStart(2, "0")}
            </span>
          )}
        </Link>
        {stale(g, now) && <small>{tr("التحديث متأخر")}</small>}
      </article>
    );
  }
  function groupTable(g: string) {
    const rows = standings(
        teams.filter((t) => t.group === g),
        games,
        s,
      ),
      played = rows.some((r) => r.p);
    return (
      <div className="standings-wrap">
        <div className="group-heading">
          <span>GROUP {g}</span>
          <span className="muted">
            {lang === "ar"
              ? `أول ${s.qualificationSlots} إلى Elite 16`
              : `Top ${s.qualificationSlots} advance to Elite 16`}
          </span>
        </div>
        {!played && (
          <p className="muted">
            {tr(
              "لم تبدأ مباريات المجموعة. ترتيب الأسماء لا يمثل ترتيبًا تنافسيًا.",
            )}
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{tr("الفريق")}</th>
              <th className="wide">P</th>
              <th>W</th>
              <th>L</th>
              <th className="wide">PF</th>
              <th className="wide">PA</th>
              <th>+/-</th>
              <th>PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.team.id}
                className={
                  played &&
                  s.rulesConfirmed &&
                  !r.tied &&
                  i < s.qualificationSlots
                    ? "zone"
                    : ""
                }
              >
                <td>{played ? (r.tied ? "=" : i + 1) : "—"}</td>
                <td>
                  <Link href={"/teams/" + r.team.id}>
                    <Badge team={r.team} />
                    <span dir="auto">
                      {r.team.name}
                      <small className="mobile-aux">
                        {played
                          ? `P ${r.p} · PF ${r.pf} · PA ${r.pa}`
                          : tr("لم يلعب بعد")}
                      </small>
                    </span>
                  </Link>
                </td>
                {["p", "w", "l", "pf", "pa", "diff", "pts"].map((k) => (
                  <td
                    key={k}
                    className={["p", "pf", "pa"].includes(k) ? "wide" : ""}
                  >
                    {played ? String(r[k as keyof typeof r]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {played && !s.rulesConfirmed && (
          <p className="notice">
            {tr("نقاط الترتيب مؤقتة إلى حين اعتماد قواعد المسابقة.")}
          </p>
        )}
        {played && (
          <p className="muted">
            {tr("المتعادلون بالنقاط ينتظرون اعتماد قواعد كسر التعادل.")}
          </p>
        )}
      </div>
    );
  }
  function Road({ preview = false }: { preview?: boolean }) {
    const started = games.some((g) =>
      ["Live", "Halftime", "Ended"].includes(g.status),
    );
    const complete =
      s.rulesConfirmed &&
      s.groups.every((group) => {
        const count = teams.filter((t) => t.group === group).length;
        const gs = games.filter((g) => g.group === group);
        return (
          gs.length === (count * (count - 1)) / 2 &&
          gs.every((g) => g.status === "Ended")
        );
      });
    const qualifiers = teams.filter(
      (t) => qualification(t, teams, games, s) === "QUALIFIED",
    );
    const states = [
      started ? "COMPLETED" : "CURRENT",
      complete ? "COMPLETED" : started ? "CURRENT" : "LOCKED",
      qualifiers.length ? "QUALIFIED" : "LOCKED",
      "LOCKED",
      "LOCKED",
    ];
    return (
      <section className="road-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">EVERY GAME. ONE DESTINATION.</span>
            <h2>
              {tr("الطريق يبدأ من هنا")}
              <span className="orange">.</span>
            </h2>
          </div>
          <Trophy className="gold" size={36} />
        </div>
        <div className="road-qualification-scene" dir="ltr">
          <CourtArc />
          <div>
            <span>THE NEXT CHAPTER</span>
            <strong>
              {s.qualificationSlots}
              <i>↗</i>
            </strong>
          </div>
          <p dir={dir}>
            {tr("من كل مجموعة")}
            <br />
            <b>{tr("إلى Elite 16.")}</b>
            <small>
              {tr("كل مباراة خطوة. الوصول إلى BAL يُحسم في المرحلة التالية.")}
            </small>
          </p>
        </div>
        {preview ? (
          <Link className="road-preview-link" href="/the-road">
            {tr("اكتشف THE ROAD")} <span aria-hidden="true">↗</span>
          </Link>
        ) : (
          <div className="road" dir="ltr">
            {[
              ["01", "TRIPOLI", "21–25 OCT 2026"],
              ["02", "GROUP STAGE", tr("مجموعتان · عشرة فرق")],
              ["03", "TOP " + s.qualificationSlots, tr("من كل مجموعة")],
              ["04", "ELITE 16", tr("المرحلة التالية")],
              ["05", "BAL 2027", tr("الوجهة")],
            ].map(([n, title, sub], i) => (
              <Link
                href={i === 0 ? "/matches" : "/standings"}
                className={"road-step " + states[i].toLowerCase()}
                key={n}
              >
                <span>{n}</span>
                <small className="road-status">{states[i]}</small>
                <h3>{title}</h3>
                <p dir="auto">{sub}</p>
                <div className="road-dot" />
              </Link>
            ))}
          </div>
        )}
        <div className="qualified">
          {teams
            .filter((t) => qualification(t, teams, games, s) === "QUALIFIED")
            .map((t) => (
              <span key={t.id}>{t.name} ✓</span>
            ))}
        </div>
        <p className="muted">
          {tr(
            "أول فريقين من كل مجموعة في طرابلس يتأهلان إلى Elite 16. التأهل إلى BAL يُحسم في المرحلة التالية.",
          )}
        </p>
      </section>
    );
  }
  function ScheduleSoon() {
    return (
      <section className="schedule-soon">
        <span className="eyebrow">{tr("الجدول قيد الاعتماد")}</span>
        <h2>{tr("خمسة أيام. مواعيد المباريات قريبًا.")}</h2>
        {seconds > 0 && (
          <div
            className="soon-count"
            dir="ltr"
            aria-label={tr("العد التنازلي لبدء البطولة")}
          >
            {count.map((n, i) => (
              <div key={i}>
                <strong suppressHydrationWarning>
                  {String(n).padStart(2, "0")}
                </strong>
                <span>{["DAYS", "HOURS", "MINUTES", "SECONDS"][i]}</span>
              </div>
            ))}
          </div>
        )}
        <div className="soon-days" dir="ltr">
          {days.map((d, i) => (
            <div key={d}>
              <small>DAY {i + 1}</small>
              <strong>
                {new Intl.DateTimeFormat("en", {
                  timeZone: s.timezone,
                  day: "numeric",
                }).format(new Date(d))}
              </strong>
              <span>OCT</span>
              <em>{tr("سيُعلن الموعد")}</em>
            </div>
          ))}
        </div>
        <div className="empty-actions">
          <Link href="/teams">{tr("تعرّف على الفرق")}</Link>
          <Link href="/standings">{tr("شاهد المجموعات")}</Link>
          <Link href="/the-road">{tr("اكتشف THE ROAD")}</Link>
        </div>
      </section>
    );
  }
  function Matches() {
    const visible = games.filter(
      (g) =>
        (!day || dayKey(g.date) === day) &&
        (filter === "all" ||
          (filter === "today" && dayKey(g.date) === today) ||
          (filter === "live" && ["Live", "Halftime"].includes(g.status)) ||
          (filter === "finished" && g.status === "Ended") ||
          (filter === "upcoming" &&
            ["Scheduled", "Warmup"].includes(g.status))),
    );
    const liveTab = filter === "live";
    const broadcasts = [
      ...(streamEmbed(streamUrl)
        ? [{ key: "site", url: streamUrl, title: tr("البث المباشر") }]
        : []),
      ...games
        .filter(
          (g) =>
            g.streamUrl &&
            g.streamUrl !== streamUrl &&
            streamEmbed(g.streamUrl) &&
            ["Warmup", "Live", "Halftime"].includes(g.status),
        )
        .map((g) => ({
          key: g.id,
          url: g.streamUrl as string,
          title: `${team(g.home)?.name ?? ""} × ${team(g.away)?.name ?? ""}`,
        })),
    ];
    return (
      <>
        <div className="tabs">
          {[
            ["all", "الكل"],
            ["today", "اليوم"],
            ["upcoming", "القادمة"],
            ["finished", "المنتهية"],
            ["live", "مباشر"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {tr(label)}
            </button>
          ))}
        </div>
        {liveTab ? (
          <section className="live-broadcasts">
            {broadcasts.length ? (
              broadcasts.map((b) => (
                <article key={b.key} className="live-broadcast-item">
                  <h2 dir="auto">{b.title}</h2>
                  <StreamPlayer url={b.url} />
                </article>
              ))
            ) : (
              <Empty
                title={tr("لا يوجد بث مباشر الآن.")}
                detail={tr("ستظهر البثوث المباشرة هنا فور بدئها.")}
              />
            )}
          </section>
        ) : (
          <>
            <div className="days" dir="ltr">
              <button
                onClick={() => setDay("")}
                className={!day ? "active" : ""}
              >
                ALL
              </button>
              {days.map((d, i) => (
                <button
                  key={d}
                  className={day === dayKey(d) ? "active" : ""}
                  onClick={() => setDay(dayKey(d))}
                >
                  <small>DAY {i + 1}</small>
                  {new Intl.DateTimeFormat("en", {
                    timeZone: s.timezone,
                    day: "numeric",
                  }).format(new Date(d))}{" "}
                  OCT
                </button>
              ))}
            </div>
            {!games.length ? (
              ScheduleSoon()
            ) : visible.length ? (
              visible.map((g) => gameCard(g))
            ) : (
              <Empty
                title={tr("لم تُنشر مباريات هذا اليوم بعد.")}
                detail={tr("ستظهر المواعيد هنا بعد اعتماد جدول المباريات.")}
              />
            )}
            {!visible.length && (
              <div className="empty-actions">
                <Link href="/teams">{tr("تعرّف على الفرق")}</Link>
                <Link href="/standings">{tr("شاهد المجموعات")}</Link>
                <Link href="/the-road">{tr("اكتشف THE ROAD")}</Link>
              </div>
            )}
          </>
        )}
      </>
    );
  }
  function TeamGrid() {
    return (
      <div className="teams-field">
        {s.groups.map((group) => (
          <section
            className="team-group"
            key={group}
            aria-label={"GROUP " + group}
          >
            <span className="team-group-letter" aria-hidden="true">
              {group}
            </span>
            <h2 className="team-group-title">GROUP {group} / TRIPOLI 2027</h2>
            {teams
              .filter((t) => t.group === group)
              .map((t, i) => (
                <Link className="team-line" key={t.id} href={"/teams/" + t.id}>
                  <span className="team-position">0{i + 1}</span>
                  <Badge team={t} />
                  <div>
                    <h3 dir="auto">{t.name}</h3>
                    <p>
                      {lang === "ar"
                        ? `${getTeamIdentity(t.id)?.arabicName} / `
                        : ""}
                      {tr(t.country)}
                    </p>
                  </div>
                  <span className="team-status">
                    {tr(
                      {
                        QUALIFIED: "تأهل ✓",
                        ELIMINATED: "خرج من سباق التأهل",
                        IN_CONTENTION: "في سباق التأهل",
                      }[qualification(t, teams, games, s)],
                    )}
                  </span>
                  <span className="team-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
          </section>
        ))}
      </div>
    );
  }
  function NewsList() {
    return data.news.length ? (
      <div className="news-list">
        {data.news
          .filter((n) =>
            [n.title, n.titleEn, n.excerpt, n.excerptEn].some((value) =>
              value
                ?.toLocaleLowerCase()
                .includes(newsSearch.trim().toLocaleLowerCase()),
            ),
          )
          .map((n) => (
            <Link href={"/news/" + n.slug} key={n.id}>
              <span className="eyebrow">{date(n.publishedAt)}</span>
              {n.cover && (
                <Image
                  className="news-cover"
                  src={n.cover}
                  alt=""
                  width={1200}
                  height={640}
                  sizes="(max-width:600px) 90vw, 50vw"
                />
              )}
              <h3>{lang === "en" && n.titleEn ? n.titleEn : n.title}</h3>
              <p>{lang === "en" && n.excerptEn ? n.excerptEn : n.excerpt}</p>
            </Link>
          ))}
      </div>
    ) : (
      <Empty
        title={tr("أخبار البطولة، من المصدر.")}
        detail={tr("ستُنشر التحديثات المعتمدة هنا فور توفرها.")}
      />
    );
  }
  function Statistics() {
    const stats = data.stats as Stat[],
      players = data.players as Player[];
    return stats.length ? (
      <div className="leaderboards">
        {(
          [
            "points",
            "rebounds",
            "assists",
            "steals",
            "blocks",
            "efficiency",
          ] as const
        ).map((key, i) => (
          <section key={key}>
            <h3>
              {tr(
                [
                  "النقاط",
                  "المتابعات",
                  "التمريرات",
                  "السرقات",
                  "الصدات",
                  "الكفاءة",
                ][i],
              )}
            </h3>
            {players
              .map((p) => ({ p, rows: stats.filter((s) => s.player === p.id) }))
              .filter((v) => v.rows.length)
              .map((v) => ({
                ...v,
                average: v.rows.reduce((n, r) => n + r[key], 0) / v.rows.length,
              }))
              .sort((a, b) => b.average - a.average)
              .slice(0, 5)
              .map((v) => (
                <Link
                  className="stat-row"
                  href={"/players/" + v.p.id}
                  key={v.p.id}
                >
                  <span>{v.p.name}</span>
                  <b>{v.average.toFixed(1)}</b>
                </Link>
              ))}
          </section>
        ))}
      </div>
    ) : (
      <section className="stats-preview">
        <span className="eyebrow">THE NUMBERS WILL TELL THE STORY</span>
        <h2>{tr("كل نقطة. كل متابعة. كل خطوة.")}</h2>
        <Empty
          title={tr("ستظهر إحصائيات اللاعبين بعد انطلاق البطولة.")}
          detail={tr(
            "تبدأ المنافسة في الملعب؛ ثم نقرأ قصتها بالأرقام المعتمدة.",
          )}
        />
        <div className="stat-categories" dir="ltr">
          PTS <span>REB</span> AST <span>STL</span> BLK
        </div>
        <Link className="text-link" href="/matches">
          {tr("تابع بداية المنافسة")} <ChevronLeft size={18} />
        </Link>
      </section>
    );
  }
  let content: React.ReactNode;
  if (route === "home")
    content = (
      <HomeContent
        hero={<CampaignHero />}
        teams={teams}
        games={games}
        news={data.news}
        settings={s}
        count={count}
        seconds={seconds}
        now={now}
        badge={(t) => <Badge team={t} />}
        gameCard={gameCard}
      />
    );
  else if (route === "matches" && path[1]) {
    const g = games.find((g) => g.id === path[1])!;
    const clock = remainingClock(g, connected ? now : (lastReceived ?? now));
    content = (
      <>
        <section className={"match-scoreboard state-" + g.status.toLowerCase()}>
          <span
            className={
              "tag " + (g.status === "Live" && connected ? "live" : "")
            }
          >
            {!connected && ["Live", "Halftime"].includes(g.status)
              ? tr("آخر نتيجة")
              : tr(statusLabel[g.status])}
          </span>
          <div className="scoreboard-teams" dir="ltr">
            <Link
              href={"/teams/" + g.home}
              className={
                g.homeScore > g.awayScore &&
                ["Live", "Halftime", "Ended"].includes(g.status)
                  ? "scoreboard-winner"
                  : undefined
              }
            >
              {team(g.home) && <Badge team={team(g.home)!} />}
              <h2 dir="auto">{team(g.home)?.name}</h2>
              <small className="scoreboard-country">
                {tr(team(g.home)?.country ?? "")}
              </small>
            </Link>
            <strong
              className="score"
              aria-label={tr("النتيجة")}
              dir="ltr"
              key={`${g.homeScore}:${g.awayScore}`}
            >
              {["Live", "Halftime", "Ended"].includes(g.status)
                ? g.homeScore + " : " + g.awayScore
                : new Intl.DateTimeFormat("en-GB", {
                    timeZone: s.timezone,
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(g.date))}
            </strong>
            <Link
              href={"/teams/" + g.away}
              className={
                g.awayScore > g.homeScore &&
                ["Live", "Halftime", "Ended"].includes(g.status)
                  ? "scoreboard-winner"
                  : undefined
              }
            >
              {team(g.away) && <Badge team={team(g.away)!} />}
              <h2 dir="auto">{team(g.away)?.name}</h2>
              <small className="scoreboard-country">
                {tr(team(g.away)?.country ?? "")}
              </small>
            </Link>
          </div>
          <p>
            {date(g.date)} · GROUP {g.group}
          </p>
        </section>
        {["Live", "Halftime"].includes(g.status) && (
          <div className="match-clock" dir="ltr">
            Q{g.quarter} · {String(Math.floor(clock / 60)).padStart(2, "0")}:
            {String(clock % 60).padStart(2, "0")}
          </div>
        )}
        {stale(g, now) && (
          <p className="notice">
            {tr("البيانات المباشرة متأخرة؛ نعرض آخر نتيجة مؤكدة.")}
          </p>
        )}
        <p>
          {g.venue || tr("سيُعلن مكان المباراة لاحقًا")} · GROUP {g.group}
        </p>
        {streamEmbed(previewStream || g.streamUrl || streamUrl) ? (
          <StreamPlayer url={previewStream || g.streamUrl || streamUrl} />
        ) : (
          <section className="broadcast-stage" aria-label={tr("البث المباشر")}>
            <CourtArc />
            <span className="broadcast-play" aria-hidden="true">
              ▷
            </span>
            <span className="broadcast-label" dir="ltr">
              LIVE BROADCAST
            </span>
            <h2>{tr("سيتم عرض البث المباشر للمباراة هنا")}</h2>
            <p>{tr("البث الرسمي سيكون متاحًا عند بدء المباراة.")}</p>
            <span className="broadcast-opponents" dir="ltr">
              {team(g.home)?.name} × {team(g.away)?.name}
            </span>
          </section>
        )}
        {g.periods.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{tr("الفترة")}</th>
                {g.periods.map((_, i) => (
                  <th key={i}>Q{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["home", "away"].map((side) => (
                <tr key={side}>
                  <th>{team(g[side as "home" | "away"])?.name}</th>
                  {g.periods.map((p, i) => (
                    <td key={i}>{p[side as "home" | "away"]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.events.some((e) => e.game === g.id) && (
          <section>
            <h2>{tr("تسلسل أحداث المباراة")}</h2>
            {data.events
              .filter((e) => e.game === g.id)
              .map((e) => (
                <div className="stat-row" key={e.id}>
                  <time dir="ltr">
                    Q{e.period} · {e.clock}
                  </time>
                  <span>{lang === "en" && e.textEn ? e.textEn : e.text}</span>
                </div>
              ))}
          </section>
        )}
        {data.teamStats.some((t) => t.game === g.id) && (
          <section>
            <h2>{tr("إحصائيات الفريقين")}</h2>
            {data.teamStats
              .filter((t) => t.game === g.id)
              .map((t) => (
                <div key={t.id} className="team-stats">
                  <h3>{team(String(t.team))?.name}</h3>
                  {Object.entries(t)
                    .filter(([k]) => !["id", "game", "team"].includes(k))
                    .map(([k, v]) => (
                      <div className="stat-row" key={k}>
                        <span>{k}</span>
                        <b>{v}</b>
                      </div>
                    ))}
                </div>
              ))}
          </section>
        )}
        <h2>{tr("سياق المجموعة")}</h2>
        {groupTable(g.group)}
        {(data.stats as Stat[]).some((st) => st.game === g.id) && (
          <>
            <h2>Box Score</h2>
            {(data.stats as Stat[])
              .filter((st) => st.game === g.id)
              .map((st) => (
                <div className="stat-row" key={st.id}>
                  {
                    (data.players as Player[]).find((p) => p.id === st.player)
                      ?.name
                  }
                  <span>
                    {st.points} PTS · {st.rebounds} REB · {st.assists} AST
                  </span>
                </div>
              ))}
          </>
        )}
      </>
    );
  } else if (route === "matches") content = Matches();
  else if (route === "standings")
    content = (
      <>
        <div className="tabs group-switch">
          {s.groups.map((g) => (
            <button
              key={g}
              className={group === g ? "active" : ""}
              onClick={() => setGroup(g)}
            >
              GROUP {g}
            </button>
          ))}
        </div>
        <div className="standings-grid">
          {s.groups.map((g) => (
            <div
              key={g}
              className={"group-panel" + (group === g ? " active" : "")}
            >
              {groupTable(g)}
            </div>
          ))}
        </div>
      </>
    );
  else if (route === "teams")
    content = (
      <>
        <div className="team-field-intro">
          <strong dir="ltr">
            10 CLUBS. 10 NATIONS.
            <br />
            ONE ROAD.
          </strong>
          <p>
            {tr("عشرة أندية أفريقية.")}
            <br />
            {tr("هنا تبدأ حكايات المنافسة.")}
          </p>
        </div>
        {TeamGrid()}
      </>
    );
  else if (route === "road")
    content = (
      <>
        {Road({})}
        {TeamGrid()}
      </>
    );
  else if (route === "stats") content = Statistics();
  else if (route === "team") {
    const t = team(path[1]);
    // A club profile can exist before its team is in the live data.
    if (!t)
      content = historicalProfile ? (
        <div className="team-editorial-prototype">
          <ClubRoadLine />
          <EditorialClubProfile profile={historicalProfile} />
        </div>
      ) : (
        <Empty title={tr("لم يُنشر هذا الفريق بعد.")} />
      );
    else {
      const roster = (data.players as Player[]).filter((p) => p.team === t.id);
      content = (
        <div className="team-editorial-prototype">
          <ClubRoadLine />
          {historicalProfile && (
            <EditorialClubProfile profile={historicalProfile} />
          )}
          <StadeTournamentHub
            team={t}
            opponents={teams.filter(
              (other) => other.group === t.group && other.id !== t.id,
            )}
            matches={games.filter((g) => g.home === t.id || g.away === t.id)}
            roster={roster}
            record={standings(teams, games, s).find((r) => r.team.id === t.id)!}
            status={qualification(t, teams, games, s)}
            now={connected ? now : (lastReceived ?? now)}
          />
        </div>
      );
    }
  } else if (route === "players") {
    const p = (data.players as Player[]).find((p) => p.id === path[1]);
    content = p ? (
      <>
        {p.photo ? (
          <Image
            src={p.photo}
            className="player-photo"
            alt={p.name}
            width={220}
            height={220}
            sizes="220px"
          />
        ) : (
          <div className="player-avatar">{p.name[0]}</div>
        )}
        <h1>{p.name}</h1>
        <p>
          #{p.number} · {p.position} · {team(p.team)?.name}
        </p>
        <h2>{tr("سجل المباريات")}</h2>
        {(data.stats as Stat[])
          .filter((st) => st.player === p.id)
          .map((st) => (
            <div className="stat-row" key={st.id}>
              <Link href={"/matches/" + st.game}>{tr("المباراة")}</Link>
              <span>
                {st.points} PTS · {st.rebounds} REB · {st.assists} AST
              </span>
            </div>
          ))}
      </>
    ) : (
      <Empty title={tr("بيانات اللاعب غير متاحة.")} />
    );
  } else if (route === "news" && path[1]) {
    const n = data.news.find((n) => n.slug === path[1])!;
    content = (
      <article className="article">
        <span className="eyebrow">
          {date(n.publishedAt)} · {n.author}
        </span>
        <h1>{lang === "en" && n.titleEn ? n.titleEn : n.title}</h1>
        {n.cover && (
          <Image
            className="news-cover"
            src={n.cover}
            alt=""
            width={1200}
            height={640}
            sizes="(max-width:1200px) 90vw, 1100px"
          />
        )}
        <p className="lead">
          {lang === "en" && n.excerptEn ? n.excerptEn : n.excerpt}
        </p>
        <div className="article-body">
          {lang === "en" && n.contentEn ? n.contentEn : n.content}
        </div>
      </article>
    );
  } else if (route === "news")
    content = (
      <>
        <label className="news-search" id="news-search">
          {tr("بحث")}
          <input
            type="search"
            value={newsSearch}
            onChange={(event) => setNewsSearch(event.target.value)}
            aria-label={tr("بحث")}
          />
        </label>
        {NewsList()}
      </>
    );
  else content = <Admin data={data} onData={acceptData} />;
  return (
    <div
      className={`tournament-shell${route === "home" ? " rd-home-shell" : ""}`}
    >
      <a className="skip" href="#main">
        {tr("انتقل للمحتوى")}
      </a>
      {route === "home" ? (
        <HomeTopbar />
      ) : (
        <div className="topbar" dir="ltr">
          <span>ROAD TO BAL 2027 · TRIPOLI · 21—25 OCT 2026</span>
          <a
            href="https://www.fiba.basketball/en/news/introducing-the-road-to-bal-2027"
            target="_blank"
            rel="noreferrer"
          >
            FIBA ↗
          </a>
        </div>
      )}
      <TournamentHeader />
      {!connected && (
        <div className="notice" role="status">
          {tr("أنت غير متصل بالمصدر المباشر — آخر تحديث")}{" "}
          {lastReceived
            ? new Date(lastReceived).toLocaleTimeString(
                lang === "ar" ? "ar-LY" : "en-GB",
              )
            : tr("عند فتح الصفحة")}
          {tr(". تُعرض آخر بيانات مستلمة.")}
        </div>
      )}
      <main
        id="main"
        className={
          route === "home"
            ? "event-home"
            : ["matches", "standings", "stats"].includes(route)
              ? `sports-page sports-${route} ${route === "matches" && path[1] ? "sports-match-page" : ""}`
              : route !== "admin" && route !== "team"
                ? `public-page public-${route}`
                : route === "admin"
                  ? "operator-page"
                  : "club-page"
        }
      >
        {route !== "home" &&
          route !== "team" &&
          route !== "players" &&
          !(route === "news" && path[1]) && (
            <div className="page-heading">
              <span className="eyebrow">ROAD TO BAL · TRIPOLI 2027</span>
              <h1>
                {
                  (
                    {
                      matches: tr("المباريات"),
                      standings: tr("المجموعات"),
                      teams: tr("الفرق"),
                      stats: tr("الإحصائيات"),
                      news: tr("الأخبار"),
                      road: "THE ROAD",
                      admin: tr("غرفة إدارة البطولة"),
                    } as Record<string, string>
                  )[route]
                }
              </h1>
            </div>
          )}
        {content}
      </main>
      {route === "home" ? (
        <HomeFooter />
      ) : (
        <footer className="tournament-ending">
          <EventSponsors />
          <nav className="ending-links" aria-label={tr("التنقل السريع")}>
            {[
              ["/", "الرئيسية"],
              ["/matches", "المباريات"],
              ["/news", "الأخبار"],
              ["/standings", "الترتيب"],
              ["/teams", "الفرق"],
              ["/the-road", "THE ROAD"],
              ["/stats", "الإحصائيات"],
            ].map(([href, label]) => (
              <Link key={href} href={href}>
                {tr(label)}
              </Link>
            ))}
          </nav>
          <div className="ending-details">
            <div className="ending-brand" dir="ltr">
              <TournamentLogo />
              <div>
                <b>ROAD TO BAL</b>
                <span>TRIPOLI — Libya</span>
              </div>
            </div>
            <p dir={dir}>
              {tr(
                "تستضيف العاصمة الليبية طرابلس التصفيات التمهيدية للدوري الإفريقي لكرة السلة BAL 2027، بمشاركة 10 فرق تمثل 10 دول إفريقية في منافسات حماسية تجمع نخبة من المواهب والطموحات، وتؤكد مكانة ليبيا كوجهة للرياضة الإفريقية.",
              )}
            </p>
          </div>
          <small dir="ltr">2027 TRIPOLI IS THE COURT. © ROAD TO BAL</small>
        </footer>
      )}
      <nav className="bottom-nav" aria-label={tr("التنقل السريع")}>
        {[
          ["/", tr("الرئيسية")],
          ["/matches", tr("المباريات")],
          [
            live.length ? "/matches?filter=live" : "/the-road",
            live.length ? "● " + tr("مباشر") : "THE ROAD",
          ],
          ["/standings", tr("المجموعات")],
          ["/teams", tr("الفرق")],
        ].map(([href, label], i) => (
          <Link className={i === 2 ? "focal" : ""} key={i} href={href}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
