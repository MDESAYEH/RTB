import registry from "./team-identity.json";
export type TeamIdentity = (typeof registry.teams)[number];
/** Registered club identity never verifies historical facts. */
export function getTeamIdentity(idOrSlug: string): TeamIdentity | null {
  return (
    registry.teams.find(
      (team) => team.id === idOrSlug || team.slug === idOrSlug,
    ) ?? null
  );
}
export function teamProfileHref(team: TeamIdentity): string {
  return `/teams/${encodeURIComponent(team.slug)}`;
}
/** Existing registered assets are approved for display by the project owner. */
export function teamLogoAsset(idOrSlug: string): string | null {
  const team = getTeamIdentity(idOrSlug);
  return team?.logoAsset || null;
}
