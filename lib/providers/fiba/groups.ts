/**
 * The local draw, reviewed 2026-10-14 against FIBA's published Division West tables and fixtures.
 * Placement never follows FIBA's tables automatically (a late change on their side must not silently reshuffle
 * the groups); update this list deliberately when the organisers confirm a change.
 */
export const localGroups: Record<string, string> = {
  // Group A
  "nb-staoueli": "A",
  "kriol-star": "A",
  "al-ittihad": "A",
  "stade-malien": "A",
  // Group B
  "energie-bc": "B",
  "nabaya-sofas": "B",
  "spintex-knights": "B",
  "npa-pythons": "B",
};

/**
 * Clubs that withdrew after the draw (reviewed 2026-10-14: absent from every FIBA group table and fixture).
 * The sync removes their records, and any scheduled fixture they had, instead of moving them to another group.
 */
export const withdrawnTeams: string[] = ["as-douanes", "red-flames"];
