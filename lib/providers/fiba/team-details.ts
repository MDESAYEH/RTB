import { z } from "zod";
import { boundedBody } from "../../request";
import {
  extractPayload,
  jsonValuesFor,
  type FibaEventData,
  type FibaTeam,
} from "./parser";
import { FIBA_EVENT_SLUG, type FetchLike } from "./client";
const profileSchema = z.object({
  teamId: z.number().int(),
  countryName: z.string().min(1),
});
const rosterMemberSchema = z.object({
  personId: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  uniformNumber: z.string(),
  position: z.string().nullable(),
  isOnFinalRoster: z.boolean(),
  clubId: z.number().int().positive(),
});
export type OfficialRosterMember = z.infer<typeof rosterMemberSchema>;
export function parseOfficialProfile(html: string, teamId: number) {
  const profiles = jsonValuesFor(extractPayload(html), "profile", "{");
  for (const raw of profiles) {
    const parsed = profileSchema.safeParse(raw);
    if (parsed.success && parsed.data.teamId === teamId) return parsed.data;
  }
  throw Error(`Official team profile missing for ${teamId}`);
}
/** The official team page is the source for its published tournament roster. */
export function parseOfficialRoster(html: string, team: FibaTeam) {
  const arrays = jsonValuesFor(extractPayload(html), "players", "[")
    .filter(Array.isArray)
    .map((rows) => z.array(rosterMemberSchema).safeParse(rows))
    .filter((result): result is { success: true; data: OfficialRosterMember[] } =>
      result.success,
    )
    .map((result) => result.data);
  const roster = arrays
    .map((rows) =>
      rows.filter(
        (player) =>
          player.clubId === team.organisationId && player.isOnFinalRoster,
      ),
    )
    .find((rows) => rows.length > 0);
  // A participating club can have a team page before FIBA publishes its roster.
  // Keep the rest of the official team sync usable and wait for a later roster.
  return roster ?? [];
}
export async function enrichOfficialTeams(
  event: FibaEventData,
  scopedIds: Set<number>,
  fetchImpl: FetchLike = fetch,
): Promise<Map<number, OfficialRosterMember[]>> {
  const teams = event.teams.filter((t) => scopedIds.has(t.teamId));
  const rosters = new Map<number, OfficialRosterMember[]>();
  for (let i = 0; i < teams.length; i += 4)
    await Promise.all(
      teams.slice(i, i + 4).map(async (t) => {
        const url = `https://www.fiba.basketball/en/events/${FIBA_EVENT_SLUG}/teams/${t.slug}`;
        const r = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
        if (
          !r.ok ||
          !(r.headers.get("content-type") || "").includes("text/html") ||
          (r.url &&
            !r.url.startsWith(
              `https://www.fiba.basketball/en/events/${FIBA_EVENT_SLUG}/teams/`,
            ))
        )
          throw Error(`Official team fetch failed: ${t.slug}`);
        const html = new TextDecoder().decode(
          await boundedBody(r, 5 * 1024 * 1024),
        );
        const profile = parseOfficialProfile(html, t.teamId);
        t.countryName = profile.countryName;
        // FIBA's public team pages use this organisation-specific logo with their own fallback.
        t.sourceLogo = `https://assets.fiba.basketball/image/upload/d_.logoflag--light--organisation_${t.organisationId}.webp/w_400/f_auto/q_auto/.logoflag--light--organisation_${t.organisationId}--competition_${event.competition.competitionId}`;
        const roster = parseOfficialRoster(html, t);
        if (roster.length) rosters.set(t.teamId, roster);
      }),
    );
  return rosters;
}
