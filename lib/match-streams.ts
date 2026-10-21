/**
 * The live broadcast of every Tripoli match: FIBA's YouTube channel (playlist "Africa Champions Clubs ROAD TO B.A.L. 2027").
 * A match is found by the two clubs, whichever side is home, so the links survive FIBA changing a game's id or kickoff.
 */
export const MATCH_STREAMS: { teams: [string, string]; day: number; time: string; url: string }[] = [
  { teams: ["spintex-knights", "nabaya-sofas"], day: 21, time: "11:00", url: "https://www.youtube.com/watch?v=J-m9k12cC_8" },
  { teams: ["npa-pythons", "energie-bc"], day: 21, time: "13:30", url: "https://www.youtube.com/watch?v=hvSPTRtHqLw" },
  { teams: ["kriol-star", "stade-malien"], day: 21, time: "16:00", url: "https://www.youtube.com/watch?v=n3IF1jon_0g" },
  { teams: ["al-ittihad", "nb-staoueli"], day: 21, time: "18:30", url: "https://www.youtube.com/watch?v=JY_p9F0R8RE" },
  { teams: ["spintex-knights", "npa-pythons"], day: 22, time: "11:00", url: "https://www.youtube.com/watch?v=-A8nYkfM7Sk" },
  { teams: ["energie-bc", "nabaya-sofas"], day: 22, time: "13:30", url: "https://www.youtube.com/watch?v=wPLj_S-OFro" },
  { teams: ["stade-malien", "nb-staoueli"], day: 22, time: "16:00", url: "https://www.youtube.com/watch?v=M3PFd0izzPQ" },
  { teams: ["al-ittihad", "kriol-star"], day: 22, time: "18:30", url: "https://www.youtube.com/watch?v=QuK6s3j4ZFs" },
  { teams: ["nabaya-sofas", "npa-pythons"], day: 23, time: "11:00", url: "https://www.youtube.com/watch?v=KqiY2Tlk7zw" },
  { teams: ["energie-bc", "spintex-knights"], day: 23, time: "13:30", url: "https://www.youtube.com/watch?v=OMDGjCW7Vvk" },
  { teams: ["nb-staoueli", "kriol-star"], day: 23, time: "16:00", url: "https://www.youtube.com/watch?v=wD98fvmHPgI" },
  { teams: ["stade-malien", "al-ittihad"], day: 23, time: "18:30", url: "https://www.youtube.com/watch?v=WwcA-TBfyx8" },
];

export function streamForTeams(a: string, b: string): string | undefined {
  const key = [a, b].sort().join("|");
  return MATCH_STREAMS.find((m) => [...m.teams].sort().join("|") === key)?.url;
}
