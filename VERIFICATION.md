# Phase 2 verification — 6 October 2026

Verdict: READY WITH BLOCKERS. Local functional/security/visual checks pass. Slow-mobile homepage LCP, real hosting/proxy/load validation and official event data remain blockers. No deployment or audience-capacity claim.

## Baseline
Recorded before product changes in verification/phase2/BASELINE.md: lint/typecheck/build exit 0; 15 unit tests passed. Workspace is not a Git repository. Schema/migrations, auth/authorization, admin, scoring, SSE, qualification, uploads, audit, public routes, tests and documentation were inspected. Baseline has 60 screenshots; /the-road was missing.

## Final checks
- ESLint / strict TypeScript: exit 0.
- Node tests: 26 passed, 0 failed/skipped, 3 files. Runner reports 0 suites because tests are top-level cases.
- Playwright: 9 passed, 0 failed, 4 spec files, production runtime with isolated private database; 55 seconds.
- Production build exit 0; production start/public smoke pass. Public DB has 10 teams, zero games/players/statistics and zero admin accounts. OG HTTP 200 image/png, 40205 bytes.
- Public visual audit 60 views; isolated fixture audit 96 views. Zero horizontal overflow, missing H1 or unexpected console/page errors. Six unauthenticated /api/admin 401 responses are recorded separately as expected.
- Sizes: 390×844, 430×932, 768×1024, 1366×768, 1440×900, 1920×1080. Existing browser regression also covers narrower widths.
- Each size: home, matches, standings, teams, stats, news, /the-road, /road alias, team profile, admin. Fixtures add scheduled/live/halftime/final match centers, news/player details. Representative hero/Road/scoreboard/standings/admin/Arabic social screenshots inspected visually.

## Product
SQLite/SSE/ManualProvider retained and independent of external services. Tripoli hero uses original court geometry, licensed bundled Noto Sans Arabic/Bebas Neue fonts, dates/countdown. Road has five explicit stages with conservative derived statuses. Upcoming/live/final hierarchy differs; match center prioritizes score/clock. Mobile standings retain W/L/difference/points without squeezing auxiliary columns. Team profiles show record/status/roster state and existing derived stats. Pre-event stats/news states, inline day selection and contextual Pulse are implemented. Reduced-motion, safe-area navigation and stale/offline labels are checked.

Canonical/share metadata, robots/sitemap and Arabic news/match OG images pass. Admin noindex. PWA caches offline shell/icon only, never scores/API/live pages. Actual HTTPS device installation remains a release check.

Official FIBA data rechecked 5 October; see DATA_SOURCES.md. No new scraping/private API/fake public fixtures or roster. Stade Malien spelling verified; NB Staoueli remains flagged. Qualification needs confirmed rules and a complete valid schedule; unresolved ties do not shade arbitrary top-two teams.

## Security / live control
HttpOnly/SameSite Strict sessions; configured HTTPS origin produces Secure cookies. Cookie flags were asserted using configured public HTTPS origin on local transport, not actual TLS. Exact Origin, per-boundary authorization, streamed body limits, persistent login throttling, prepared SQL and text-only news are tested. No default admin account/password. TRUST_PROXY_IP must only be enabled behind a proxy that replaces headers and prevents direct origin access; invalid/missing IP fails closed. Local global login bucket can lock all login attempts.

Uploads fully decode/re-encode raster images with 5MB/16MP limits, MIME/extension checks and content hashes. Tests reject forged images, SVG, MIME mismatch, excess size/pixels and retained traversal names. MFA, separate roles and CSP nonce hardening are not claimed.

Actual Admin UI tests cover double +1/+2/+3, multiple Undo, two tabs/stale conflict recovery, accidental End cancellation with Escape and reduced motion. API tests cover replay/idempotency, concurrent versions, invalid clock, negative/inconsistent scores, backward period/status changes and intentional corrections. Final cannot reopen through ordinary controls. Correction needs confirmation/reason; audit records actor/action/time/before/after/reason. Historical unknown audit actions are not fabricated. New scheduled games require Q1/600 seconds, zero score/periods.

## SSE / SQLite / restore
20 local SSE connections and 30 sequential writes passed monotonic notifications, reconnect, browser refresh, test-server restart and offline shell. Score persisted at 30 then updated to 33. Local write p95 26ms. This is functional recovery/concurrency verification, NOT production load testing. Snapshot IDs refresh latest state rather than replay every play. Serialized client fetches reject old revisions; quiet connection after 10 seconds removes LIVE/freezes clock. Operator inactivity warning remains 45 seconds.

Public database: WAL, busy timeout 5000, foreign keys on, schema v3, integrity ok, no FK violations. Score/revision/receipt/undo/audit/Pulse share transactions. Native online backup includes WAL state/media. Actual isolated backup restored into a fresh directory and started using production runtime: snapshot equality, admin 401 and integrity passed. HTTPS-configured cookie flags also passed there. Actual production-storage restore still required. Single-host SQLite must not be horizontally scaled.

## Performance
One cold-cache local Chrome sample each: 390×844, CPU4×, RTT150ms, down1.6Mbps. These are synthetic measurements, not field Core Web Vitals/Lighthouse scores.

| Screen | LCP | CLS | Encoded JS | Font bytes |
|---|---:|---:|---:|---:|
| Homepage | 5692ms | 0.0591 | 247778 | 225728 |
| Live match center | 1096ms | 0.0280 | 247778 | 225728 |

Slow-mobile homepage LCP remains poor and is an explicit blocker. Shared client bundle/font delivery needs additional profiling. No perfect-performance claim.

## Before 21 October
Resolve homepage slow-mobile rendering; approve fixtures/venue/rosters/classification rules and remaining spelling; provision strong private admin; obtain approved imagery; rehearse operators/venue connectivity; configure exact HTTPS SITE_URL/trusted proxy/persistent storage; verify actual TLS/SSE buffering/device PWA; capacity-test anticipated crowd on hosting; encrypt off-host backups and repeat restore/rollback there. No shot chart/unsupported advanced stats added.

Evidence: verification/phase2/{public-final,fixture-final}/results.json and screenshots, realtime.json, performance.json, sqlite-restore.json, public-database.json, login-limit.json, qa-database.json. Fixture database/backup are private QA artifacts, never public event data.

## Phase 3 update — 6 October 2026
The Phase 2 performance table above remains historical. Current performance evidence: verification/phase3/PERFORMANCE_REPORT.md. Public homepage median LCP 1.228s, CLS0.00454 (three samples); isolated live-fixture homepage1.424s/CLS0.00498, Match Center1.056s. JS156543 bytes vs247778; same-content fonts unchanged. The historical5.692s single sample was not reproduced and lacks a retrospective element/timing breakdown. Local2.5s target is met; hosting/data release blockers remain. Final26 unit +9 browser cases, lint/typecheck/build and60+96 visual views pass. RELEASE_CHECKLIST.md records operational prerequisites and a hosting-specific load plan; actual production TLS/proxy/storage/capacity remain unverified. Verdict READY WITH BLOCKERS.
