import type { ClubProfile } from "./club-profile";
/** Presentation selection from the already verified public projection, never tournament calculations. */
export function clubFeature(p: ClubProfile) {
  const bal = p.continentalHonours.find((h) => h.title === "BAL — 3RD PLACE");
  if (bal)
    return {
      title: `BAL ${bal.year}`,
      subtitle: "THIRD PLACE",
      number: "03",
      context: "THE PODIUM",
      detail: p.history,
    };
  const double = p.domesticHonours.find(
    (h) => h.title === "LEAGUE + CUP DOUBLE",
  );
  if (double)
    return {
      title: String(double.year),
      subtitle: "ALGERIAN DOUBLE",
      number: String(double.year),
      context: double.title,
      detail: double.note || p.bioShort,
    };
  const first = p.continentalHonours.find((h) => /FIRST/.test(h.title));
  if (first)
    return {
      title: first.title.includes("CAPE VERDE") ? "CAPE VERDE" : "ELITE 16",
      subtitle: first.title.includes("CAPE VERDE")
        ? "TRAILBLAZERS"
        : "GHANA’S FIRST",
      number: p.foundedYear ? String(p.foundedYear) : "16",
      context: first.title,
      detail: p.bioShort,
    };
  const honour = p.domesticHonours[0];
  if (honour)
    return {
      title: honour.count ? `${honour.count}×` : String(honour.year || ""),
      subtitle: honour.title,
      number: honour.count ? `${honour.count}×` : String(honour.year || ""),
      context: "DOMESTIC ACHIEVEMENT",
      detail: p.recentAchievements[0]?.description || p.bioShort,
    };
  return null;
}

export function clubPresentation(p: ClubProfile): "RICH" | "MEDIUM" | "LIGHT" {
  if (
    !p.bioLong &&
    !p.history &&
    !p.domesticHonours.length &&
    !p.continentalJourney.length &&
    !p.continentalHonours.length
  )
    return "LIGHT";
  return p.domesticHonours.length >= 2 && p.continentalHonours.length >= 3
    ? "RICH"
    : "MEDIUM";
}
export function supportingHonours(p: ClubProfile) {
  const feature = clubFeature(p);
  return p.domesticHonours.map((h) => ({
    ...h,
    displayNumber:
      h.count && feature?.number !== `${h.count}×`
        ? `${h.count}×`
        : h.year
          ? String(h.year)
          : undefined,
  }));
}
