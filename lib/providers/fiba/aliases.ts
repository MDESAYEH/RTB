/**
 * Explicit, human-reviewed links between a FIBA team slug and a local team id.
 * Nothing here is inferred. Until an entry exists, a FIBA team that does not match the local registry by slug
 * or exact name is reported for review and is never merged or created.
 */
export const fibaTeamAliases: Record<string, string> = {
  // Reviewed 2026-10-08. Evidence: FIBA lists "Nadi Basket Staoueli" (code NBS) in Division West group A,
  // the group whose other four clubs are exactly the local group A; the local group A has no other
  // unmatched club; FIBA's own announcement names the Algerian club "Nadi Staouedi" (see DATA_SOURCES.md).
  // The local record keeps verified=false until the club's preferred spelling is confirmed.
  "nadi-basket-staoueli": "nb-staoueli",
};

/**
 * FIBA slugs approved to be created as brand-new local teams when they are not in the
 * local registry (e.g. a team FIBA assigns to a currently unassigned slot).
 */
export const fibaApprovedNewTeams: string[] = [];
