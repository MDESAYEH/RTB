"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClubProfile } from "@/lib/club-profile";

import { EditorialClubProfile } from "./editorial-club-profile";
import { ClubRoadLine } from "./club-road-primitives";
import { TournamentHeader, CampaignHero } from "./tournament-campaign";
import Image from "next/image";
import dynamic from "next/dynamic";
import { CourtArc } from "./brand-primitives";
import { HomeContent, HomeTopbar, TournamentFooter } from "./home-content";
import { useLang } from "./i18n";
import { Empty, statusLabel, type Data } from "./site-shared";
import { StreamPlayer } from "./stream-player";
import { broadcastPlaceholder, matchStream } from "@/lib/stream";
import { getTeamIdentity } from "@/lib/team-identity";
import { TeamPassport } from "./team-passport";
import { TeamsContent } from "./teams-content";
import { NewsArticle } from "./news-article";
import { NewsContent } from "./news-content";
import { LiveCenter } from "./live-center";
import { OfficialMatchDetails } from "./official-match-details";
import { MatchesContent } from "./matches-content";
import { StatsContent } from "./stats-content";
import { RoadContent } from "./road-content";
import { LegalContent, type LegalPage } from "./legal-content";
import { Trophy } from "lucide-react";
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
  const logo =
    team.sourceLogo || team.logo || getTeamIdentity(team.id)?.logoAsset;
  if (logo)
    return (
      <Image
        className="team-logo"
        src={logo}
        unoptimized={!!team.sourceLogo}
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
// Admin UI (editors, audit log, uploads) loads only on the private admin path (lib/admin-path.ts).
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
  const legalPages: string[] = ["privacy", "terms", "accessibility"];
  const [lastReceived, setLastReceived] = useState<number | null>(null);
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
    const card = route === "standings" || route === "matches";
    const rows = standings(
        teams.filter((t) => t.group === g),
        games,
        s,
      ),
      played = rows.some((r) => r.p);
    return (
      <div
        className={`standings-wrap${card ? ` standings-card group-color-${g.toLowerCase()}` : ""}`}
      >
        <div className="group-heading">
          {card ? (
            <>
              <div>
                <h2 dir="ltr">GROUP {g}</h2>
                <small>
                  {lang === "ar"
                    ? g === "A"
                      ? "المجموعة الأولى"
                      : g === "B"
                        ? "المجموعة الثانية"
                        : `المجموعة ${g}`
                    : `Group ${g}`}
                  {lang === "ar" ? "،" : ","} {rows.length} {tr("فرق")}
                </small>
              </div>
              <b className="standings-letter">{g}</b>
            </>
          ) : (
            <>
              <span>GROUP {g}</span>
              <span className="muted">
                {lang === "ar"
                  ? `أول ${s.qualificationSlots} إلى Elite 16`
                  : `Top ${s.qualificationSlots} advance to Elite 16`}
              </span>
            </>
          )}
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
                  <Link
                    className={card ? "standings-team" : undefined}
                    href={"/teams/" + r.team.id}
                  >
                    <Badge team={r.team} />
                    <span dir="auto" className="standings-team-text">
                      {card ? (
                        <strong dir="auto">{r.team.name}</strong>
                      ) : (
                        r.team.name
                      )}
                      {card && (
                        <small className="standings-team-sub" dir="rtl">
                          {getTeamIdentity(r.team.id)?.arabicName ||
                            r.team.name}
                        </small>
                      )}
                      <small className="mobile-aux">
                        {played
                          ? `P ${r.p} · PF ${r.pf} · PA ${r.pa}`
                          : tr("لم يلعب بعد")}
                      </small>
                    </span>
                    {card && (
                      <em className="standings-team-country">
                        {tr(r.team.country)}
                      </em>
                    )}
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
    if (route === "road" && !preview)
      return (
        <RoadContent
          teams={teams}
          states={
            states as ("COMPLETED" | "CURRENT" | "LOCKED" | "QUALIFIED")[]
          }
          slots={s.qualificationSlots}
          qualified={qualifiers.map((t) => t.id)}
          badge={(t) => <Badge team={t} />}
        />
      );
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
              ["01", "TRIPOLI", "21–23 OCT 2026"],
              ["02", "GROUP STAGE", tr("مجموعتان، ثمانية فرق")],
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
    return (
      <MatchesContent
        games={games}
        teams={teams}
        count={count}
        seconds={seconds}
        filter={filter}
        setFilter={setFilter}
        day={day}
        setDay={setDay}
        dayKey={dayKey}
        today={today}
        date={date}
        badge={(t) => <Badge team={t} />}
        liveContent={
          <LiveCenter
            data={data}
            now={now}
            connected={connected}
            clockNow={connected ? now : (lastReceived ?? serverNow)}
            badge={(t) => <Badge team={t} />}
          />
        }
      />
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
    // Each match has its own broadcast link; a `?stream=` link only previews the player.
    const matchBroadcast = previewStream
      ? ({ state: "show", url: previewStream } as const)
      : matchStream(g, now);
    const placeholder = broadcastPlaceholder(
      matchBroadcast.state,
      lang === "ar" ? "ar" : "en",
    );
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
          {["Live", "Halftime"].includes(g.status) && (
            <div className="match-clock" dir="ltr">
              Q{g.quarter} · {String(Math.floor(clock / 60)).padStart(2, "0")}:
              {String(clock % 60).padStart(2, "0")}
            </div>
          )}
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
                : "VS"}
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
            {date(g.date)}
            {lang === "ar" ? "،" : ","} GROUP {g.group}
          </p>
        </section>

        <p>
          {g.venue || tr("سيُعلن مكان المباراة لاحقًا")} · GROUP {g.group}
        </p>
        {matchBroadcast.state === "show" ? (
          <StreamPlayer url={matchBroadcast.url} />
        ) : (
          <section className="broadcast-stage" aria-label={tr("البث المباشر")}>
            <CourtArc />
            <span className="broadcast-play" aria-hidden="true">
              ▷
            </span>
            <span className="broadcast-label" dir="ltr">
              LIVE BROADCAST
            </span>
            <h2>{placeholder.title}</h2>
            <p>{placeholder.body}</p>
            <span className="broadcast-opponents" dir="ltr">
              {team(g.home)?.name} × {team(g.away)?.name}
            </span>
          </section>
        )}
        {g.periods.length > 0 && (
          <section
            className="match-period-card"
            aria-labelledby="period-score-title"
          >
            <header className="match-detail-heading">
              <div>
                <span className="match-detail-eyebrow" dir="ltr">
                  MATCH BREAKDOWN
                </span>
                <h2 id="period-score-title">
                  {lang === "ar" ? "نتائج الأرباع" : "Score by quarter"}
                </h2>
              </div>
              <span className="match-period-status" dir="ltr">
                {g.status === "Ended" ? "FINAL" : `Q${g.quarter}`}
              </span>
            </header>
            <div className="match-period-scroll">
              <table className="match-period-table" dir="ltr">
                <thead>
                  <tr>
                    <th scope="col">{lang === "ar" ? "الفريق" : "Team"}</th>
                    {Array.from(
                      { length: Math.max(4, g.periods.length) },
                      (_, i) => (
                        <th
                          scope="col"
                          key={i}
                          className={
                            i + 1 === g.quarter ? "is-current" : undefined
                          }
                        >
                          {i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
                        </th>
                      ),
                    )}
                    <th scope="col" className="period-total">
                      {lang === "ar" ? "المجموع" : "Total"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(["home", "away"] as const).map((side) => (
                    <tr key={side} className={`period-team-${side}`}>
                      <th scope="row">
                        <span className="period-team-name">
                          {team(g[side]) && <Badge team={team(g[side])!} />}
                          <span dir="auto">{team(g[side])?.name}</span>
                        </span>
                      </th>
                      {Array.from(
                        { length: Math.max(4, g.periods.length) },
                        (_, i) => (
                          <td
                            key={i}
                            className={
                              i + 1 === g.quarter ? "is-current" : undefined
                            }
                          >
                            {i + 1 > g.quarter && !g.periods[i]?.[side]
                              ? "—"
                              : (g.periods[i]?.[side] ?? "—")}
                          </td>
                        ),
                      )}
                      <td className="period-total">
                        {side === "home" ? g.homeScore : g.awayScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <OfficialMatchDetails game={g} english={lang === "en"} />
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
        <div className="sports-standings group-context">
          {groupTable(g.group)}
        </div>
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
        <div className="standings-intro">
          <div>
            <small>
              {lang === "ar" ? "الطريق إلى Elite 16" : "The road to Elite 16"}
            </small>
            <h2>
              {lang === "ar"
                ? "مجموعتان، طموح واحد."
                : "Two groups. One ambition."}
            </h2>
            <p>
              {lang === "ar"
                ? `يتأهل أول ${s.qualificationSlots} من كل مجموعة إلى المرحلة التالية.`
                : `The top ${s.qualificationSlots} teams in each group advance to the next stage.`}
            </p>
          </div>
          <div className="standings-summary">
            <span>
              <b>{teams.length}</b>
              {tr("الفرق")}
            </span>
            <span>
              <b>{s.groups.length}</b>
              {tr("المجموعات")}
            </span>
            <span>
              <b>{games.filter((g) => g.status === "Ended").length}</b>
              {lang === "ar" ? "مباريات مكتملة" : "Completed games"}
            </span>
          </div>
        </div>
        <div className="tabs group-switch">
          {s.groups.map((g) => (
            <button
              key={g}
              className={group === g ? "active" : ""}
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
            >
              {lang === "ar"
                ? g === "A"
                  ? "المجموعة الأولى"
                  : g === "B"
                    ? "المجموعة الثانية"
                    : `المجموعة ${g}`
                : `GROUP ${g}`}
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
      <TeamsContent
        teams={teams}
        groups={s.groups}
        badge={(t) => <Badge team={t} />}
      />
    );
  else if (route === "road") content = Road({});
  else if (legalPages.includes(route))
    content = <LegalContent page={route as LegalPage} />;
  else if (route === "stats")
    content = (
      <StatsContent
        stats={data.stats as Stat[]}
        players={data.players as Player[]}
      />
    );
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
    else
      content = (
        <TeamPassport
          team={t}
          profile={historicalProfile}
          data={data}
          now={connected ? now : (lastReceived ?? now)}
          badge={(t) => <Badge team={t} />}
        />
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
    content = <NewsArticle news={n} date={date} />;
  } else if (route === "news")
    content = <NewsContent news={data.news} date={date} />;
  else content = <Admin data={data} onData={acceptData} />;
  return (
    <div
      className={`tournament-shell${route === "home" || (route === "matches" && !path[1]) ? " rd-home-shell" : ""}`}
    >
      <a className="skip" href="#main">
        {tr("انتقل للمحتوى")}
      </a>
      <HomeTopbar />
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
              ? `sports-page sports-${route} ${route === "matches" && path[1] ? "sports-match-page" : route === "matches" ? "matches-redesign" : route === "stats" ? "stats-redesign" : ""}`
              : route !== "admin" && route !== "team"
                ? `public-page public-${route}${route === "news" ? " news-redesign" : route === "teams" ? " teams-redesign" : route === "road" ? " road-redesign" : legalPages.includes(route) ? " legal-redesign" : ""}`
                : route === "admin"
                  ? "operator-page"
                  : "club-page passport-page"
        }
      >
        {route !== "home" &&
          route !== "team" &&
          !(route === "matches" && !path[1]) &&
          route !== "stats" &&
          route !== "road" &&
          !legalPages.includes(route) &&
          route !== "players" &&
          route !== "news" &&
          route !== "teams" && (
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
      <TournamentFooter />
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
