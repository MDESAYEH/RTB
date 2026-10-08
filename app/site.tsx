"use client";
import { uploadMedia } from "@/lib/media-client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { ClubProfile } from "@/lib/club-profile";

import { EditorialClubProfile } from "./editorial-club-profile";
import { StadeTournamentHub } from "./stade-tournament-hub";
import { ClubRoadLine } from "./club-road-primitives";
import { TournamentHeader, CampaignHero } from "./tournament-campaign";
import Image from "next/image";
import { CourtArc } from "./brand-primitives";
import { EventSponsors } from "./event-sponsors";
import { useLang } from "./i18n";
import { getTeamIdentity } from "@/lib/team-identity";
import {
  CalendarDays,
  Trophy,
  Radio,
  Activity,
  Shield,
  ChevronLeft,
} from "lucide-react";
import {
  transitions,
  standings,
  qualification,
  remainingClock,
  stale,
  type Settings,
  type Team,
  type Game,
  type News,
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
type Data = {
  settings: Settings;
  teams: Team[];
  games: Game[];
  news: News[];
  players: unknown[];
  stats: unknown[];
  events: {
    id: string;
    game: string;
    period: number;
    clock: string;
    text: string;
    textEn?: string;
  }[];
  teamStats: Record<string, string | number>[];
  pulse: {
    id: string;
    text: string;
    textEn?: string;
    date: string;
    type?: string;
    game?: string;
    team?: string;
  }[];
  revision: number;
};
const statusLabel: Record<string, string> = {
  Scheduled: "قادمة",
  Warmup: "الإحماء",
  Live: "مباشر",
  Halftime: "استراحة",
  Ended: "انتهت",
  Postponed: "مؤجلة",
  Cancelled: "ملغاة",
};
function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <CalendarDays size={30} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
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
export default function Site({
  path,
  initial,
  historicalProfile,
}: {
  path: string[];
  initial: Data;
  historicalProfile?: ClubProfile;
}) {
  const { lang, dir, tr } = useLang();
  const [data, setData] = useState(initial),
    [now, setNow] = useState(Date.now()),
    [connected, setConnected] = useState(true),
    [filter, setFilter] = useState("all"),
    [day, setDay] = useState(""),
    [group, setGroup] = useState("A");
  const route = path[0] === "the-road" ? "road" : path[0] || "home";
  const [lastReceived, setLastReceived] = useState<number | null>(null);
  const acceptData = (next: Data) =>
    setData((previous) =>
      next.revision >= previous.revision ? next : previous,
    );
  useEffect(() => {
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
    const selectedDay = new URLSearchParams(location.search).get("day");
    if (selectedDay) setDay(selectedDay);
    const selectedFilter = new URLSearchParams(location.search).get("filter");
    if (
      selectedFilter &&
      ["all", "today", "upcoming", "finished", "live"].includes(selectedFilter)
    )
      setFilter(selectedFilter);
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
  function GameCard({ g }: { g: Game }) {
    const h = team(g.home),
      a = team(g.away);
    return (
      <article className={"game-row state-" + g.status.toLowerCase()}>
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
  function Table({ g }: { g: string }) {
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
        <div className="days" dir="ltr">
          <button onClick={() => setDay("")} className={!day ? "active" : ""}>
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
        {visible.length ? (
          visible.map((g) => <GameCard key={g.id} g={g} />)
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
        {data.news.map((n) => (
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
      <>
        {live.length > 0 && (
          <section className="live-strip">
            <div className="section-title">
              <h2>
                <Radio size={22} /> {tr("مباشر من طرابلس")}
              </h2>
              <Link href="/matches">{tr("مركز المباريات")}</Link>
            </div>
            {live.map((g) => (
              <GameCard key={g.id} g={g} />
            ))}
          </section>
        )}
        <CampaignHero
          count={count}
          seconds={seconds}
          ended={now > Date.parse(s.end)}
          clubs={teams.length}
          nations={new Set(teams.map((team) => team.country)).size}
          groups={s.groups.length}
        />
        <section>
          <div className="section-title">
            <div>
              <span className="eyebrow">ON THE COURT</span>
              <h2>
                {live.length
                  ? tr("مباشر الآن")
                  : now > Date.parse(s.end)
                    ? tr("نتائج البطولة")
                    : tr("الموعد القادم")}
              </h2>
            </div>
            <Link href="/matches">
              {tr("كل المباريات")} <ChevronLeft size={18} />
            </Link>
          </div>
          {(live.length
            ? games.filter(
                (g) =>
                  dayKey(g.date) === today &&
                  !["Live", "Halftime"].includes(g.status),
              )
            : games.filter((g) =>
                now > Date.parse(s.end)
                  ? g.status === "Ended"
                  : Date.parse(g.date) > now,
              )
          ).length ? (
            (live.length
              ? games.filter(
                  (g) =>
                    dayKey(g.date) === today &&
                    !["Live", "Halftime"].includes(g.status),
                )
              : games.filter((g) =>
                  now > Date.parse(s.end)
                    ? g.status === "Ended"
                    : Date.parse(g.date) > now,
                )
            )
              .slice(0, 2)
              .map((g) => <GameCard key={g.id} g={g} />)
          ) : (
            <div className="schedule-note">
              <span className="schedule-icon">
                <CalendarDays size={28} />
              </span>
              <div>
                <h3>{tr("العد التنازلي بدأ. الجدول قريبًا.")}</h3>
                <p>
                  {tr(
                    "خمسة أيام من كرة السلة الأفريقية في قلب طرابلس. تابع هنا مواعيد المباريات عند اعتمادها.",
                  )}
                </p>
              </div>
              <Link href="/matches" className="text-link">
                {tr("المباريات")} <ChevronLeft size={20} />
              </Link>
            </div>
          )}
        </section>
        <Road preview />
        <section>
          <div className="section-title">
            <div>
              <span className="eyebrow">TEN TEAMS. FOUR PLACES.</span>
              <h2>{tr("أفريقيا تلتقي في طرابلس")}</h2>
            </div>
            <Link href="/teams">
              {tr("كل الفرق")} <ChevronLeft size={18} />
            </Link>
          </div>
          <div className="group-preview">
            {s.groups.map((g) => (
              <div key={g}>
                <h3>GROUP {g}</h3>
                {teams
                  .filter((t) => t.group === g)
                  .map((t) => (
                    <Link key={t.id} href={"/teams/" + t.id}>
                      <Badge team={t} />
                      <b dir="auto">{t.name}</b>
                      <span>{tr(t.country)}</span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        </section>
        {data.pulse.length > 0 && (
          <section className="pulse">
            <div>
              <span className="eyebrow">
                <Activity size={16} /> TRIPOLI PULSE
              </span>
              <h2>{tr("نبض البطولة")}</h2>
              <p>{tr("من صافرة البداية إلى آخر مقعد في Elite 16.")}</p>
            </div>
            <div>
              {data.pulse.length ? (
                data.pulse
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5)
                  .map((p) => (
                    <article
                      key={p.id}
                      className={
                        "pulse-event " +
                        (p.type || "announcement").toLowerCase()
                      }
                    >
                      <time>{date(p.date)}</time>
                      <span className="pulse-type">
                        {p.type || "ANNOUNCEMENT"}
                      </span>
                      <p>{lang === "en" && p.textEn ? p.textEn : p.text}</p>
                      {p.game && (
                        <Link className="text-link" href={"/matches/" + p.game}>
                          {tr("مركز المباراة")} <ChevronLeft size={14} />
                        </Link>
                      )}
                    </article>
                  ))
              ) : (
                <p className="muted">
                  {tr("هنا تُكتب لحظات البطولة، فور حدوثها.")}
                </p>
              )}
            </div>
          </section>
        )}
        {s.featuredGameId && games.find((g) => g.id === s.featuredGameId) && (
          <section>
            <h2>{tr("مباراة اليوم")}</h2>
            <GameCard g={games.find((g) => g.id === s.featuredGameId)!} />
          </section>
        )}
        {games.length > 0 && (
          <section>
            <div className="section-title">
              <h2>{tr("أيام طرابلس")}</h2>
              <span className="muted">21—25 OCTOBER</span>
            </div>
            <div className="timeline">
              {days.map((d, i) => (
                <button
                  aria-pressed={(day || dayKey(days[0])) === dayKey(d)}
                  className={
                    (dayKey(d) === today ? "today " : "") +
                    (dayKey(d) < today ? "past" : "future")
                  }
                  onClick={() => setDay(dayKey(d))}
                  key={d}
                >
                  <span>DAY 0{i + 1}</span>
                  <strong>
                    {new Intl.DateTimeFormat("en", {
                      timeZone: s.timezone,
                      day: "numeric",
                    }).format(new Date(d))}
                  </strong>
                  <small>OCT</small>
                </button>
              ))}
            </div>
            <div className="day-content">
              {games.filter((g) => dayKey(g.date) === (day || dayKey(days[0])))
                .length ? (
                games
                  .filter((g) => dayKey(g.date) === (day || dayKey(days[0])))
                  .map((g) => <GameCard key={g.id} g={g} />)
              ) : (
                <p className="muted">
                  {tr("لم يُعلن جدول مباريات هذا اليوم بعد.")}
                </p>
              )}
            </div>
          </section>
        )}
        {data.news.length > 0 && (
          <section>
            <div className="section-title">
              <h2>{tr("من قلب الحدث")}</h2>
              <Link href="/news">
                {tr("الأخبار")} <ChevronLeft size={18} />
              </Link>
            </div>
            <NewsList />
          </section>
        )}
      </>
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
        <Table g={g.group} />
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
  } else if (route === "matches") content = <Matches />;
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
              <Table g={g} />
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
        <TeamGrid />
      </>
    );
  else if (route === "road")
    content = (
      <>
        <Road />
        <TeamGrid />
      </>
    );
  else if (route === "stats") content = <Statistics />;
  else if (route === "team") {
    const t = team(path[1])!;
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
        />
      </div>
    );
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
  } else if (route === "news") content = <NewsList />;
  else content = <Admin data={data} onData={acceptData} />;
  return (
    <div className="tournament-shell">
      <a className="skip" href="#main">
        {tr("انتقل للمحتوى")}
      </a>
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
      <footer className="tournament-ending">
        <EventSponsors />
        <div className="ending-details">
          <div>
            <p>{tr("منصة تصفيات Road to BAL 2027 في طرابلس.")}</p>
            <p>{tr("النتائج والبيانات تُنشر بعد اعتمادها.")}</p>
          </div>
          <div className="ending-links">
            <Link href="/teams">{tr("الأندية")}</Link>
            <Link href="/matches">{tr("المباريات")}</Link>
            <Link href="/admin">{tr("الإدارة")}</Link>
            <a
              href="https://www.fiba.basketball/en/news/introducing-the-road-to-bal-2027"
              target="_blank"
              rel="noreferrer"
            >
              FIBA ↗
            </a>
          </div>
        </div>
        <small dir="ltr">2027 TRIPOLI IS THE COURT. © ROAD TO BAL</small>
      </footer>
      <div className="bottom-nav" role="navigation" aria-label={tr("التنقل السريع")}>
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
      </div>
    </div>
  );
}
function Admin({ data, onData }: { data: Data; onData: (data: Data) => void }) {
  const { tr } = useLang();
  const [auth, setAuth] = useState(false),
    [password, setPassword] = useState(""),
    [tab, setTab] = useState("live"),
    [error, setError] = useState(""),
    [records, setRecords] = useState<
      { kind: string; value: Record<string, unknown> }[]
    >([]),
    [audit, setAudit] = useState<Record<string, unknown>[]>([]),
    [kind, setKind] = useState("games"),
    [json, setJson] = useState(""),
    [selected, setSelected] = useState(""),
    [clock, setClock] = useState(600);
  async function load() {
    const r = await fetch("/api/admin");
    if (r.ok) {
      const v = await r.json();
      setAuth(true);
      setRecords(v.records);
      setAudit(v.audit);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const saving = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const [busy, setBusy] = useState(false),
    [danger, setDanger] = useState<Record<string, unknown> | null>(null),
    [correction, setCorrection] = useState(""),
    [reason, setReason] = useState("");
  async function mutate(body: unknown) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    const command: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      requestId: crypto.randomUUID(),
    };
    if (command.id && command.action !== "save")
      command.version = latest.current.games.find(
        (g) => g.id === command.id,
      )?.version;
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const v = await r.json();
      if (!r.ok) {
        setError(v.error);
        if (r.status === 409) {
          const snapshot = await (
            await fetch("/api/data", { cache: "no-store" })
          ).json();
          onData(snapshot);
          latest.current = snapshot;
        }
        return;
      }
      if (v.data) {
        onData(v.data);
        latest.current = v.data;
      }
      setDanger(null);
      if ((body as { action: string }).action === "logout") {
        setAuth(false);
        return;
      }
      await load();
    } catch {
      setError(tr("تعذر الاتصال؛ تحقق من الشبكة قبل إعادة المحاولة."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const g = data.games.find((g) => g.id === selected) || data.games[0];
  useEffect(() => {
    const game =
      latest.current.games.find((game) => game.id === selected) ||
      latest.current.games[0];
    setClock(game?.clock ?? 600);
  }, [selected]);
  let draft: Record<string, unknown> = {};
  try {
    draft = JSON.parse(json || "{}");
  } catch {}
  const template: Record<string, unknown> = {
    events: {
      id: crypto.randomUUID(),
      game: "",
      period: 1,
      clock: "10:00",
      text: "",
      date: new Date().toISOString(),
    },
    teamStats: {
      id: crypto.randomUUID(),
      game: "",
      team: data.teams[0]?.id,
      fgMade: 0,
      fgAttempted: 0,
      twoMade: 0,
      twoAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
    },
    games: {
      id: crypto.randomUUID(),
      home: data.teams[0]?.id,
      away: data.teams[1]?.id,
      group: "A",
      date: "2026-10-21T18:00:00+02:00",
      venue: "",
      status: "Scheduled",
    },
    teams: {
      id: "team-id",
      name: "",
      country: "",
      group: "A",
      verified: false,
    },
    players: {
      id: crypto.randomUUID(),
      team: data.teams[0]?.id,
      name: "",
      number: 0,
      position: "",
    },
    news: {
      id: crypto.randomUUID(),
      title: "",
      titleEn: "",
      slug: "article-slug",
      excerpt: "",
      excerptEn: "",
      content: "",
      contentEn: "",
      author: "",
      publishedAt: new Date().toISOString(),
      status: "draft",
    },
    pulse: {
      id: crypto.randomUUID(),
      text: "",
      textEn: "",
      date: new Date().toISOString(),
    },
    settings: data.settings,
    stats: {
      id: crypto.randomUUID(),
      game: "",
      player: "",
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      efficiency: 0,
    },
  };
  if (!auth)
    return (
      <div className="login">
        <Shield size={36} />
        <h2>{tr("دخول الإدارة")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({ action: "login", password });
          }}
        >
          <label>
            {tr("كلمة المرور")}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="primary">{tr("دخول آمن")}</button>
        </form>
        {error && <p role="alert">{error}</p>}
        <p className="muted">
          {tr("يلزم إنشاء حساب الإدارة من الخادم قبل تسجيل الدخول.")}
        </p>
      </div>
    );
  return (
    <div className="admin" aria-busy={busy}>
      <div className="tabs">
        {[
          ["live", "التحكم المباشر"],
          ["editor", "البيانات والمحتوى"],
          ["health", "صحة البيانات"],
          ["audit", "سجل التدقيق"],
        ].map(([id, title]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={tab === id ? "active" : ""}
          >
            {tr(title)}
          </button>
        ))}
        <button onClick={() => void mutate({ action: "logout" })}>
          {tr("خروج")}
        </button>
      </div>
      {danger && (
        <dialog
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
          className="admin-confirm"
          onCancel={() => setDanger(null)}
          aria-labelledby="confirm-title"
        >
          <h2 id="confirm-title">
            {danger.action === "correct"
              ? tr("تصحيح إداري موثق")
              : tr("تأكيد تغيير حالة المباراة")}
          </h2>
          <p>{tr("راجع الفريقين والنتيجة. سيُحفظ هذا الإجراء في سجل التدقيق.")}</p>
          {danger.action === "correct" && (
            <>
              <label>
                {tr("بيانات المباراة المصححة (JSON)")}
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  rows={12}
                />
              </label>
              <label>
                {tr("سبب التصحيح")}
                <input
                  value={reason}
                  minLength={8}
                  maxLength={400}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            disabled={busy}
            className="primary"
            onClick={() => {
              try {
                void mutate(
                  danger.action === "correct"
                    ? {
                        ...danger,
                        value: JSON.parse(correction),
                        reason,
                        confirmed: true,
                      }
                    : danger,
                );
              } catch {
                setError(tr("JSON غير صالح"));
              }
            }}
          >
            {tr("تأكيد وحفظ")}
          </button>
          <button disabled={busy} onClick={() => setDanger(null)}>
            {tr("إلغاء")}
          </button>
        </dialog>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {tab === "live" &&
        (g ? (
          <>
            <label>
              {tr("المباراة")}
              <select
                value={g.id}
                aria-label={tr("المباراة")}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setClock(
                    data.games.find((g) => g.id === e.target.value)?.clock || 0,
                  );
                }}
              >
                {data.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {data.teams.find((t) => t.id === g.home)?.name} /{" "}
                    {data.teams.find((t) => t.id === g.away)?.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="live-room" dir="ltr">
              {(["home", "away"] as const).map((side) => (
                <div key={side}>
                  <h3>{data.teams.find((t) => t.id === g[side])?.name}</h3>
                  <strong>
                    {g[side === "home" ? "homeScore" : "awayScore"]}
                  </strong>
                  <div>
                    {[1, 2, 3].map((p) => (
                      <button
                        aria-label={
                          tr("إضافة") +
                          " " +
                          p +
                          " " +
                          tr("إلى") +
                          " " +
                          data.teams.find((t) => t.id === g[side])?.name
                        }
                        disabled={busy || g.status !== "Live"}
                        key={p}
                        onClick={() =>
                          void mutate({
                            action: "score",
                            id: g.id,
                            version: g.version,
                            side,
                            points: p,
                          })
                        }
                      >
                        +{p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p>
              {tr("الحالة")}: {tr(statusLabel[g.status])} · Q{g.quarter}
              <b className="operator-clock" dir="ltr">
                {String(Math.floor(remainingClock(g) / 60)).padStart(2, "0")}:
                {String(remainingClock(g) % 60).padStart(2, "0")}
              </b>
            </p>
            <div className="controls">
              {transitions[g.status].map((status) => (
                <button
                  key={status}
                  disabled={busy}
                  onClick={() =>
                    ["Ended", "Cancelled"].includes(status)
                      ? setDanger({
                          action: "status",
                          id: g.id,
                          version: g.version,
                          status,
                        })
                      : void mutate({
                          action: "status",
                          id: g.id,
                          version: g.version,
                          status,
                        })
                  }
                >
                  {tr(statusLabel[status])}
                </button>
              ))}
              <button
                onClick={() =>
                  void mutate({ action: "undo", id: g.id, version: g.version })
                }
              >
                {tr("تراجع")} / Undo
              </button>
            </div>
            {["Live", "Halftime", "Ended"].includes(g.status) && (
              <button
                disabled={busy}
                onClick={() => {
                  setCorrection(JSON.stringify(g, null, 2));
                  setReason("");
                  setDanger({
                    action: "correct",
                    id: g.id,
                    version: g.version,
                  });
                }}
              >
                {tr("تصحيح إداري موثق")}
              </button>
            )}
            <div className="controls">
              <label>
                {tr("الساعة (ثوانٍ)")}
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={clock}
                  onChange={(e) => setClock(Number(e.target.value))}
                />
              </label>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    clock,
                    running: false,
                  })
                }
              >
                {tr("ضبط")}
              </button>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    running: true,
                  })
                }
              >
                Start / Resume
              </button>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    running: false,
                  })
                }
              >
                Pause
              </button>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    quarter: g.quarter + 1,
                    clock: g.quarter >= 4 ? 300 : 600,
                    running: false,
                  })
                }
              >
                {tr("الفترة التالية")}
              </button>
            </div>
          </>
        ) : (
          <Empty title={tr("أنشئ مباراة معتمدة من محرر البيانات للبدء.")} />
        ))}
      {tab === "editor" && (
        <>
          <label>
            {tr("رفع صورة معتمدة (PNG / JPEG / WebP، حتى 5 MB)")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const v = await uploadMedia(file);
                  const key =
                    kind === "teams"
                      ? "logo"
                      : kind === "players"
                        ? "photo"
                        : "cover";
                  setJson(JSON.stringify({ ...draft, [key]: v.url }, null, 2));
                } catch {
                  setError(tr("تعذر رفع الصورة"));
                }
              }}
            />
          </label>
          <p>
            {tr(
              "محرر بيانات منظم. لا تنشر أي موعد أو قائمة أو نتيجة قبل التحقق منها.",
            )}
          </p>
          <label>
            {tr("نوع البيانات")}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setJson("");
              }}
            >
              {Object.keys(template).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <div className="controls">
            <button
              onClick={() => setJson(JSON.stringify(template[kind], null, 2))}
            >
              {tr("سجل جديد")}
            </button>
            {records
              .filter((r) => r.kind === kind)
              .map((r, i) => (
                <button
                  key={i}
                  onClick={() => setJson(JSON.stringify(r.value, null, 2))}
                >
                  {String(
                    r.value.name ||
                      r.value.title ||
                      r.value.id ||
                      tr("الإعدادات"),
                  )}
                </button>
              ))}
          </div>
          {json && (
            <div className="editor-fields">
              {Object.entries(draft)
                .filter(
                  ([key, v]) =>
                    !["version", "updatedAt", "periods"].includes(key) &&
                    (["string", "number", "boolean"].includes(typeof v) ||
                      (Array.isArray(v) &&
                        v.every((x) => typeof x === "string"))),
                )
                .map(([key, v]) => (
                  <label key={key}>
                    {tr(
                      (
                      {
                        id: "المعرّف",
                        name: "الاسم",
                        country: "الدولة",
                        group: "المجموعة",
                        home: "الفريق الأول",
                        away: "الفريق الثاني",
                        date: "موعد المباراة مع المنطقة الزمنية",
                        venue: "المكان",
                        title: "العنوان",
                        slug: "رابط الخبر",
                        excerpt: "المقدمة",
                        content: "المحتوى",
                        titleEn: "العنوان (English)",
                        excerptEn: "المقدمة (English)",
                        contentEn: "المحتوى (English)",
                        textEn: "النص (English)",
                        author: "الكاتب",
                        publishedAt: "تاريخ النشر",
                        status: "الحالة",
                        team: "الفريق",
                        number: "الرقم",
                        position: "المركز",
                        verified: "تم التحقق",
                        hero: "عنوان الرئيسية",
                        announcement: "الإعلان",
                        rulesConfirmed: "تم اعتماد قواعد البطولة",
                        qualificationSlots: "عدد المتأهلين",
                        start: "بداية البطولة",
                        end: "نهاية البطولة",
                        timezone: "المنطقة الزمنية",
                        groups: "المجموعات (مفصولة بفواصل)",
                        featuredGameId: "معرّف المباراة المميزة",
                      } as Record<string, string>
                      )[key] || key,
                    )}
                    {typeof v === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.checked },
                              null,
                              2,
                            ),
                          )
                        }
                      />
                    ) : ["home", "away", "team"].includes(key) ? (
                      <select
                        value={String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.value },
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        {data.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : key === "status" ? (
                      <select
                        value={String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.value },
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        {(kind === "news"
                          ? ["draft", "published"]
                          : ["Scheduled"]
                        ).map((st) => (
                          <option key={st}>{st}</option>
                        ))}
                      </select>
                    ) : ["content", "excerpt", "contentEn", "excerptEn", "announcement"].includes(key) ? (
                      <textarea
                        value={String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.value },
                              null,
                              2,
                            ),
                          )
                        }
                        rows={key.startsWith("content") ? 8 : 3}
                      />
                    ) : (
                      <input
                        dir={
                          [
                            "id",
                            "slug",
                            "date",
                            "start",
                            "end",
                            "publishedAt",
                            "timezone",
                          ].includes(key)
                            ? "ltr"
                            : "auto"
                        }
                        type={typeof v === "number" ? "number" : "text"}
                        value={Array.isArray(v) ? v.join(",") : String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              {
                                ...draft,
                                [key]: Array.isArray(v)
                                  ? e.target.value
                                      .split(",")
                                      .map((x) => x.trim())
                                  : typeof v === "number"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              },
                              null,
                              2,
                            ),
                          )
                        }
                      />
                    )}
                  </label>
                ))}
            </div>
          )}
          <details>
            <summary>{tr("محرر JSON المتقدم")}</summary>
            <label>
              JSON
              <textarea
                dir="ltr"
                spellCheck={false}
                rows={20}
                value={json}
                onChange={(e) => setJson(e.target.value)}
              />
            </label>
          </details>
          <button
            className="primary"
            onClick={() => {
              try {
                void mutate({ action: "save", kind, value: JSON.parse(json) });
              } catch {
                setError(tr("JSON غير صالح"));
              }
            }}
          >
            {tr("تحقق واحفظ")}
          </button>
          <p className="muted">
            {tr(
              "المباريات الموجودة تُدار من غرفة التحكم. المجموعات، التأهل والمحتوى في settings. stats للبيانات المعتمدة لكل لاعب ومباراة.",
            )}
          </p>
        </>
      )}
      {tab === "health" && (
        <>
          <h2>{tr("مصادر البيانات")}</h2>
          {["Manual", "FIBA", "Sofascore", "365Scores"].map((name, i) => (
            <div className="health-row" key={name}>
              <b>{name}</b>
              <span>
                {i === 0 ? "HEALTHY · " + tr("المصدر الحالي") : "NOT_CONFIGURED"}
              </span>
              <span>
                {i === 0
                  ? tr("قاعدة البيانات المحلية · لا مزامنة خارجية")
                  : tr("لم يُثبت تكامل API معتمد")}
              </span>
            </div>
          ))}
          <h3>{tr("جودة البيانات")}</h3>
          {data.teams
            .filter((t) => !t.verified)
            .map((t) => (
              <p key={t.id}>UNCONFIRMED spelling · {t.name}</p>
            ))}
          {data.games
            .filter((g) => stale(g))
            .map((g) => (
              <p key={g.id}>
                STALE · {g.id} · {tr("آخر تحديث")} {g.updatedAt}
              </p>
            ))}
          <p>
            {tr(
              "عتبة تأخر البيانات المباشرة: 45 ثانية. لا يوجد مصدر خارجي نشط أو تعارض مصادر حالي.",
            )}
          </p>
        </>
      )}
      {tab === "audit" && (
        <div className="audit">
          {audit.map((a, i) => (
            <details key={i}>
              <summary>
                {String(a.time)} · {String(a.actor)} · {String(a.kind)} ·{" "}
                {String(a.action || "historical")} · {String(a.target)}
              </summary>
              {a.reason ? <p>
                  {tr("سبب التصحيح")}: {String(a.reason)}
                </p> : null}
              <pre dir="ltr">
                {JSON.stringify(
                  {
                    old: a.old ? JSON.parse(String(a.old)) : null,
                    new: a.new ? JSON.parse(String(a.new)) : null,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
