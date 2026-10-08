# Data-source verification — 5 October 2026

No private/reverse-engineered endpoint was contacted. Search results and official accessible pages were inspected using web tools. Accessibility of a public page does not establish a licensed API.

## FIBA

URLs tested:
- https://www.fiba.basketball/en/events/fiba-africa-champions-clubs-road-to-bal-2027/overview — direct open returned internal retrieval error; UNAVAILABLE through this tool, not evidence the website is offline.
- https://www.fiba.basketball/en/news/introducing-the-road-to-bal-2027 — official indexed announcement accessible. CONFIRMED: Groups A/B in Tripoli 21–25 October, ten announced clubs/countries, top two per group to West Elite 16. UNCONFIRMED spelling: article uses Stade Malie / Nadi Staouedi; user supplies Stade Malien / NB Staoueli. The Phase 2 French announcement confirms Stade Malien; NB Staoueli remains flagged.
- https://www.fiba.basketball/en/events/fiba-africa-champions-clubs-road-to-bal-2027/teams/nabaya-sofas — official indexed team page confirms Nabaya Sofas, GUI, Group A, code NBC; used instead of abbreviated Nabaya. This code is editorial evidence, not a guaranteed API identifier.
- https://www.fiba.basketball/en/events/fiba-africa-champions-clubs-road-to-bal-2026 — indexed official page exposes final scores, stages, standings links, leaders (points, rebounds, assists, steals, blocks, efficiency). Direct open failed; no API license or endpoint inferred.
- https://about.fiba.basketball/en/services/resource-hub/downloads — current search index lists Official Basketball Rules 2026 v1.1; direct retrieval failed. Competition-specific classification regulations and tiebreakers remain UNCONFIRMED.

2027 API capability matrix:

| Capability | Evidence status | Integration |
|---|---|---|
| Event, dates, city, groups, qualification slots | CONFIRMED public editorial source | Reviewed manual seed |
| Team membership/countries | CONFIRMED announcement | Reviewed manual seed |
| NB Staoueli / Nadi Staouedi spelling | UNCONFIRMED | Admin editable and flagged |
| Tournament numeric ID / game IDs | UNCONFIRMED | Internal generated IDs only |
| Fixtures, time, venue | UNCONFIRMED | Empty until admin approval |
| Roster, players, box scores, statistics, leaders | UNCONFIRMED for 2027 | Manual contracts + empty states |
| Quarter scores, status, live scores, clock | UNCONFIRMED external access | Working manual control |
| Play-by-play | UNCONFIRMED | Manual event editor; visible only with real entries |
| Shot chart | UNCONFIRMED | No tab or chart fabricated |
| Public approved sports API | UNCONFIRMED | No external adapter enabled |
| Authenticated licensed feed | NEEDS CREDENTIALS / agreement | Integrate only after approval |

Terms/access: FIBA page availability is not redistribution permission for automated feeds, images or logos. No scraping collector. Upcoming Elite 16 editorial dates are not hard-coded; road shows the stage only.

## Sofascore

Official API policy tested: https://sofascore.helpscoutdocs.com/article/129-sports-data-api-availability
Official terms searched: https://www.sofascore.com/terms-and-conditions

CONFIRMED: official FAQ says it does not provide sports data via API due to agreements with providers; media widgets can be requested through https://corporate.sofascore.com/widgets. Public API integration is UNAVAILABLE for this baseline. All tournament IDs, games, rosters, statistics, box score, clock, play-by-play and shot-chart programmatic capabilities are UNCONFIRMED; no undocumented endpoints were used. No SofascoreProvider class is shipped because it would not be usable. Authentication/access: an approved partnership would need confirmation; credentials alone do not establish permission.

## 365Scores

Official public terms page searched: https://www.365scores.com/de/pages/terms
Official privacy policy inspected: https://www.terms.365scores.com/privacy-policy
Publisher agreement inspected: https://www.terms.365scores.com/publisher — concerns advertising, not an API data license.

