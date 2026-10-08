import { timingSafeEqual } from "node:crypto";
import { store } from "@/lib/store";
import { runSync } from "@/lib/providers/fiba/apply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Scheduled FIBA sync. Disabled unless CRON_SECRET is set; the caller must present it as a bearer token. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok =
    !!secret &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runSync(store, { apply: true });
    return Response.json({ runId: result.runId, counts: result.counts, notes: result.plan.notes });
  } catch (error) {
    // Fail closed: the run is logged, nothing partial is stored.
    return Response.json(
      { error: error instanceof Error ? error.message : "FIBA sync failed" },
      { status: 502 },
    );
  }
}
