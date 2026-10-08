import * as cheerio from "cheerio";
import { z } from "zod";

/**
 * The public FIBA page is a Next.js app whose HTML embeds its own data in
 * `self.__next_f.push([1,"…"])` script chunks. We read only that embedded,
 * already-delivered payload. Anything unexpected fails closed.
 */
export class FibaParseError extends Error {}

const nullableString = z.string().nullable();
export const fibaTeamSchema = z.object({
  teamId: z.number().int(),
  organisationId: z.number().int(),
  slug: z.string().min(1),
  code: nullableString,
  officialName: z.string().min(1),
});
const fibaGameTeamSchema = z.object({
  teamId: z.number().int(),
  code: nullableString,
  officialName: z.string().min(1),
});
export const fibaGameSchema = z.object({
  gameId: z.number().int(),
  gameName: z.string(),
  statusCode: z.string().min(1),
  teamA: fibaGameTeamSchema,
  teamB: fibaGameTeamSchema,
  teamAScore: z.number().int(),
  teamBScore: z.number().int(),
  isLive: z.boolean(),
  isPostponed: z.boolean(),
  venueName: nullableString,
  gameDateTimeUTC: z.string(),
  hasTimeGameDateTime: z.boolean(),
  windowName: z.string(),
  groupPairingCode: nullableString,
});
const fibaCompetitionSchema = z.object({
  competitionId: z.number().int(),
  competitionCode: z.string().min(1),
  officialName: z.string().min(1),
  start: z.string(),
  end: z.string(),
  status: z.string(),
});

export type FibaTeam = z.infer<typeof fibaTeamSchema>;
export type FibaGame = z.infer<typeof fibaGameSchema>;
export type FibaCompetition = z.infer<typeof fibaCompetitionSchema>;
export type FibaEventData = {
  competition: FibaCompetition;
  currentPhase: string | null;
  teams: FibaTeam[];
  games: FibaGame[];
};

const CHUNK = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;

export function extractPayload(html: string): string {
  const $ = cheerio.load(html);
  let payload = "";
  $("script").each((_, el) => {
    const text = $(el).text();
    if (!text.includes("__next_f")) return;
    for (const match of text.matchAll(CHUNK)) {
      try {
        payload += JSON.parse(match[1]) as string;
      } catch {
        throw new FibaParseError("A data chunk in the page could not be decoded");
      }
    }
  });
  if (!payload) {
    throw new FibaParseError("No embedded data payload found; page structure changed");
  }
  return payload;
}

/** Slice the balanced JSON value that starts at `from` (a `[` or `{`). */
function sliceBalanced(text: string, from: number): string {
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  throw new FibaParseError("Unterminated JSON structure in page data");
}

function jsonValuesFor(text: string, key: string, open: "[" | "{"): unknown[] {
  const needle = `"${key}":${open}`;
  const found: unknown[] = [];
  let at = text.indexOf(needle);
  while (at >= 0) {
    const start = at + needle.length - 1;
    try {
      found.push(JSON.parse(sliceBalanced(text, start)));
    } catch (error) {
      if (error instanceof FibaParseError) throw error;
      throw new FibaParseError(`"${key}" in page data is not valid JSON`);
    }
    at = text.indexOf(needle, start + 1);
  }
  return found;
}

function parseAll<T extends z.ZodType>(
  schema: T,
  rows: unknown[],
  label: string,
): z.infer<T>[] {
  return rows.map((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new FibaParseError(
        `${label}[${index}] does not match the expected shape: ${result.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  });
}

function dedupe<T>(rows: T[], id: (row: T) => number): T[] {
  return [...new Map(rows.map((row) => [id(row), row])).values()];
}

export function parseEventPage(html: string): FibaEventData {
  const payload = extractPayload(html);

  const competitions = jsonValuesFor(payload, "competition", "{");
  const competitionRaw = competitions.find(
    (value) => value && typeof value === "object" && "competitionCode" in value,
  );
  if (!competitionRaw) {
    throw new FibaParseError("Competition details not found; page structure changed");
  }
  const [competition] = parseAll(fibaCompetitionSchema, [competitionRaw], "competition");

  const teamArrays = jsonValuesFor(payload, "teams", "[").filter(
    (value): value is unknown[] =>
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object" &&
      value[0] !== null &&
      "teamId" in value[0] &&
      "slug" in value[0],
  );
  if (teamArrays.length === 0) {
    throw new FibaParseError("Team list not found; page structure changed");
  }
  const teams = dedupe(
    parseAll(fibaTeamSchema, teamArrays.flat(), "teams"),
    (team) => team.teamId,
  );

  const gameArrays = jsonValuesFor(payload, "games", "[").filter(Array.isArray);
  if (gameArrays.length === 0) {
    throw new FibaParseError("Games list not found; page structure changed");
  }
  const games = dedupe(
    parseAll(fibaGameSchema, gameArrays.flat(), "games"),
    (game) => game.gameId,
  );

  const phase = /"currentPhase":"([A-Z_]+)"/.exec(payload);
  return { competition, currentPhase: phase?.[1] ?? null, teams, games };
}
