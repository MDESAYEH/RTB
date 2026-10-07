import Link from "next/link";
import type { Team, Game } from "@/lib/public-domain";
import { remainingClock } from "@/lib/public-domain";
import { getTeamIdentity, teamProfileHref } from "@/lib/team-identity";
import { ClubCourt, ClubRoadMark } from "./club-road-primitives";

export function ClubMatchLine({
  game: g,
  team,
  opponents,
}: {
  game: Game;
  team: Team;
  opponents: Team[];
}) {
  const opponent = opponents.find(
    (t) => t.id === (g.home === team.id ? g.away : g.home),
  );
  const opponentIdentity = getTeamIdentity(opponent?.id || "");
  const own = g.home === team.id ? g.homeScore : g.awayScore;
  const other = g.home === team.id ? g.awayScore : g.homeScore;
  const live = g.status === "Live" || g.status === "Halftime";
  const final = g.status === "Ended";
  const date = new Date(g.date);
  const clock = remainingClock(g);
  return (
    <article
      className="club-match-line"
      data-state={live ? "live" : final ? "final" : "upcoming"}
    >
      <div className="club-match-date">
        <span>
          {date.toLocaleDateString("ar-LY", {
            day: "numeric",
            month: "short",
            timeZone: "Africa/Tripoli",
          })}
        </span>
        <small>
          {g.status === "Cancelled"
            ? "ألغيت"
            : g.status === "Postponed"
              ? "مؤجلة"
              : live
                ? `مباشر · Q${g.quarter} · ${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`
                : final
                  ? "النتيجة النهائية"
                  : "قادمة"}
        </small>
      </div>
      <Link
        className="club-match-opponent"
        href={
          opponentIdentity
            ? teamProfileHref(opponentIdentity)
            : opponent
              ? `/teams/${encodeURIComponent(opponent.id)}`
              : "/teams"
        }
      >
        <ClubRoadMark id={opponent?.id || ""} name={opponent?.name || ""} />
        <span>{opponent?.name}</span>
      </Link>
      <Link
        className="club-match-result"
        href={"/matches/" + g.id}
        dir="ltr"
        aria-label={`مركز مباراة ${team.name} و${opponent?.name}`}
      >
        <strong>
          {live || final
            ? `${own} — ${other}`
            : date.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Tripoli",
              })}
        </strong>
        <small>
          {final
            ? own > other
              ? team.name
              : own < other
                ? opponent?.name
                : "النتيجة المعتمدة"
            : "GAME CENTER ↗"}
        </small>
      </Link>
    </article>
  );
}
export function StadeTournamentHub({
  team,
  opponents,
  matches,
  roster,
  record,
  status,
}: {
  team: Team;
  opponents: Team[];
  matches: Game[];
  roster: { id: string; name: string; number: number; position: string }[];
  record: {
    p: number;
    w: number;
    l: number;
    pf: number;
    pa: number;
    diff: number;
  };
  status: string;
}) {
  return (
    <section id="club-tournament" className="stade-tournament-hub">
      <div className="club-group-scene">
        <div className="hub-heading">
          <div>
            <span dir="ltr">ROAD TO BAL / THE DRAW</span>
            <h2 dir="ltr">
              GROUP <em>{team.group}</em>
            </h2>
            <p>
              على أرض واحدة.
              <br />
              من أجل الطريق نفسه.
            </p>
          </div>
          <Link href={"/standings?group=" + team.group}>
            تابع المجموعة {team.group} ↗
          </Link>
        </div>
        <ClubCourt />
        <div className="hub-opponents">
          {[team, ...opponents].map((t) => (
            <Link
              className={
                t.id === team.id ? "hub-club current-club" : "hub-club"
              }
              data-team={t.id}
              key={t.id}
              href={
                getTeamIdentity(t.id)
                  ? teamProfileHref(getTeamIdentity(t.id)!)
                  : `/teams/${encodeURIComponent(t.id)}`
              }
            >
              <span className="hub-logo-frame">
                <ClubRoadMark id={t.id} name={t.name} />
              </span>
              <strong dir="ltr">{t.name}</strong>
              <small>
                {getTeamIdentity(t.id)?.countryCode} / {t.country}
              </small>
              {t.id === team.id && (
                <span className="hub-anchor-label">
                  {team.id === "al-ittihad" ? "صاحب الأرض" : "على هذا الطريق"}
                </span>
              )}
            </Link>
          ))}
        </div>
        <span className="club-group-signature" dir="ltr">
          TRIPOLI · 21—25 OCTOBER 2026
        </span>
      </div>
      <div className="hub-body">
        <div className="hub-matches">
          <div className="hub-part-heading">
            <span dir="ltr">THE MATCH LINE</span>
            <h2>حان وقت المواجهة.</h2>
            <Link href="/matches">كل المباريات ↗</Link>
          </div>
          {matches.length ? (
            matches.map((g) => (
              <ClubMatchLine
                key={g.id}
                game={g}
                team={team}
                opponents={opponents}
              />
            ))
          ) : (
            <div className="hub-pregame">
              <span className="club-event-date" dir="ltr">
                21—25{" "}
                <small>
                  OCTOBER
                  <br />
                  2026
                </small>
              </span>
              <h3>بانتظار جدول المواجهات الرسمي.</h3>
              <p>
                ستظهر مواعيد مباريات {team.name} ونتائجها وحالاتها بعد اعتماد
                الجدول الرسمي.
              </p>
            </div>
          )}
        </div>
        <div className="hub-team-info">
          <div className="hub-roster">
            <h3>قائمة اللاعبين</h3>
            {roster.length ? (
              roster.map((p) => (
                <Link
                  key={p.id}
                  className="hub-player"
                  href={"/players/" + p.id}
                >
                  <span>
                    {p.number} · {p.name}
                  </span>
                  <small>{p.position}</small>
                </Link>
              ))
            ) : (
              <p>سيتم نشر القائمة الرسمية بعد اعتمادها</p>
            )}
          </div>
          <div className="hub-stats">
            <h3>إحصائيات البطولة</h3>
            {record.p ? (
              <div className="hub-real-record">
                <span>
                  المباريات <b>{record.p}</b>
                </span>
                <span>
                  فوز / خسارة{" "}
                  <b dir="ltr">
                    {record.w} / {record.l}
                  </b>
                </span>
                <span>
                  النقاط المسجلة <b>{record.pf}</b>
                </span>
                <span>
                  النقاط المستقبلة <b>{record.pa}</b>
                </span>
              </div>
            ) : (
              <p>تبدأ إحصائيات البطولة مع أول مباراة</p>
            )}
            {record.p > 0 && (
              <small>
                {status === "QUALIFIED"
                  ? "تأهل إلى Elite 16"
                  : status === "ELIMINATED"
                    ? "انتهت رحلة المجموعة"
                    : "في سباق التأهل"}
              </small>
            )}
          </div>
        </div>
      </div>
      <div className="stade-closing">
        <span dir="ltr">THE ROAD CONTINUES</span>
        <h2 dir="ltr">
          TRIPOLI <span aria-hidden="true">↘</span>
        </h2>
        <div className="club-next-stage" dir="ltr">
          ELITE 16 <small>THE NEXT STAGE</small>
        </div>
        <p>
          الملعب هو البداية.
          <br />
          والطريق يستمر.
        </p>
        <div className="club-closing-links">
          <Link href="/the-road">
            اكتشف THE ROAD <span aria-hidden="true">↗</span>
          </Link>
          <Link href={"/standings?group=" + team.group}>
            تابع المجموعة {team.group} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
