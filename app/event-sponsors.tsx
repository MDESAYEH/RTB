import Image from "next/image";
import Link from "next/link";

const sponsors: {
  file: string;
  name: string;
  width: number;
  height: number;
  href?: string;
}[] = [
  { file: "Artboard 2-8.png", name: "FIBA Africa", width: 875, height: 1800, href: "https://www.fiba.basketball/en/africa" },
  { file: "Artboard 3-8.png", name: "وزارة الرياضة", width: 1920, height: 1921, href: "https://mos.gov.ly" },
  { file: "al-ittihad.svg", name: "نادي الاتحاد الليبي", width: 154, height: 213, href: "/teams/al-ittihad" },
];

export function EventSponsors() {
  return (
    <section className="event-sponsors" aria-label="رعاة الحدث">
      <ul className="event-sponsors-logos">
        {sponsors.map((sponsor) => (
          <li key={sponsor.file}>
            {(() => {
              const logo = (
                <Image
                  src={`/${encodeURIComponent(sponsor.file)}`}
                  alt={sponsor.name}
                  width={sponsor.width}
                  height={sponsor.height}
                  sizes="(max-width: 600px) 130px, 180px"
                />
              );
              if (!sponsor.href) return logo;
              return sponsor.href.startsWith("/") ? (
                <Link href={sponsor.href} aria-label={sponsor.name}>
                  {logo}
                </Link>
              ) : (
                <a
                  href={sponsor.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={sponsor.name}
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
