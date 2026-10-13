import { z } from "zod";
import { boundedBody } from "../../request";
import { extractPayload, jsonValuesFor, type FibaEventData } from "./parser";
import { FIBA_EVENT_SLUG, type FetchLike } from "./client";
const profileSchema = z.object({
  teamId: z.number().int(),
  countryName: z.string().min(1),
});
export function parseOfficialProfile(html: string, teamId: number) {
  const profiles = jsonValuesFor(extractPayload(html), "profile", "{");
  for (const raw of profiles) {
    const parsed = profileSchema.safeParse(raw);
    if (parsed.success && parsed.data.teamId === teamId) return parsed.data;
  }
  throw Error(`Official team profile missing for ${teamId}`);
}
export async function enrichOfficialTeams(
  event: FibaEventData,
  scopedIds: Set<number>,
  fetchImpl: FetchLike = fetch,
) {
  const teams = event.teams.filter((t) => scopedIds.has(t.teamId));
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
        const profile = parseOfficialProfile(
          new TextDecoder().decode(await boundedBody(r, 5 * 1024 * 1024)),
          t.teamId,
        );
        t.countryName = profile.countryName;
        // FIBA's public team pages use this organisation-specific logo with their own fallback.
        t.sourceLogo = `https://assets.fiba.basketball/image/upload/d_.logoflag--light--organisation_${t.organisationId}.webp/w_400/f_auto/q_auto/.logoflag--light--organisation_${t.organisationId}--competition_${event.competition.competitionId}`;
      }),
    );
}
