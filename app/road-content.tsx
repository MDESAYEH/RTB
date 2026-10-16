"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowUpLeft, Lock, MapPin, Shield } from "lucide-react";
import type { Team } from "@/lib/public-domain";
import { useLang } from "./i18n";

type StepState = "COMPLETED" | "CURRENT" | "LOCKED" | "QUALIFIED";

export function RoadContent({
  teams,
  states,
  slots,
  qualified,
  badge,
}: {
  teams: Team[];
  states: StepState[];
  slots: number;
  qualified: string[];
  badge: (team: Team) => ReactNode;
}) {
  const { lang } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [selectedId, setSelectedId] = useState(
    teams.find((t) => t.id === "al-ittihad")?.id ?? teams[0]?.id,
  );
  const selected = teams.find((t) => t.id === selectedId) ?? teams[0];
  const stateLabel = (i: number) =>
    states[i] === "LOCKED"
      ? copy("مقفلة", "Locked")
      : states[i] === "CURRENT"
        ? copy("الآن", "Now")
        : copy("مكتملة", "Done");
  const nodes = [
    { n: "01", title: copy("الوصول إلى طرابلس", "Arrive in Tripoli"), at: "top" },
    { n: "02", title: copy("دور المجموعات", "Group stage"), at: "right" },
    { n: "03", title: copy("بطاقة Elite 16", "Elite 16 ticket"), at: "bottom-right" },
    { n: "04", title: copy("اختبار Elite 16", "Elite 16 test"), at: "bottom-left" },
    { n: "05", title: copy("الوصول إلى BAL", "Reach BAL"), at: "left" },
  ];
  const qualifiedTeams = teams.filter((t) => qualified.includes(t.id));
  return (
    <div className="road-design">
      <header className="road-banner">
        <small>{copy("نحو المجد", "Toward glory")}</small>
        <h1>{copy("من طرابلس إلى BAL", "From Tripoli to BAL")}</h1>
        <p>
          {copy(
            "خمس محطات تشرح ماذا يعني كل فوز، ومن يعبر إلى المرحلة التالية.",
            "Five stops explaining what every win means, and who moves on to the next stage.",
          )}
        </p>
      </header>
      <div className="road-body">
        <div className="road-intro">
          <small>{copy("الطريق إلى القمة", "The road to the top")}</small>
          <h2>
            {copy(
              "من صافرة البداية إلى منصة التتويج، لكل فريق حلم يسعى لتحقيقه.",
              "From the opening whistle to the podium, every team chases a dream.",
            )}
          </h2>
          <p>
            {copy(
              "رحلة من التحديات والمواجهات، حيث يتنافس الأبطال لكتابة فصل جديد في تاريخ كرة السلة الأفريقية.",
              "A journey of challenges and showdowns where champions compete to write a new chapter in African basketball history.",
            )}
          </p>
        </div>

        <div className="road-radar-frame">
        <section className="road-radar" dir="ltr">
          <div className="road-radar-top">
            <span className="road-live">
              <Activity size={14} aria-hidden="true" />
              {copy("المسار يتحدث تلقائياً", "Updates automatically")}
            </span>
            <b>THE ROAD RADAR / TRIPOLI 2027</b>
          </div>
          <div className="road-radar-main">
            <div className="road-radar-field">
              <div className="road-rings" aria-hidden="true">
                <i /> <i /> <i /> <i />
              </div>
              {nodes.map((node, i) => (
                <div
                  className={
                    "road-node at-" + node.at + " " + states[i].toLowerCase()
                  }
                  key={node.n}
                >
                  <span className="road-node-icon">
                    {states[i] === "LOCKED" ? (
                      <Lock size={16} aria-hidden="true" />
                    ) : (
                      <MapPin size={18} aria-hidden="true" />
                    )}
                  </span>
                  <span dir="auto">
                    <small>
                      {stateLabel(i)}{lang === "ar" ? "،" : ","} {node.n}
                    </small>
                    <b>{node.title}</b>
                  </span>
                </div>
              ))}
              {selected && (
                <div className="road-center">
                  <span className="road-center-badge">{badge(selected)}</span>
                  <b>{selected.name}</b>
                  <small>GROUP {selected.group}</small>
                </div>
              )}
            </div>
            <aside className="road-reading" dir={lang === "ar" ? "rtl" : "ltr"}>
              <small>{copy("قراءة الرادار", "Radar reading")}</small>
              <h3>{copy("كل فوز يغيّر الإشارة", "Every win changes the signal")}</h3>
              <p>
                {copy(
                  "بدل قراءة جدول معقّد، الرادار يوضح فوراً أين يقف الفريق، والبوابة المفتوحة الآن، وما الذي يحتاجه للعبور.",
                  "Instead of reading a complex table, the radar shows where the team stands, which gate is open now, and what it needs to cross.",
                )}
              </p>
              <dl>
                <dt>{copy("الحالة الحالية", "Current status")}</dt>
                <dd>{copy("بوابة طرابلس مفتوحة", "The Tripoli gate is open")}</dd>
                <dt>{copy("شرط العبور", "To advance")}</dt>
                <dd>
                  {copy(
                    `إنهاء المجموعة ضمن أول ${slots}`,
                    `Finish the group in the top ${slots}`,
                  )}
                </dd>
              </dl>
              {selected && (
                <Link href={"/teams/" + selected.id}>
                  <ArrowUpLeft size={16} aria-hidden="true" />
                  {copy("افتح مركز قيادة الفريق", "Open the team command centre")}
                </Link>
              )}
            </aside>
          </div>
          <div className="road-team-tabs">
            {teams.map((t) => (
              <button
                type="button"
                key={t.id}
                className={t.id === selected?.id ? "is-active" : ""}
                onClick={() => setSelectedId(t.id)}
                aria-pressed={t.id === selected?.id}
              >
                {badge(t)}
                <b>{t.name}</b>
                <small>{t.country}</small>
              </button>
            ))}
          </div>
        </section>
        </div>

        <section className="road-qualified">
          <header>
            <h2>{copy("الأسماء تظهر هنا فور حسمها", "Names appear here once decided")}</h2>
            <b>{copy("المتأهلون", "Qualified")}</b>
          </header>
          <div className="road-qualified-box">
            {qualifiedTeams.length ? (
              <div className="road-qualified-list">
                {qualifiedTeams.map((t) => (
                  <Link href={"/teams/" + t.id} key={t.id}>
                    {badge(t)} {t.name} ✓
                  </Link>
                ))}
              </div>
            ) : (
              <>
                <Shield size={46} strokeWidth={1.4} aria-hidden="true" />
                <p>
                  {copy(
                    "لا توجد بيانات تأهل حتى الآن. تبدأ القائمة بالامتلاء تلقائياً مع اكتمال ترتيب المجموعات.",
                    "No qualification data yet. The list fills automatically as the group standings are completed.",
                  )}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
