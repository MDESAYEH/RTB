import Image from "next/image";
import { useLang } from "./i18n";
import { getTeamIdentity, teamLogoAsset } from "@/lib/team-identity";
/** Asset ownership does not verify club history. */
export function ClubRoadMark({
  id,
  name,
  fallback,
}: {
  id: string;
  name: string;
  fallback?: string;
}) {
  const { tr } = useLang();
  const identity = getTeamIdentity(id);
  const asset = teamLogoAsset(id);
  return asset ? (
    <Image
      className={
        id === "red-flames" ? "club-mark red-flames-mark" : "club-mark"
      }
      src={asset}
      alt={`${tr("شعار")} ${name}`}
      width={180}
      height={180}
      sizes="(max-width:767px) 120px, 180px"
    />
  ) : (
    <span className="club-initials" aria-label={name}>
      {identity?.fallback || fallback || name.slice(0, 2)}
    </span>
  );
}
export function ClubRoadLine() {
  return (
    <svg
      className="club-road-spine"
      viewBox="0 0 100 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M4 0 V290 Q4 300 14 300 H78 Q88 300 88 310 V450 Q88 460 78 460 H14 Q4 460 4 470 V1000" />
    </svg>
  );
}
export function ClubCourt({ kind = "center" }: { kind?: "center" | "arc" }) {
  return (
    <svg
      className={`club-court-geometry ${kind}`}
      viewBox="0 0 1000 600"
      aria-hidden="true"
    >
      {kind === "center" ? (
        <>
          <path d="M30 30H970V570H30ZM500 30V570M30 210H190V390H30M970 210H810V390H970" />
          <circle cx="500" cy="300" r="95" />
          <path d="M190 210A90 90 0 0 1 190 390M810 210A90 90 0 0 0 810 390M30 65C430 65 430 535 30 535M970 65C570 65 570 535 970 535" />
        </>
      ) : (
        <>
          <circle cx="500" cy="300" r="278" />
          <path d="M0 300H1000M500 0V600M300 300A200 200 0 0 0 700 300" />
        </>
      )}
    </svg>
  );
}
