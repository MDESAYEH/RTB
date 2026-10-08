import Link from "next/link";
import type { ClubProfile } from "@/lib/club-profile";
import {
  clubFeature,
  clubPresentation,
  supportingHonours,
} from "@/lib/club-presentation";
import { ClubRoadMark, ClubCourt } from "./club-road-primitives";
import { useLang } from "./i18n";
export function EditorialClubProfile({ profile: p }: { profile: ClubProfile }) {
  const { lang, tr } = useLang();
  const f = clubFeature(p),
    mode = clubPresentation(p),
    honours = supportingHonours(p);
  const bal = p.continentalHonours.find((h) => h.title === "BAL — 3RD PLACE");
  const lastResult = bal
    ? p.history.match(/الفوز على (.*?) (\d+[–-]\d+)/)
    : null;
  const journey = p.continentalJourney;
  const narrative = [p.bioLong, p.history].filter(
    (text, i, all) => text && all.indexOf(text) === i,
  );
  const movement = journey.length > 0 && !bal;
  return (
    <div className="club-profile-content" data-profile={mode} data-club={p.id}>
      <div className="editorial-club-opening">
        <div className="club-opening-meta">
          <Link href="/teams">
            {tr("الفرق")} / {lang === "ar" ? p.arabicName : p.displayName}
          </Link>
          <span dir="ltr">TRIPOLI 2027 · GROUP {p.group}</span>
        </div>
        <ClubCourt kind="arc" />
        <div className="club-name-block" dir="ltr">
          <span className="club-country">
            <b>{p.countryCode}</b>{" "}
            {[p.country, p.city].filter(Boolean).join(" / ").toUpperCase()}
          </span>
          <h1>
            {p.displayName.split(" ").map((word, i) => (
              <span key={i}>{word}</span>
            ))}
          </h1>
        </div>
        <div className="club-crest-block">
          <ClubRoadMark id={p.id} name={p.displayName} fallback={p.shortName} />
          <div className="club-crest-coordinate" dir="ltr">
            <span>GROUP {p.group}</span>
            {p.foundedYear && <span>EST. {p.foundedYear}</span>}
          </div>
        </div>
        <div className="club-arabic-statement">
          <h2>{p.arabicName}</h2>
          <p>{p.bioShort}</p>
        </div>
        <span className="club-date-outline" dir="ltr" aria-hidden="true">
          21—25
        </span>
        <span className="club-opening-event" dir="ltr">
          ROAD TO BAL / TRIPOLI 2027
        </span>
        <a
          className="club-opening-next"
          href={f ? "#club-feature" : "#club-tournament"}
        >
          {f ? tr("إرث على أرض الملعب") : tr("من هنا يبدأ الطريق")}
          <span aria-hidden="true">↓</span>
        </a>
      </div>
      {f && (
        <section
          className="club-podium"
          id="club-feature"
          data-feature={
            bal
              ? "podium"
              : movement
                ? "journey"
                : p.domesticHonours.some(
                      (h) => h.title === "LEAGUE + CUP DOUBLE",
                    )
                  ? "double"
                  : "champion"
          }
          aria-label={tr("أبرز الإنجازات")}
        >
          <div className="podium-number" dir="ltr">
            <strong data-year={/^\d{4}$/.test(f.number) || undefined}>
              {f.number.endsWith("×") ? (
                <>
                  {f.number.slice(0, -1)}
                  <span className="club-number-times">×</span>
                </>
              ) : (
                f.number
              )}
            </strong>
            <span>{f.context}</span>
          </div>
          <div className="podium-caption">
            <span dir="ltr">ON THE RECORD</span>
            <h2 dir="ltr">
              {f.title !== f.number && (
                <>
                  {f.title}
                  <br />
                </>
              )}
              <em>{f.subtitle}</em>
            </h2>
            {lastResult ? (
              <div className="club-feature-score" dir="ltr">
                <span>{p.displayName}</span>
                <strong>{lastResult[2]}</strong>
                <span>{lastResult[1]}</span>
              </div>
            ) : (
              f.detail && <p>{f.detail}</p>
            )}
          </div>
          {movement && (
            <div className="club-feature-route" dir="ltr">
              <span>{p.country.toUpperCase()}</span>
              <b aria-hidden="true">→</b>
              <span>{journey[0].competition.toUpperCase()}</span>
              <b aria-hidden="true">→</b>
              <span>
                {journey[journey.length - 1].competition === "BAL"
                  ? "BAL"
                  : journey[journey.length - 1].achievement.toUpperCase()}
              </span>
            </div>
          )}
          <ClubCourt kind="arc" />
        </section>
      )}
      {narrative.length > 0 && (
        <section className="club-editorial-story">
          <div className="club-story-heading">
            <span className="eyebrow" dir="ltr">
              THE CLUB / THE LEGACY
            </span>
            <h2>
              {p.arabicName}
              <span>{p.country}</span>
            </h2>
          </div>
          <div className="club-story-copy">
            {narrative.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
            {mode === "MEDIUM" && honours.length > 0 && (
              <div
                className="club-inline-honours"
                aria-label={tr("الإنجازات المحلية")}
              >
                <span className="eyebrow" dir="ltr">
                  DOMESTIC ACHIEVEMENTS
                </span>
                {honours.map((h, i) => (
                  <div key={i} dir="ltr">
                    {h.displayNumber && <strong>{h.displayNumber}</strong>}
                    <span>{h.title}</span>
                    {h.note && <small dir="rtl">{h.note}</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      {mode === "RICH" && p.domesticHonours.length > 0 && (
        <section className="club-trophy-wall">
          <div className="club-section-label">
            <span dir="ltr">DOMESTIC HONOURS</span>
            <h2>{tr("أرقام صنعت الإرث.")}</h2>
          </div>
          <div className="club-trophy-totals">
            {p.domesticHonours.map((h, i) => (
              <div key={i}>
                {(h.count || h.year) && (
                  <strong dir="ltr">{h.count ? `${h.count}×` : h.year}</strong>
                )}
                <span dir="ltr">{h.title}</span>
                {h.note && <small>{h.note}</small>}
              </div>
            ))}
          </div>
          <div className="continental-honours-line">
            {p.continentalHonours.map((h, i) => (
              <span key={i} dir="ltr">
                <b>{h.year}</b> {h.title}
              </span>
            ))}
          </div>
        </section>
      )}
      {journey.length > 0 && (
        <section className="club-african-journey">
          <div className="club-section-label">
            <span dir="ltr">THE AFRICAN JOURNEY</span>
            <h2>{tr("فصول على الطريق الأفريقي.")}</h2>
          </div>
          <div className="club-journey-row">
            {journey.map((j, i) => (
              <div key={i}>
                <span dir="ltr">{j.year}</span>
                <div>
                  <strong dir="ltr">{j.competition}</strong>
                  <p dir="ltr">{j.achievement}</p>
                  {j.note && <small>{j.note}</small>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <details className="editorial-sources club-source-footer">
        <summary>{tr("المصادر وتوثيق المعلومات")}</summary>
        {p.sources
          .filter((s) => s.verificationStatus === "VERIFIED")
          .map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.title} ↗
            </a>
          ))}
      </details>
    </div>
  );
}
