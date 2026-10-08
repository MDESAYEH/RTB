import Image from "next/image";

const sponsors = [
  { file: "Artboard 2-8.png", name: "FIBA Africa", width: 875, height: 1800 },
  { file: "Artboard 3-8.png", name: "وزارة الرياضة", width: 1920, height: 1921 },
  { file: "al-ittihad.svg", name: "نادي الاتحاد الليبي", width: 154, height: 161 },
];

export function EventSponsors() {
  return (
    <section className="event-sponsors" aria-label="رعاة الحدث">
      <ul className="event-sponsors-logos">
        {sponsors.map((sponsor) => (
          <li key={sponsor.file}>
            <Image
              src={`/${encodeURIComponent(sponsor.file)}`}
              alt={sponsor.name}
              width={sponsor.width}
              height={sponsor.height}
              sizes="(max-width: 600px) 130px, 180px"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