No official documented tournament data API was verified. Tournament IDs, fixtures, teams, rosters, scores, statistics, quarter scores, status, clock, play-by-play, shot chart and leaders: UNCONFIRMED. Integration is NOT_CONFIGURED. Requirements for approved data access: NEEDS CREDENTIALS / explicit provider agreement if offered. No private requests, anti-bot bypass or fake endpoint.

## ManualProvider

CONFIRMED by local unit/integration/E2E tests when listed in VERIFICATION.md. Database-backed approved settings, teams, players, games, news and player statistics. Score/clock/period control, audit, standings and conservative qualification. No third-party credentials. Source status HEALTHY means local database access succeeded; it never implies an external feed is online.

## Priority and conflicts

Pure `resolveSource` contract enforces manual → primary → secondary and flags disagreeing approved sources. There is currently only one source, Manual, so no automatic source conflicts occur. Persistent external provenance, conflict ingestion, sync logs and reconciliation are intentionally NOT implemented until an authorized source contract exists. Data Health reports NOT_CONFIGURED for the three external providers, no invented sync times or latency.


## Phase 2 recheck

On 5 October 2026 the official indexed announcement was rechecked at https://about.fiba.basketball/en/news/introducing-the-road-to-bal-2027 and the French event article https://www.fiba.basketball/fr/events/fiba-africa-champions-clubs-road-to-bal-2027/news/introducing-the-road-to-bal-2027 . They confirm Tripoli 21–25 October, Groups A/B and top two to West Elite 16. The French article explicitly spells Stade Malien; its existing local verification flag was updated with a source-review audit entry. The Arabic/English display name and stable ID are retained. The Algeria spelling remains unresolved.

The announcement names Abidjan for West Elite 16, 10–15 November, but does not establish individual game dates/times or a complete competition classification contract. No new official game IDs, fixture times or rosters were verified. No fixtures/players/scores/statistics were added to the public seed. All visual/lifecycle test data lives in a separate QA database and is not tournament news. Direct event overview/games retrieval failed through the web tool; that is an access limitation, not evidence that FIBA is offline. No new scraping or undocumented API integration was added.


## FIBA is the primary external source (current state)

This section supersedes the earlier statements in this file that no scraping collector or external adapter exists. The older sections above are kept as the record of what was verified on 5–6 October 2026.

### What it is
`lib/providers/fiba/` reads the public FIBA event pages (`/games`, `/standings`, `/leaders`) with a plain HTTP GET (one request per page, identifying User-Agent, 20 s timeout, 5 MB cap, same-host redirects only) and parses the data FIBA embeds in its own HTML (`self.__next_f`). This is HTML parsing of public pages, not a documented API. The pages also expose the address and key of FIBA's internal API; **it is deliberately not used** (undocumented, not licensed to us). No login, no anti-bot handling, no headless browser.

