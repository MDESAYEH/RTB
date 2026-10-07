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
