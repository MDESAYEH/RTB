import { createHash, timingSafeEqual } from "node:crypto";
import { store } from "@/lib/store";
import { runGamesSync, runSync } from "@/lib/providers/fiba/apply";
import { FAST_SYNC_MS, IDLE_SYNC_MS, syncWindowActive } from "@/lib/sync-window";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Lease key in rate_limits: one sync at a time across processes; expires by itself if a run dies. */
const LEASE = "fiba-sync:lease";
const LEASE_MS = 90_000;

/** Longest a single call stays open (cron calls once a minute; a request must not run past its maximum). */
const BUDGET_MS = 45_000;

/** When FIBA data was last stored successfully, or null if never. */
async function lastSuccessfulSync(): Promise<number | null> {
  try {
    const row = (await store.db
      .prepare("SELECT MAX(started) AS t FROM fiba_sync_runs WHERE status='ok'")
      .get()) as { t: string | null } | undefined;
    const t = row?.t ? Date.parse(row.t) : NaN;
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

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
    // Called once a minute. While a match is on (from ten minutes before kickoff until FIBA ends it) this call stays
    // open and reads FIBA's games page every few seconds; the rest of the time it syncs only every ten minutes.
    const games = await store.provider.getGames();
    if (!syncWindowActive(games)) {
      const last = await lastSuccessfulSync();
      if (last !== null && Date.now() - last < IDLE_SYNC_MS - 30_000)
        return Response.json({
          skipped: "no match in progress",
          nextInSeconds: Math.max(0, Math.round((IDLE_SYNC_MS - (Date.now() - last)) / 1000)),
        });
      const result = await runSync(store, { apply: true });
      return Response.json({ runId: result.runId, counts: result.counts, notes: result.plan.notes });
    }
    const until = Date.now() + BUDGET_MS;
    let runs = 0;
    let changed = 0;
    let mode = "games";
    while (true) {
      const run = await runGamesSync(store);
      runs++;
      changed += run.changed;
      if (run.mode === "full") mode = "full+games";
      if (Date.now() + FAST_SYNC_MS >= until) break;
      await new Promise((resolve) => setTimeout(resolve, FAST_SYNC_MS));
      // The match may have ended meanwhile: go back to the slow rhythm.
      if (!syncWindowActive(await store.provider.getGames())) break;
    }
    return Response.json({ window: true, mode, runs, changed });
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
