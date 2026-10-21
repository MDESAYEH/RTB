"use client";
import Image from "next/image";
import { ArrowUpFromLine, Hand, HandHelping, Shield, Target, Trophy } from "lucide-react";
import { useLang } from "./i18n";

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

const categories = [
  { key: "points", code: "PTS", icon: Target, ar: "النقاط", en: "Points" },
  { key: "scorer", code: "TOP", icon: Trophy, ar: "الهداف", en: "Top scorer" },
  { key: "rebounds", code: "REB", icon: ArrowUpFromLine, ar: "المتابعات", en: "Rebounds" },
  { key: "assists", code: "AST", icon: HandHelping, ar: "التمريرات", en: "Assists" },
  { key: "steals", code: "STL", icon: Hand, ar: "السرقات", en: "Steals" },
  { key: "blocks", code: "BLK", icon: Shield, ar: "الصدات", en: "Blocks" },
] as const;

/** Season-average leader for one category, or null while nothing is approved. */
function leader(stats: Stat[], players: Player[], key: (typeof categories)[number]["key"]) {
  const scorer = key === "scorer";
  const field = scorer ? "points" : key;
  const ranked = players
    .map((p) => ({ p, rows: stats.filter((s) => s.player === p.id) }))
    .filter((v) => v.rows.length)
    .map((v) => ({ ...v, average: v.rows.reduce((n, r) => n + r[field], 0) / (scorer ? 1 : v.rows.length) }))
    .sort((a, b) => b.average - a.average);
  return ranked[0] ?? null;
}

const scorer = (key: string) => key === "scorer";

export function StatsContent({ stats, players }: { stats: Stat[]; players: Player[] }) {
  const { lang, tr } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return (
    <div className="stats-design">
      <section className="stats-banner">
        <small>{copy("بيانات البطولة", "Tournament data")}</small>
        <h1>{tr("الإحصائيات")}</h1>
        <p>
          {copy(
            "قادة البطولة وأرقام الفرق — تُحدّث من النتائج المعتمدة.",
            "Tournament leaders and team numbers, updated from approved results.",
          )}
        </p>
      </section>
      <div className="stats-body">
        <div className="stats-intro">
          <small>{copy("أرقام تصنع التاريخ", "Numbers that make history")}</small>
          <h2>{copy("الأرقام تروي حكاية المجد", "The numbers tell the story of glory")}</h2>
          <p>
            {copy(
              "من قلب طرابلس، تُكتب فصول جديدة من تاريخ كرة السلة الأفريقية. اكتشف بالأرقام حجم المنافسة، وقوة الحضور، ولحظات تصنع مجد البطولة.",
              "From the heart of Tripoli, new chapters of African basketball history are written. Discover the scale of the competition, the strength of the crowd and the moments that make the tournament's glory.",
            )}
          </p>
        </div>
        <div className="stat-cards">
          {categories.map(({ key, code, icon: Icon, ar, en }) => {
            const top = leader(stats, players, key);
            const label = copy(ar, en);
            return (
              <article className={"stat-card" + (top ? "" : " is-pending")} key={key}>
                <header>
                  <b dir="ltr">{code}</b>
                  <span className="stat-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                </header>
                <div className="stat-card-body">
                  <div className="stat-card-text">
                    {top ? (
                      <>
                        <h3>
                          {top.p.name}
                        </h3>
                        <p>
                          {scorer(key) ? top.average : top.average.toFixed(1)} {scorer(key) ? copy("نقطة", "points") : label}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3>{copy("لم يتم الاعتماد بعد", "Not approved yet")}</h3>
                        <p>{label}</p>
                      </>
                    )}
                  </div>
                  <div className="stat-photo" aria-hidden={top?.p.photo ? undefined : true}>
                    {top?.p.photo ? (
                      <Image src={top.p.photo} alt={top.p.name} fill sizes="200px" />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
