"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  ChartNoAxesColumn,
  LockKeyhole,
  Clock,
  ChevronLeft,
} from "lucide-react";
import type { ClubProfile } from "@/lib/club-profile";
import { qualification, standings, type Team } from "@/lib/public-domain";
import { getTeamIdentity } from "@/lib/team-identity";
import type { Data } from "./site-shared";
import { useLang } from "./i18n";
import { playerName, positionLabel } from "@/lib/player-i18n";
import { ClubMatchLine } from "./stade-tournament-hub";

export function TeamPassport({
  team,
  profile,
  data,
  now,
  badge,
}: {
  team: Team;
  profile?: ClubProfile;
  data: Data;
  now: number;
  badge: (t: Team) => ReactNode;
}) {
  const { lang, tr } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const identity = getTeamIdentity(team.id);
  const arabic = profile?.arabicName || identity?.arabicName;
  const country =
    lang === "ar" && identity?.countryCode
      ? new Intl.DisplayNames(["ar"], { type: "region" }).of(
          identity.countryCode,
        )
      : tr(team.country);
  const matches = data.games
    .filter((g) => g.home === team.id || g.away === team.id)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const roster = (
    data.players as {
      id: string;
      team: string;
      name: string;
      number: number;
      position: string;
      photo?: string;
    }[]
  ).filter((p) => p.team === team.id);
  const record = standings(data.teams, data.games, data.settings).find(
    (r) => r.team.id === team.id,
  )!;
  const qualified =
    qualification(team, data.teams, data.games, data.settings) === "QUALIFIED";
  const started = matches.some((g) =>
    ["Live", "Halftime", "Ended"].includes(g.status),
  );
  const active = qualified ? 2 : started ? 1 : 0;
  const ended = new Set(
    matches.filter((g) => g.status === "Ended").map((g) => g.id),
  );
  const playerStats = (
    data.stats as {
      game: string;
      player: string;
      points: number;
      rebounds: number;
      assists: number;
    }[]
  ).filter((s) => ended.has(s.game) && roster.some((p) => p.id === s.player));
  const average = (key: "rebounds" | "assists") =>
    playerStats.length && ended.size
      ? (
          playerStats.reduce((n, s) => n + (Number(s[key]) || 0), 0) /
          ended.size
        ).toFixed(1)
      : "—";
  return (
    <div className="team-passport">
      <header className="match-banner">
        <small dir="ltr">GROUP {team.group} · TEAM PASSPORT</small>
        <h1 dir="auto">{team.name}</h1>
        <p>
          {arabic ? `${arabic}${copy("، ", ", ")}` : ""}
          {country}
        </p>
      </header>
      <div className="passport-body">
        <nav
          className="passport-breadcrumb"
          aria-label={copy("مسار التنقل", "Breadcrumb")}
        >
          <Link href="/teams">{tr("الفرق")}</Link>
          <ChevronLeft size={16} />
          <strong>{team.name}</strong>
        </nav>
        <section className="passport-profile">
          <div className="passport-profile-heading">
            <div>
              <h2>
                {arabic ? `${arabic} – ` : ""}
                {team.name}
              </h2>
              <p>
                {profile?.city ? `${profile.city === "Tripoli" ? copy("طرابلس", "Tripoli") : profile.city}${copy("، ", ", ")}` : ""}
                {country}
              </p>
            </div>
            <div className="passport-logo">{badge(team)}</div>
          </div>
          {profile?.foundedYear && (
            <p>
              <b>{copy("سنة التأسيس:", "Founded:")}</b> {profile.foundedYear}
              {profile.foundedScope ? `${copy("، ", ", ")}${profile.foundedScope}` : ""}
            </p>
          )}
          {profile?.bioShort && <p>{profile.bioShort}</p>}
          {!!profile?.domesticHonours.length && (
            <p>
              <b>{copy("أبرز الإنجازات:", "Honours:")}</b>{" "}
              {profile.domesticHonours
                .map(
                  (h) =>
                    `${h.title === "LIBYAN CHAMPION" ? copy("بطل الدوري الليبي", h.title) : h.title === "LIBYAN CUP" ? copy("كأس ليبيا", h.title) : h.title}${h.count ? ` (${h.count})` : ""}${h.year ? ` · ${h.year}` : ""}`,
                )
                .join("، ")}
            </p>
          )}
          {!profile?.bioShort && (
            <p className="passport-muted">
              {copy(
                "تُعرض المعلومات التاريخية الموثّقة هنا عند توفرها.",
                "Verified club history will appear here when available.",
              )}
            </p>
          )}
        </section>
        <section className="passport-journey">
          <small>THE ROAD</small>
          <h2>
            {copy(
              "رحلة الفريق، لحظة بلحظة",
              "The team’s journey, moment by moment",
            )}
          </h2>
          <p>
            {copy(
              "يتحرك المؤشر تلقائيًا من نتائج الفريق المعتمدة.",
              "Progress follows the team’s approved results.",
            )}
          </p>
          <div className="passport-stages">
            {[
              copy("الوصول إلى طرابلس", "Road to Tripoli"),
              copy(`المجموعة ${team.group}`, `Group ${team.group}`),
              "ELITE 16",
              "BAL 2027",
            ].map((label, i) => (
              <article
                key={i}
                className={
                  i === active ? "current" : i < active ? "completed" : "locked"
                }
              >
                {i > active ? (
                  <LockKeyhole size={19} />
                ) : (
                  <span className="passport-stage-label">
                    {i === active
                      ? "The Road to BAL"
                      : copy("اكتملت", "Completed")}
                  </span>
                )}
                <b>{String(i + 1).padStart(2, "0")}</b>
                <h3>{label}</h3>
                <small>
                  {i === active
                    ? copy("الآن", "Now")
                    : i < active
                      ? copy("اكتملت", "Completed")
                      : copy("بانتظار التأهل", "Awaiting qualification")}
                </small>
              </article>
            ))}
          </div>
        </section>
        <div className="passport-panels">
          <section className="passport-panel">
            <header>
              <CalendarDays size={21} />
              <div>
                <h3>{copy("مواعيد المباريات", "Match schedule")}</h3>
                <small>{tr("المباريات")}</small>
              </div>
            </header>
            {matches.length ? (
              <div className="passport-fixtures">
                {matches.map((g) => (
                  <ClubMatchLine
                    key={g.id}
                    game={g}
                    team={team}
                    opponents={data.teams}
                    now={now}
                  />
                ))}
              </div>
            ) : (
              <p className="passport-empty">
                <Clock size={19} />
                {copy(
                  "لم يُعتمد جدول مباريات الفريق بعد.",
                  "The team’s fixture schedule is not yet approved.",
                )}
              </p>
            )}
          </section>
          <section className="passport-panel passport-performance">
            <header>
              <ChartNoAxesColumn size={21} />
              <div>
                <h3>{copy("إحصائيات الفريق", "Team performance")}</h3>
                <small>{copy("تقييم أداء الفريق", "Team performance")}</small>
              </div>
            </header>
            <div className="passport-metrics">
              {[
                [record?.p ? (record.pf / record.p).toFixed(1) : "—", "PTS"],
                [average("rebounds"), "REB"],
                [average("assists"), "AST"],
                ["—", "3PM"],
              ].map(([value, label]) => (
                <div key={label}>
                  <b>{value}</b>
                  <small>{label}</small>
                </div>
              ))}
            </div>
            <p className="passport-muted">
              {copy(
                "تُعرض المتوسطات من المباريات المكتملة والبيانات المعتمدة المتاحة.",
                "Averages use completed games and available approved records.",
              )}
            </p>
          </section>
          <section className="passport-panel passport-roster-panel">
            <header>
              <Users size={21} />
              <div>
                <h3>{copy("أعضاء الفريق", "Team members")}</h3>
                <small>{copy("القائمة الرسمية", "Official roster")}</small>
              </div>
            </header>
            {roster.length ? (
              <div className="passport-roster">
                {roster.map((p) => (
                  <Link key={p.id} href={`/players/${p.id}`} className="passport-player-card">
                    <div className="passport-player-photo">
                      {p.photo ? (
                        <img src={p.photo} alt={playerName(p, lang)} loading="lazy" />
                      ) : (
                        <svg className="passport-player-blank" viewBox="0 0 80 100" aria-hidden="true">
                          <circle cx="40" cy="34" r="17" />
                          <path d="M6 100c0-24 15-38 34-38s34 14 34 38z" />
                        </svg>
                      )}
                      <span className="passport-player-number">#{p.number}</span>
                    </div>
                    <div className="passport-player-info">
                      <b>{playerName(p, lang)}</b>
                      {p.position && <small>{positionLabel(p.position, lang)}</small>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="passport-empty">
                <Users size={19} />
                {copy(
                  "تظهر قائمة اللاعبين فور اعتمادها رسميًا.",
                  "The roster will appear once officially approved.",
                )}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
