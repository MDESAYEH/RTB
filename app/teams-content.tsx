"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import type { Team } from "@/lib/public-domain";
import { getTeamIdentity } from "@/lib/team-identity";
import { useLang } from "./i18n";

export function TeamsContent({
  teams,
  groups,
  badge,
}: {
  teams: Team[];
  groups: string[];
  badge: (team: Team) => ReactNode;
}) {
  const { lang, tr } = useLang();
  const copy = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const groupName = (g: string) =>
    copy(
      g === "A"
        ? "المجموعة الأولى"
        : g === "B"
          ? "المجموعة الثانية"
          : `المجموعة ${g}`,
      `Group ${g}`,
    );
  return (
    <div className="teams-design">
      <header className="match-banner">
        <small>
          {teams.length} {copy("أندية", "clubs")} · {groups.length}{" "}
          {copy("مجموعات", "groups")}
        </small>
        <h1>{copy("الفرق والمجموعات", "Teams & groups")}</h1>
        <p>
          {copy(
            "ملفات الأندية، المباريات، والرحلة داخل البطولة.",
            "Club profiles, fixtures and their tournament journey.",
          )}
        </p>
      </header>
      <div className="teams-directory">
        <div className="teams-directory-intro">
          <small>{copy("صنّاع التحدي", "The challengers")}</small>
          <h2>
            {copy(
              "فرق أفريقية، وطموح واحد. اكتشف المجموعات والأندية التي تتنافس على القمة.",
              "African clubs, one ambition. Discover the groups and teams competing for the top.",
            )}
          </h2>
        </div>
        {groups.map((g) => {
          const clubs = teams.filter((t) => t.group === g);
          return (
            <section
              key={g}
              className={`teams-directory-group directory-group-${g.toLowerCase()}`}
              aria-label={groupName(g)}
            >
              <header>
                <div>
                  <h2 dir="ltr">GROUP {g}</h2>
                  <small>
                    {groupName(g)} · {clubs.length} {copy("فرق", "teams")}
                  </small>
                </div>
                <b>{g}</b>
              </header>
              <div className="teams-directory-grid">
                {clubs.map((t) => (
                  <Link
                    className="directory-club"
                    key={t.id}
                    href={`/teams/${t.id}`}
                  >
                    <div className="directory-club-logo">{badge(t)}</div>
                    <div className="directory-club-info">
                      <h3 dir="auto">{t.name}</h3>
                      <p>
                        {lang === "ar" && getTeamIdentity(t.id)?.arabicName
                          ? `${getTeamIdentity(t.id)!.arabicName} · `
                          : ""}
                        {lang === "ar" && getTeamIdentity(t.id)?.countryCode
                          ? new Intl.DisplayNames(["ar"], {type: "region"}).of(getTeamIdentity(t.id)!.countryCode)
                          : tr(t.country)}
                      </p>
                      <span>
                        {copy("عرض التفاصيل", "View profile")}
                        <ArrowUpLeft size={15} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              {!clubs.length && (
                <p className="directory-no-clubs">
                  {copy(
                    "تُعرض الأندية هنا فور اعتماد بيانات المجموعة.",
                    "Clubs will appear once group data is confirmed.",
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
