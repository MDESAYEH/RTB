# THE ROAD — Tripoli 2027

Arabic-first independent tournament platform. No production deployment has been performed. Public data is limited to the verified event announcement and teams; no fixtures, players, scores, statistics or venue are seeded.

## Run locally

Requires Node 24 and npm. From this directory:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The SQLite database is created and migrated automatically on startup, with WAL and a busy timeout. No external credentials are needed. `DATABASE_PATH` defaults to `data/road.db`; set it to persistent storage in hosting. Never commit this file.

Provision an administrator (minimum 14 characters), with a private environment variable:

```powershell
$env:ADMIN_PASSWORD = '<your-private-strong-password>'
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

Visit `/admin`. Provisioning rotates the password and invalidates sessions. There is no shipped default account. Copy `.env.example` to `.env.local` for Next configuration; the provisioning script reads process environment directly, not Next's env files.

## Architecture

Next.js App Router, strict TypeScript, React, Zod, SQLite (Node 24 built-in `node:sqlite`). Server-rendered initial public data → internal JSON API → SSE revision notifications → refreshed normalized data. `ManualProvider` is the only enabled provider. No browser or server contacts private sports endpoints. Public pages do not inspect provider credentials. SQLite is a deliberate self-contained single-host baseline; PostgreSQL and a shared event bus are required before multi-instance hosting. The proposed Prisma/PostgreSQL stack was not used because no database service was available.

`lib/domain.ts`: boundary schemas, game state transitions, score and period updates, authoritative clock, standings, conservative qualification bounds, source precedence/conflict helper.
`lib/store.ts`: migration, seed, persistent records, transactions, admin/session hashing, persistent rate buckets, provider.
`app/api/admin`: authenticated same-origin mutations, optimistic game versions, audit trail.
`app/api/live`: SSE revision stream with heartbeat; disconnect cleanup.

## Data management

Admin includes live control, structured form editing with advanced JSON, health and audit views. Select a collection, create/edit JSON, validate and save. Use `settings` for groups, dates, city, venue, timezone, editorial content, points, qualification slots and featured game. `news.status` controls publishing. `players`, `stats`, `teamStats`, `events` and `pulse` accept verified manual entries. Team IDs are stable references. Existing scheduled games can be edited; started games are controlled in the live room; score increments are restricted to active play.

The schedule creation template is editor input only and is never published until explicitly saved. It must be replaced with a verified date/time. NB Staoueli remains flagged for spelling review; Stade Malien is confirmed by the French FIBA announcement. No logos or player photographs are presented as official assets.

## Rules and qualification

Top two from each Tripoli group to Elite 16 is verified in the FIBA announcement. Match points 2/1 are editable defaults, NOT verified competition regulations; `rulesConfirmed=false` prevents qualification claims. Standings leaves points ties unresolved rather than silently applying unverified score-difference rules. Early qualification uses strict mathematical bounds only when rules are confirmed and a complete single-round-robin schedule is entered. No probabilities, arbitrary win scenarios or fake brackets. Forfeits, multi-round schedules and official head-to-head rules require extension before use.

## Realtime and offline

One database revision increments inside each mutation transaction. SSE sends changed revisions every two seconds; clients fetch internal data only. Clock comes from a server timestamp and locally interpolates. Last valid scores remain visible on reconnect. Live data older than 45 seconds shows delayed. This threshold deliberately treats operator inactivity as stale; tune for event workflow. In-process connections and SQLite support one host only. Reverse proxies must disable SSE buffering and permit long connections. No external collector is enabled.

The service worker only caches the offline shell and icon, never live pages or API scores. Manifest provides basic install metadata; device installation requires HTTPS; the manifest provides both raster sizes and a scalable icon.

## Security

Scrypt password hashes with random salt; opaque 32-byte tokens hashed in storage; 8-hour HTTP-only SameSite Strict session; HTTPS secure cookies; server-side authorization on each admin read/write; exact Origin checks; Zod validation; prepared SQL; React text escaping; no HTML news rendering; mutation transactions/version checks; persistent rate limiting; body limit; security headers. Single admin role. Audit stores actor, action, old/new, timestamp and correction reason. Uploads require admin authentication and fully decode validated PNG/JPEG/WebP inputs, enforce 5 MB/16 MP limits, reject traversal names and animation, resize to at most 1600px, strip metadata and re-encode canonical WebP. Raster images are served with fixed image MIME and immutable content hashes; no SVG or executable upload is accepted. Files live beside the database in media/. No remote URL fetching is enabled. Optional proxy-aware login limiting is implemented but must only be enabled behind a trusted proxy that replaces X-Real-IP and prevents direct origin access. MFA, dedicated roles, backup encryption and CSP nonce hardening are not claimed implemented.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

E2E must use an isolated database and test-only admin account. Do not run mutation E2E against the event database:

```powershell
$env:DATABASE_PATH = './data/e2e.db'
$env:ADMIN_PASSWORD = '<test-only-strong-password>'
$env:E2E_PASSWORD = $env:ADMIN_PASSWORD
npm run admin:create
npm start -- --port 3001
# In another terminal with E2E_PASSWORD set:
npm run test:e2e
```

Use a fresh test DB for predictable screenshots; game and news IDs are unique per run. The checked-in Playwright configuration uses installed Chrome (channel chrome); install Chrome or change the channel to Chromium and run `npx playwright install chromium`. Visual captures are generated under `test-results/`. Unit tests use a temporary isolated database.

## Deployment prerequisites

No deployment authorized. Before an event release: verify competition rules and spellings, obtain approved schedule/venue, train operators, run venue connectivity drills, add trusted licensed imagery and logos, verify PWA installation on event devices, review real content accessibility, configure canonical SITE_URL and HTTPS, persistent volume + backups + restore drill, monitor SSE/memory under expected crowd load, secure administrator provision, verify proxy origin behavior, and test rollback/recovery. Do not horizontally scale this SQLite baseline. `DATA_SOURCES.md` documents capability evidence and unavailable integrations.

See VERIFICATION.md for exact measured checks and known release limitations.


## Phase 2 operations and evidence

The working SQLite/SSE/ManualProvider architecture is retained. The canonical journey route is /the-road; /road remains available. Road states derive from actual games and confirmed qualification, with later stages locked. Match center has a dedicated scoreboard; mobile standings hides auxiliary columns while keeping record/difference/points legible. Fonts are locally bundled Noto Sans Arabic and Bebas Neue (SIL OFL; see assets/ licenses). Court graphics are original CSS geometry; no unlicensed tournament imagery is shipped.

Live control uses optimistic versions, a busy lock and per-command UUID receipts retained for 24 hours. Replaying the same authenticated command does not score twice; competing different commands with the same version return 409 and trigger a fresh snapshot. Undo reverses the latest score/clock change within the current status; changing status clears undo. Finished games cannot be reopened by ordinary controls. Use the explicit documented correction dialog, edit the game snapshot, supply an 8–400 character reason and confirm. Team IDs/date/group remain immutable; period totals must equal the scoreboard, final games need Q4+, clock zero and a winner. Correction resets the undo stack, recomputes standings and emits a correction announcement; the audit retains before/after and reason.

SSE sends an initial current revision on every connection, IDs, a 2-second retry directive and observable heartbeats. IDs are snapshot notifications, not a play-by-play replay log: reconnect always refreshes the latest authoritative data. Client refreshes are serialized and revisions cannot regress. A 10-second watchdog and browser offline state remove the LIVE label, freeze the displayed clock and show last reception time. Operator inactivity also retains the conservative 45-second delayed-data warning. The offline shell never presents cached scores as live.

For HTTPS hosting set SITE_URL to the exact public origin. It is used for canonical/share metadata, mutation Origin checks and Secure cookies behind the proxy. Enable TRUST_PROXY_IP=1 only after the proxy strips/replaces X-Real-IP and direct origin access is blocked. Missing/invalid client IP then fails closed. Local mode retains a global ten-attempt/15-minute login bucket; this can lock all login attempts and is unsuitable as the sole public proxy configuration.

## Backup and restore

Run npm run db:backup against the intended DATABASE_PATH. The native SQLite online backup API creates a consistent snapshot including WAL state, verifies integrity and foreign keys, and copies immutable media into a unique backup directory. Do not copy the live .db file alone. Treat backups as private because they contain password hashes, sessions and audit history. Use an encrypted off-host destination and a retention policy in hosting.

To restore, stop the server and every writer. Preserve the current data directory under a separate recovery name. Restore road.db and media from the same snapshot into a new empty directory, set DATABASE_PATH to it, provision/rotate the private admin password to revoke old sessions, run integrity/foreign-key checks, then start and smoke-test the server. Do not reuse old WAL/SHM files. Local QA restores an actual isolated backup into a fresh directory, starts the production runtime and verifies public snapshot equality, authorization and integrity. A drill on the actual production host and storage remains required.

Run node scripts/phase2-verify.mjs after npm run build for isolated browser regressions, 20-client SSE/write/restart/offline checks, six-size visual captures, synthetic mobile performance and backup verification. It generates a private random test password, never provisions the public database, and stops its port 3001 test server. Baseline and final evidence are in verification/phase2/. Never run mutation tests against the event database.

## Phase 3 release readiness

See RELEASE_CHECKLIST.md for deployment/day-of-event checks and the bounded hosting load-test plan. No real hosting load test or production deployment has been performed. Performance evidence is in verification/phase3/PERFORMANCE_REPORT.md: public homepage median LCP 1.228s across three cold-cache 390px/CPU4x/150ms/1.6Mbps samples; live-fixture homepage 1.424s in the existing sampler. Browser JS decreased from 247778 to 156543 encoded bytes by keeping server schema initialization out of public display imports. Fonts and design quality remain unchanged; only the small display font is preloaded. The old 5.692s single sample was not reproduced, so it is not a proved before/after improvement percentage.

