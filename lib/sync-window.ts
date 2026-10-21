import type { Game } from "./domain";

/** Seconds of lead before kickoff at which fast syncing starts. */
export const WINDOW_LEAD_MS = 10 * 60_000;
/** A match that FIBA never marks as ended stops counting as "in progress" after this long. */
export const WINDOW_MAX_MS = 3 * 60 * 60_000;
/** Outside match windows FIBA is asked for new data only this often. */
export const IDLE_SYNC_MS = 10 * 60_000;
/** Inside a match window the games page is read this often. */
export const FAST_SYNC_MS = 10_000;

/**
 * True while any match is being played or about to be: from ten minutes before kickoff until FIBA says it has ended
 * (or three hours after kickoff, whichever comes first). Matches the organisers score by hand do not count: the sync
 * leaves their status and score alone, so there is nothing to follow.
 */
export function syncWindowActive(
  games: Pick<Game, "date" | "status" | "manual">[],
  now: number = Date.now(),
): boolean {
  return games.some((g) => {
    if (g.manual || ["Ended", "Cancelled", "Postponed"].includes(g.status)) return false;
    const kickoff = Date.parse(g.date);
    return Number.isFinite(kickoff) && now >= kickoff - WINDOW_LEAD_MS && now <= kickoff + WINDOW_MAX_MS;
  });
}
