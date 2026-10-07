# Release checklist — Road to BAL Tripoli

Unchecked items require evidence from the actual deployment. Local build/20-client SSE checks do not establish production readiness. Architecture remains one host with SQLite, SSE and ManualProvider. No deployment or external load test has been performed.

## BEFORE DEPLOYMENT

- [ ] Record hosting CPU/RAM, storage type/capacity/IOPS, OS/Node version, region, proxy/CDN, process manager, deployment path and expected peak users/tabs. Use the supported Node runtime and lockfile.
- [ ] Set exact public HTTPS `SITE_URL`, persistent absolute `DATABASE_PATH`, private file permissions and a controlled writable media directory. Keep secrets/backups outside publicly served paths and source control; redact cookies/passwords from logs.
- [ ] Create a real Admin with `npm run admin:create` and a private strong password. Do not reuse QA accounts or retain provisioning passwords in service environment/history/logs. Verify no known default credentials.
- [ ] Specify TLS certificate renewal, origin access restrictions and proxy ownership. Enable `TRUST_PROXY_IP=1` only when the proxy replaces `X-Real-IP` and direct origin access is blocked; verify invalid/missing headers fail closed. Default local login bucket is global and can lock everyone out.
- [ ] Configure SSE without buffering/caching/compression delays; allow long connections and heartbeat traffic. Set proxy/read timeouts above heartbeat intervals and verify headers reach the client. Keep ordinary API cache policies distinct from immutable media.
- [ ] Use one application instance/writer host. Do not place SQLite on unsuitable network/shared storage or horizontally scale this build.
- [ ] Configure process supervision, controlled restart/backoff, crash logging, health checks and startup after server reboot. Record the exact command, working directory and environment.
- [ ] Set disk alerts for database/WAL/media/logs/backups, rotation and retention. Proposed alert: <20% free or <2GB, whichever triggers earlier; validate against the host's available space and growth.
- [ ] Select an encrypted private off-host backup location, access owner, retention and backup schedule. Use native `npm run db:backup`, not a copy of the live `.db` alone. Back up immutable media with the matching snapshot.
- [ ] Perform a restore drill on deployment storage into a separate empty directory; check integrity/FKs, media and public data, revoke old sessions, then test login/scoring. Record duration, RPO/RTO and recovery owner. Keep old DB/WAL together for investigation; never mix old WAL into a restored DB.
- [ ] Define release rollback including database compatibility. Preserve prior application release and a verified snapshot before migration; never overwrite the only recovery copy.
- [ ] Run the hosting-specific load plan below on owned staging after documenting capacity and an agreed ceiling. No aggressive test of FIBA or any other external service.

## AFTER DEPLOYMENT

- [ ] Verify actual HTTPS/redirects/certificate and configured canonical/OG URLs. Inspect `Secure`, `HttpOnly`, `SameSite=Strict` cookies on real HTTPS; test login/logout and cross-origin rejection.
- [ ] Verify public routes, news/match share previews, robots/sitemap and Admin noindex. Confirm test fixtures/accounts are absent.
- [ ] Use actual mobile devices on Wi-Fi and mobile data: Arabic/RTL, hero, countdown, score/standings, touch targets, reduced motion and safe areas. Measure cold first loads without claiming local synthetic results as field metrics.
- [ ] Install PWA under HTTPS on event devices; check upgrade, reconnect and offline navigation. Offline must show a clear offline/last-update state, never cached LIVE scores.
- [ ] Verify SSE through the actual proxy/CDN using multiple tabs, quiet connections, disconnect/reconnect and application restart. Check revision ordering, frozen offline clocks and restored authoritative scores.
- [ ] Verify WAL/busy timeout/FKs on the actual runtime, backup access, disk/log alerts and backup restore evidence. Test supervised process restart and server reboot recovery.
- [ ] Complete real hosting load test and sign off results with a safe audience capacity. Measure proxy limits as well as application behavior; do not infer capacity from 20 local connections.

## BEFORE TOURNAMENT