### Commands
- `npm run fiba:sync` — apply to the configured database (SQLite, or Turso when `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are set). Prints the target first.
- `npm run fiba:dry-run` — same planning, writes nothing (does not even create the log tables).
- `npm run fiba:report` — registry comparison, never opens the database.
- `GET /api/cron/fiba` with `Authorization: Bearer $CRON_SECRET` — same as `fiba:sync`; disabled when `CRON_SECRET` is unset.
- `.github/workflows/fiba-sync.yml` — every 10 minutes calls the endpoint. It does nothing unless the repository variable `FIBA_SYNC_ENABLED=true` and the secrets `SITE_URL` and `CRON_SECRET` exist. Ten minutes is the practical floor of GitHub's scheduler: this is **not** a live-score feed.

### What is imported (scope)
Scope is FIBA stage `DW-GP` (Division West group phase), groups matching `settings.groups` (A, B). Other FIBA groups (C, D, East) are ignored.
| Data | From FIBA | Notes |
|---|---|---|
| Teams | name, group | country, logo, Arabic name stay local; new teams only if approved in `aliases.ts` |
| Group membership | group tables | corrects the local `group` of a team |
| Games | teams, date/time (UTC), venue, status, scores | id `fiba-<gameId>`; created only when fully published |
| Results | scores, `Live`/`Scheduled`/`Postponed` | FIBA status codes other than `INIT`, live and postponed are **not mapped** |
| Standings | — | computed locally from games; FIBA tables are only a membership cross-check |
| Statistics / leaders / box scores | — | FIBA publishes none yet; player records are counted, not parsed |

### What stays local
Clock, quarter, running flag and period scores of every game; news, players, media, club profiles, Arabic names, countries, logos, settings, admin accounts. Standings and qualification are always computed locally.

### Precedence and overrides
FIBA is the reference for the fields above. A record that has **any audit entry by a non-system actor** (system actors: `seed`, `fiba-sync`, `import`, `system`, `verified-research-import`, and scripted `source-review:*`) is a manual override and is never overwritten, whole record. Consequence to plan for: the first admin save of a FIBA game (for example the live-scoring console) freezes that game against further FIBA updates. A fixture entered by hand under another id is not duplicated: the FIBA game is skipped and reported. Nothing FIBA stops publishing is deleted.

### Never guessed
Unpublished dates (`0001-01-01`), unassigned group slots, unknown status codes, venues FIBA omits (an existing venue is kept), statistics. They are skipped, counted and logged.

### Team matching
Reviewed links live in `lib/providers/fiba/aliases.ts`; otherwise only exact slug or exact normalised name matches. `nadi-basket-staoueli → nb-staoueli` was added on 2026-10-08 on this evidence: FIBA's group A holds the four local group A clubs plus this one; the local group A has no other unmatched club; FIBA's announcement calls the club "Nadi Staouedi". The local record stays `verified=false` until the club's spelling is confirmed. Red Flames is not on FIBA's page (group B slot 5 is unassigned) and is left untouched.

### Safety
Fail closed: every page is fetched and validated (Zod) before any write; a structural change throws and nothing is stored. All writes of a run share one transaction with the sync log. Every run is in `fiba_sync_runs` / `fiba_sync_entries` (created, updated, unchanged, ignored, skipped, with reasons; failed runs keep the error); every write is also in `audit` with actor `fiba-sync`. SQLite and Turso go through the same code and are tested identically.

### Known limits and assumptions
- Observed on 8 October 2026: FIBA has published 21 teams, group tables (initial draw order, 0 games) and two games of another group with no date. No Tripoli games, results or statistics exist yet, so the first real game/result import is **untested against live FIBA data**; it is tested on fixtures derived from the real payload.
- The embedded payload is an implementation detail of FIBA's site; it can change without notice and will stop the sync (by design).
- The status code of a finished game is unknown until FIBA publishes one. Such games are reported as "unrecognised FIBA status" instead of being guessed. Add the code to `FIBA_STATUS` in `plan.ts` after observing it.
- Cadence is 10 minutes; use the admin console for second-by-second live scoring.

### Legal and usage position (not legal advice)
FIBA's Terms and Conditions (https://www.fiba.basketball/en/terms-and-conditions, read 8 October 2026) contain no explicit prohibition of automated access, and `robots.txt` disallows only login/registration paths. However: 4.2 says content (pictures, graphics, logos, texts, …) "may not be reproduced or modified in any way without prior permission", 4.3 grants no licence, 2.1 forbids undermining the site's functioning and data integrity, and 6.6 requires written approval to link to the site. Team names, fixtures and scores are facts, but databases of them can carry separate rights depending on jurisdiction, and the terms are silent on reuse. This repository therefore imports facts only (no FIBA images, logos, texts or videos) and makes at most three requests per run. **Before relying on it in production, obtain FIBA's (or the event organiser's) written permission or an agreed data feed.** Credentials alone would not establish permission; see the Sofascore and 365Scores sections above.
