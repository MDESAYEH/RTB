import Image from "next/image";
import Link from "next/link";
import { useLang } from "./i18n";

const sponsors: {
  file: string;
  name: string;
  width: number;
  height: number;
  href?: string;
  caption?: string;
}[] = [
    { file: "Artboard 2-8.png", name: "FIBA Africa", width: 4500, height: 2387, href: "https://www.fiba.basketball/en/africa", caption: "باعتماد" },
  { file: "Artboard 3-8.png", name: "وزارة الرياضة", width: 1920, height: 1921, href: "https://mos.gov.ly", caption: "برعاية" },
  { file: "al-ittihad.svg", name: "نادي الاتحاد الليبي", width: 154, height: 213, href: "/teams/al-ittihad", caption: "باستضافة" },
];

export function EventSponsors() {
  const { tr } = useLang();
  return (
    <section className="event-sponsors" aria-label={tr("رعاة الحدث")}>
      <ul className="event-sponsors-logos">
        {sponsors.map((sponsor) => (
          <li key={sponsor.file}>
            {sponsor.caption && (
              <span className="sponsor-caption">{tr(sponsor.caption)}</span>
            )}
            {(() => {
              const logo = (
                <Image
                  src={`/${encodeURIComponent(sponsor.file)}${sponsor.name === "FIBA Africa" ? "?v=horizontal-20261012" : ""}`}
                  unoptimized={sponsor.name === "FIBA Africa"}
                  alt={tr(sponsor.name)}
                  width={sponsor.width}
                  height={sponsor.height}
                  sizes="(max-width: 600px) 130px, 180px"
                />
              );
              if (!sponsor.href) return logo;
              return sponsor.href.startsWith("/") ? (
                <Link href={sponsor.href} aria-label={tr(sponsor.name)}>
                  {logo}
                </Link>
              ) : (
                <a
                  href={sponsor.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={tr(sponsor.name)}
                >
                  {logo}
                </a>
              );
            })()}
          </li>
        ))}
      </ul>
    </section>
  );
}
