"use client";
import { useState } from "react";
import type { Game } from "@/lib/public-domain";
import "./official-match-details.css";

const metrics = [
  ["EFF", "الكفاءة", "Efficiency"],
  ["PTS", "النقاط", "Points"],
  ["REB", "المتابعات", "Rebounds"],
  ["AS", "التمريرات الحاسمة", "Assists"],
  ["BS", "الصدات", "Blocks"],
  ["ST", "الكرات المقطوعة", "Steals"],
] as const;
export function OfficialMatchDetails({
  game,
  english,
}: {
  game: Game;
  english: boolean;
}) {
  const [metric, setMetric] = useState<string>("EFF");
  const d = game.officialDetails;
  if (!d) return null;
  const text = (ar: string, en: string) => (english ? en : ar);
  const [home, away] = d.teams;
  const comparison = (key: string, ar: string, en: string, percent = false) => (
    <div className="official-comparison" key={key} dir="ltr">
      <strong>
        {home.stats[key] ?? "—"}
        {percent && home.stats[key] !== undefined ? "%" : ""}
      </strong>
      <span dir="auto">{text(ar, en)}</span>
      <strong>
        {away.stats[key] ?? "—"}
        {percent && away.stats[key] !== undefined ? "%" : ""}
      </strong>
      {typeof home.stats[key] === "number" &&
        typeof away.stats[key] === "number" && (
          <div className="official-bars" aria-hidden="true">
            <span>
              <i
                style={{
                  width: `${percent ? Math.min(100, Number(home.stats[key])) : (Number(home.stats[key]) / Math.max(1, Number(home.stats[key]) + Number(away.stats[key]))) * 100}%`,
                }}
              />
            </span>
            <span>
              <i
                style={{
                  width: `${percent ? Math.min(100, Number(away.stats[key])) : (Number(away.stats[key]) / Math.max(1, Number(home.stats[key]) + Number(away.stats[key]))) * 100}%`,
                }}
              />
            </span>
          </div>
        )}
    </div>
  );
  const maxLead = Math.max(
    5,
    ...d.scoreHistory.map((p) => Math.abs(p.home - p.away)),
  );
  const width = 720,
    height = 200;
  return (
    <div className="official-match-details">
      <section className="official-card official-tracker">
        <h2>{text("تتبّع التقدم", "Lead Tracker")}</h2>
        <div className="official-team-headings" dir="ltr">
          <strong>{home.name}</strong>
          <strong>{away.name}</strong>
        </div>
        {d.scoreHistory.length > 0 && (
          <svg
            viewBox={`0 0 ${width} ${height + 25}`}
            role="img"
            aria-label={text(
              "فارق النقاط خلال المباراة؛ الأزرق للفريق الأول والأحمر للثاني",
              "Score margin through the game; blue is the first team, red the second",
            )}
          >
            <line
              x1="0"
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="#c8d3d5"
            />
            {Array.from({ length: Math.max(4, game.quarter) }, (_, i) => (
              <g key={i}>
                <line
                  x1={(i * width) / Math.max(4, game.quarter)}
                  y1="0"
                  x2={(i * width) / Math.max(4, game.quarter)}
                  y2={height}
                  stroke="#e3e8e8"
                />
                <text
                  x={((i + 0.5) * width) / Math.max(4, game.quarter)}
                  y={height + 20}
                  textAnchor="middle"
                  fontSize="12"
                >
                  {i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
                </text>
              </g>
            ))}
            {d.scoreHistory.map((p, i) => {
              const q = p.period.startsWith("OT")
                ? 4 + Number(p.period.slice(2))
                : Number(p.period.slice(1));
              const [m, s] = p.time.split(":").map(Number);
              const duration = q > 4 ? 300 : 600;
              const x =
                ((q - 1 + (duration - m * 60 - s) / duration) * width) /
                Math.max(4, game.quarter);
              const margin = p.home - p.away;
              const h = (Math.abs(margin) / maxLead) * (height / 2 - 8);
              return (
                <rect
                  key={i}
                  x={x}
                  y={margin >= 0 ? height / 2 - h : height / 2}
                  width="4"
                  height={h}
                  fill={margin >= 0 ? "#263e82" : "#941e1b"}
                >
                  <title>{`${p.period} ${p.time} · ${p.home}–${p.away}`}</title>
                </rect>
              );
            })}
          </svg>
        )}
        {comparison("A_BL", "أكبر تقدم", "Biggest lead")}
        {comparison("A_BR", "أكبر سلسلة تسجيل", "Biggest scoring run")}
        {comparison("T_TL", "وقت التقدم", "Time leading")}
        <div className="official-summary">
          <span>
            {text("تغيّرات التقدم", "Lead changes")}{" "}
            <b>{d.leadChanges ?? "—"}</b>
          </span>
          <span>
            {text("مرات التعادل", "Times tied")} <b>{d.timesTied ?? "—"}</b>
          </span>
        </div>
      </section>
      <section className="official-card official-leader-card">
        <h2>{text("متصدرو المباراة", "Game Leaders")}</h2>
        <div
          className="official-tabs"
          role="tablist"
          aria-label={text("إحصائيات اللاعبين", "Player statistics")}
        >
          {metrics.map(([key, ar, en]) => (
            <button
              type="button"
              role="tab"
              aria-selected={metric === key}
              key={key}
              onClick={() => setMetric(key)}
            >
              {text(ar, en)}
            </button>
          ))}
        </div>
        <div className="official-leaders" dir="ltr">
          {d.teams.map((t, i) => {
            const leaders = t.players
              .filter((p) => p.stats[metric] !== undefined)
              .slice()
              .sort((a, b) => b.stats[metric] - a.stats[metric])
              .slice(0, 3);
            return (
              <div key={i}>
                <h3>{t.name}</h3>
                {leaders.map((p, rank) => (
                  <div className="official-player" key={p.id}>
                    <span className="official-player-name">
                      <small className="official-jersey">{p.number}</small>
                      <span>
                        {p.name}
                        <small>
                          {rank === 0
                            ? text("متصدر الفريق", "Team leader")
                            : `#${rank + 1}`}
                        </small>
                      </span>
                    </span>
                    <b>{p.stats[metric]}</b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <details>
          <summary>{text("إحصائيات جميع اللاعبين", "Full boxscore")}</summary>
          {d.teams.map((t, i) => (
            <div className="official-table-wrap" key={i}>
              <h3>{t.name}</h3>
              <table dir="ltr">
                <thead>
                  <tr>
                    <th>{text("اللاعب", "Player")}</th>
                    {metrics.map(([key, ar, en]) => (
                      <th key={key}>{text(ar, en)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.players.map((p) => (
                    <tr key={p.id}>
                      <th>
                        #{p.number} {p.name}
                      </th>
                      {metrics.map(([key]) => (
                        <td key={key}>{p.stats[key] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </details>
      </section>
      <section className="official-card official-stats-card">
        <h2>{text("إحصائيات المباراة", "Game Stats")}</h2>
        <div className="official-team-headings" dir="ltr">
          <strong>{home.name}</strong>
          <strong>{away.name}</strong>
        </div>
        {[
          ["FGP", "نسبة التصويب", "FG %"],
          ["FG2P", "الثنائيات", "2PT FG"],
          ["FG3P", "الثلاثيات", "3PT FG"],
          ["FTP", "الرميات الحرة", "FT"],
        ].map(([key, ar, en]) => comparison(key, ar, en, true))}
        {[
          ["REB", "المتابعات", "Rebounds"],
          ["AS", "التمريرات الحاسمة", "Assists"],
          ["TO", "فقدان الكرة", "Turnovers"],
          ["ST", "الكرات المقطوعة", "Steals"],
          ["BS", "الصدات", "Blocks"],
        ].map(([key, ar, en]) => comparison(key, ar, en))}
      </section>
      <section className="official-card official-info-card">
        <h2>{text("معلومات المباراة", "Game Information")}</h2>
        <p>{[d.country, d.city, game.venue].filter(Boolean).join(" · ")}</p>
        <p>
          {new Intl.DateTimeFormat(english ? "en-GB" : "ar-LY", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Tripoli",
          }).format(new Date(game.date))}{" "}
          · {text("بتوقيت طرابلس", "Tripoli time")} (GMT+2)
        </p>
        {d.referees.length > 0 && (
          <>
            <h3>{text("الحكام", "Referees")}</h3>
            {d.referees.map((p) => (
              <p key={p} dir="auto">
                {p}
              </p>
            ))}
          </>
        )}
        {d.commissioners.length > 0 && (
          <>
            <h3>
              {text(
                "المراقب / المندوب الفني",
                "Commissioner / Technical Delegate",
              )}
            </h3>
            {d.commissioners.map((p) => (
              <p key={p} dir="auto">
                {p}
              </p>
            ))}
          </>
        )}
        <a href={d.sourceUrl} target="_blank" rel="noreferrer">
          {text("المصدر: FIBA", "Source: FIBA")}
        </a>
        <p className="official-updated">
          {text("آخر تحديث مؤكد", "Last confirmed update")}:{" "}
          {new Intl.DateTimeFormat(english ? "en-GB" : "ar-LY", {
            timeStyle: "medium",
            timeZone: "Africa/Tripoli",
          }).format(new Date(d.receivedAt))}
        </p>
      </section>
    </div>
  );
}
