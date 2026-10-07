import { transitions } from "./public-domain";
export { transitions, stale, remainingClock, standings, qualification } from "./public-domain";
import { z } from "zod";
export const mediaSchema = z
  .string()
  .regex(/^\/api\/media\/[a-f0-9]{64}\.(png|jpg|webp)$/)
  .optional();
export const teamSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(2).max(100),
  country: z.string().max(80),
  group: z.string().min(1).max(20),
  verified: z.boolean().default(false),
  logo: mediaSchema,
});
export const statuses = [
  "Scheduled",
  "Warmup",
  "Live",
  "Halftime",
  "Ended",
  "Postponed",
  "Cancelled",
] as const;
export const gameSchema = z
  .object({
    id: z.string().min(1).max(80),
    home: z.string(),
    away: z.string(),
    group: z.string(),
    date: z.iso.datetime({ offset: true }),
    venue: z.string().max(150).default(""),
    status: z.enum(statuses).default("Scheduled"),
    homeScore: z.number().int().min(0).max(999).default(0),
    awayScore: z.number().int().min(0).max(999).default(0),
    quarter: z.number().int().min(1).max(20).default(1),
    clock: z.number().int().min(0).max(600).default(600),
    running: z.boolean().default(false),
    updatedAt: z
      .union([z.literal(""), z.iso.datetime({ offset: true })])
      .default(""),
    version: z.number().int().min(0).default(0),
    periods: z
      .array(
        z.object({
          home: z.number().int().min(0),
          away: z.number().int().min(0),
        }),
      )
      .max(20)
      .default([]),
  })
  .refine((g) => g.home !== g.away, "Different teams required");
export const settingsSchema = z
  .object({
    name: z.string().min(2).max(150),
    shortName: z.string().max(60),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
    city: z.string().max(100),
    venue: z.string().max(150),
    hero: z.string().max(150),
    announcement: z.string().max(400),
    groups: z.array(z.string().min(1).max(20)).min(1).max(10),
    qualificationSlots: z.number().int().min(1).max(10),
    winPoints: z.number().int().min(1).max(5),
    lossPoints: z.number().int().min(0).max(5),
    rulesConfirmed: z.boolean(),
    featuredGameId: z.string().nullable(),
  })
  .refine(
    (s) => Date.parse(s.end) > Date.parse(s.start),
    "End date must follow start date",
  )
  .refine(
    (s) => s.winPoints > s.lossPoints,
    "Win points must exceed loss points",
  );
export const newsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(160),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(400),
  content: z.string().max(30000),
  author: z.string().max(100),
  publishedAt: z.iso.datetime({ offset: true }),
  status: z.enum(["draft", "published"]),
  cover: mediaSchema,
});
export const playerSchema = z.object({
  id: z.string().min(1),
  team: z.string(),
  name: z.string().min(2).max(100),
  number: z.number().int().min(0).max(99),
  position: z.string().max(30),
  photo: mediaSchema,
});
export const statSchema = z.object({
  id: z.string(),
  game: z.string(),
  player: z.string(),
  points: z.number().int().min(0),
  rebounds: z.number().int().min(0),
  assists: z.number().int().min(0),
  steals: z.number().int().min(0),
  blocks: z.number().int().min(0),
  efficiency: z.number(),
});
export const eventSchema = z.object({
  id: z.string().min(1),
  game: z.string(),
  period: z.number().int().min(1),
  clock: z.string().regex(/^[0-9]{2}:[0-5][0-9]$/),
  text: z.string().min(1).max(500),
  date: z.iso.datetime({ offset: true }),
});
export const teamStatSchema = z
  .object({
    id: z.string(),
    game: z.string(),
    team: z.string(),
    fgMade: z.number().int().min(0),
    fgAttempted: z.number().int().min(0),
    twoMade: z.number().int().min(0),
    twoAttempted: z.number().int().min(0),
    threeMade: z.number().int().min(0),
    threeAttempted: z.number().int().min(0),
    ftMade: z.number().int().min(0),
    ftAttempted: z.number().int().min(0),
    rebounds: z.number().int().min(0),
    assists: z.number().int().min(0),
    steals: z.number().int().min(0),
    blocks: z.number().int().min(0),
    turnovers: z.number().int().min(0),
    fouls: z.number().int().min(0),
  })
  .refine(
    (v) =>
      v.fgMade <= v.fgAttempted &&
      v.twoMade <= v.twoAttempted &&
      v.threeMade <= v.threeAttempted &&
      v.ftMade <= v.ftAttempted,
    "Made shots cannot exceed attempts",
  );
export const pulseSchema = z.object({
  id: z.string(),
  text: z.string().min(2).max(500),
  date: z.iso.datetime({ offset: true }),
  type: z
    .enum(["LIVE", "FINAL", "QUALIFIED", "ANNOUNCEMENT", "MILESTONE"])
    .optional(),
  game: z.string().optional(),
  team: z.string().optional(),
});
export type Team = z.infer<typeof teamSchema>;
export type Game = z.infer<typeof gameSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type News = z.infer<typeof newsSchema>;
export function transition(g: Game, status: Game["status"]): Game {
  if (status !== g.status && !transitions[g.status].includes(status))
    throw Error("انتقال حالة غير مسموح");
  if (status === "Ended" && (g.quarter < 4 || g.clock > 0))
    throw Error("أكمل الفترة الرابعة والساعة قبل إنهاء المباراة");
  if (status === "Halftime" && (g.quarter !== 2 || g.clock > 0))
    throw Error("الاستراحة بعد انتهاء الفترة الثانية");
  if (status === "Ended" && g.homeScore === g.awayScore)
    throw Error("لا يمكن إنهاء مباراة متعادلة");
  return { ...g, status, running: status === "Live" ? g.running : false };
}
export function score(g: Game, side: "home" | "away", points: number): Game {
  if (!["home", "away"].includes(side)) throw Error("Invalid side");
  if (g.status !== "Live") throw Error("ابدأ المباراة قبل تعديل النتيجة");
  if (![1, 2, 3].includes(points)) throw Error("Invalid points");
  const key = side === "home" ? "homeScore" : "awayScore";
  const periods = [...g.periods];
  while (periods.length < g.quarter) periods.push({ home: 0, away: 0 });
  periods[g.quarter - 1] = {
    ...periods[g.quarter - 1],
    [side]: periods[g.quarter - 1][side] + points,
  };
  return gameSchema.parse({ ...g, [key]: g[key] + points, periods });
}
export function resolveSource(
  manual: unknown,
  primary: unknown,
  secondary: unknown,
) {
  return {
    value:
      manual !== undefined
        ? manual
        : primary !== undefined
          ? primary
          : secondary,
    conflict:
      primary !== undefined &&
      secondary !== undefined &&
      JSON.stringify(primary) !== JSON.stringify(secondary),
    source:
      manual !== undefined
        ? "manual"
        : primary !== undefined
          ? "primary"
          : "secondary",
  };
}

