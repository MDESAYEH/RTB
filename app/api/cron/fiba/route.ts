import { createHash, timingSafeEqual } from "node:crypto";
import { store } from "@/lib/store";
import { runSync } from "@/lib/providers/fiba/apply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Lease key in rate_limits: one sync at a time across processes; expires by itself if a run dies. */
const LEASE = "fiba-sync:lease";
const LEASE_MS = 90_000;

// Fixed-length digests: no length leak and no RangeError on multibyte input.
const digest = (value: string) => createHash("sha256").update(value).digest();

/** Scheduled FIBA sync. Disabled unless CRON_SECRET is set; the caller must present it as a bearer token. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok = !!secret && timingSafeEqual(digest(given), digest(secret));
  if (!ok) return new Response("Unauthorized", { status: 401 });
  // Frequent tournament-day calls must not pile up behind a slow FIBA response.
  if (!(await store.rateLimit(LEASE, 1, LEASE_MS)))
    return Response.json({ skipped: "previous sync still running" });
  try {
    const result = await runSync(store, { apply: true });
    return Response.json({ runId: result.runId, counts: result.counts, notes: result.plan.notes });
  } catch (error) {
    // Fail closed: the run is logged, nothing partial is stored.
    return Response.json(
      { error: error instanceof Error ? error.message : "FIBA sync failed" },
      { status: 502 },
    );
  } finally {
    await store.rateLimitReset(LEASE).catch(() => undefined);
  }
}
