import { z } from "zod";
export const adminCommandSchema = z.object({
  action: z.string(),
  password: z.string().max(256).optional(),
  identifier: z.string().max(254).optional(),
  role: z.string().max(20).optional(),
  otp: z.string().max(32).optional(),
  kind: z.string().optional(),
  id: z.string().optional(),
  value: z.unknown().optional(),
  version: z.number().optional(),
  side: z.enum(["home", "away"]).optional(),
  points: z.number().int().min(-3).max(3).optional(),
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

/** Control-room commands that act on one match: they need its id and its current version. */
export const CONTROL_ACTIONS = ["score", "clock", "status", "undo", "correct", "stream", "manual"];

/** True when a control command is well formed. Points may be added (1-3) or taken back (-1 to -3). */
export function validControlCommand(b: AdminCommand): boolean {
  if (!CONTROL_ACTIONS.includes(b.action)) return true;
  if (!b.id || !Number.isInteger(b.version) || (b.version ?? -1) < 0) return false;
  if (b.action === "score" && (!b.side || ![1, 2, 3, -1, -2, -3].includes(b.points ?? 0))) return false;
  if (b.action === "status" && !b.status) return false;
  if (b.action === "manual" && typeof b.value !== "boolean") return false;
  return true;
}