- [ ] Obtain official fixtures, dates/times/timezone, game identifiers and venue; review every match and day selector.
- [ ] Approve rosters, team names (including the remaining NB Staoueli spelling flag), licensed logos/photos and published content.
- [ ] Confirm competition points/tiebreak/forfeit/qualification rules. Keep `rulesConfirmed=false` until reviewed; current logic requires a valid complete single-round-robin schedule. Unsupported formats/rules require explicit resolution before use.
- [ ] Assign primary operator, backup operator, data reviewer and recovery owner. Train on +1/+2/+3, Undo, period, clock, halftime/final and reasoned audited correction.
- [ ] Rehearse Live Control with real devices; confirm normal scoring has no confirmation burden while final/correction actions are intentional.
- [ ] Rehearse two-admin conflicts and stale-version refresh. Define one primary scorer per game to reduce conflicts.
- [ ] Rehearse venue internet outage, browser refresh, server restart and reconnection. Confirm public clocks/labels and operator recovery.
- [ ] Rehearse manual fallback: official paper score/period/time log, backup connectivity/device, reconciliation using audited correction with a reason. ManualProvider remains independent of external feeds.
- [ ] Verify venue connectivity, power, backup connectivity, disk headroom, latest backup and restore contacts. Record final official-data approval.

## MATCH DAY

- [ ] Confirm correct game/teams/status/period, zero or reconciled score and authoritative clock before starting. Assign active scorer and reviewer.
- [ ] Verify public match center on a separate device, SSE freshness and current schedule; monitor errors, active connections, CPU/RAM, disk/WAL and database busy/failed writes.
- [ ] Record connectivity/service incidents and paper fallback scores. Do not relabel stale/offline results as LIVE.
- [ ] Review score/period/time before final. Use reasoned correction for legitimate final edits; inspect audit records and standings after correction.
- [ ] Take scheduled consistent backups and verify their completion privately. Escalate at agreed capacity/error/disk thresholds; apply the documented fallback/recovery procedure.

## AFTER MATCH DAY

- [ ] Reconcile final scores/period totals against official records; review audit actor/action/reason and published Pulse/news.
- [ ] Review standings/qualification with approved rules and unresolved ties; do not publish unsupported qualification claims.
- [ ] Take and verify off-host backup including media. Check retention/log rotation/disk capacity and next-day fixtures.
- [ ] Review incidents, load/freshness charts, access/session anomalies and operator handover. Revoke unnecessary sessions and rotate compromised credentials.

## Hosting load-test plan — not executed

1. **Prerequisites:** owned staging that matches hosting, approved maintenance window, backup/restore, monitoring and emergency stop owner. Record CPU/RAM/storage/proxy limits and audience estimate first. No hosting environment or audience target is known yet.
2. **Workload:** derive connection ceiling C from expected simultaneous viewers × tabs/viewer; measure visitor browsing separately. Mix SSE subscribers, initial `/api/data`, snapshot refresh after revisions, home/match/standings navigation and immutable media. Include realistic scoring/clock writes from an isolated test admin. Keep credential material private.
3. **Stages:** warm up at a small fraction of C, then 10/25/50/100% of agreed C, 5–10 minutes each; hold expected peak for 30 minutes. Only test a modest agreed burst above peak after steady-state passes. Use a dedicated generator outside the application host and cap its rates/connections; no infinite ramp or third-party targets.
4. **Failure/recovery:** under a safe fraction of peak, reconnect a cohort, rotate proxy connections, restart the application, then verify persisted scores and authoritative refresh. Perform server reboot separately with recovery owner present. Exercise two-admin conflicts without losing/duplicating accepted scores.
5. **Measure:** actual open/reconnecting SSE, notification-to-visible latency, HTTP p50/p95/p99, failed writes/SQLITE_BUSY, 409 conflict rate, CPU/RAM/event-loop delay, file descriptors, disk/WAL growth, proxy errors, score correctness and recovery time. Collect client and server timestamps; synchronize clocks.
6. **Proposed acceptance:** zero lost/duplicate accepted scores, no revision regression or failed integrity/FK checks, no sustained database busy failures, <1% unexpected HTTP errors, p95 public snapshot <1 second and p95 revision-to-visible <3 seconds. These are proposed operational targets, not measured claims; adjust with the hosting owner before testing.
7. **Stop immediately:** score correctness/integrity failure, disk alert, uncontrolled restart loop or memory growth. Pause ramp for sustained unexpected errors >1%, p95 latency >2× the agreed target or CPU >85% for 5 minutes. Record the safe tested ceiling and remaining headroom, not an unlimited user claim.
8. **Deliverable:** host/proxy configuration, generator location/tool/version, exact rates/connections/data, duration, timestamps, metrics, failures and recovery evidence. Repeat after material hosting changes. A local 20-connection test is only a functional check.
