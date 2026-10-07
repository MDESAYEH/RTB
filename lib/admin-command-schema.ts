import { z } from "zod";
export const adminCommandSchema = z.object({
  action: z.string(),
  password: z.string().max(256).optional(),
  kind: z.string().optional(),
  id: z.string().optional(),
  value: z.unknown().optional(),
  version: z.number().optional(),
  side: z.enum(["home", "away"]).optional(),
  points: z.number().optional(),
  status: z
    .enum([
      "Scheduled",
      "Warmup",
      "Live",
      "Halftime",
      "Ended",
      "Postponed",
      "Cancelled",
    ])
    .optional(),
  clock: z.number().optional(),
  quarter: z.number().optional(),
  running: z.boolean().optional(),
  requestId: z.string().uuid().optional(),
  reason: z.string().trim().min(8).max(400).optional(),
  confirmed: z.literal(true).optional(),
});
export type AdminCommand = z.infer<typeof adminCommandSchema>;
