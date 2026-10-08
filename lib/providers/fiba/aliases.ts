/**
 * Explicit, human-reviewed links between a FIBA team slug and a local team id.
 * Nothing here is inferred. Example of an entry once reviewed:
 *   "nadi-basket-staoueli": "nb-staoueli"
 * Until an entry exists, a FIBA team that does not match the local registry by slug
 * or exact name is reported for review and is never merged or created.
 */
export const fibaTeamAliases: Record<string, string> = {};

/**
 * FIBA slugs approved to be created as brand-new local teams when they are not in the
 * local registry (e.g. a team FIBA assigns to a currently unassigned slot).
 */
export const fibaApprovedNewTeams: string[] = [];
