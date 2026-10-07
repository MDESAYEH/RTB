# Additive integration proposal — NOT installed in production

The current SQLite store uses `records(kind,id,body)`, entity references, audit and revision. Preserve it. Proposed additional record kinds: `clubHistory`, `historicalMeetings`, `broadcasts`, `assetProvenance`. Reference canonical tournament team IDs; keep readable slugs separate from IDs (especially Burkina Faso AS Douanes vs Senegal). Map existing IDs deliberately during a later migration. No migrations or production imports in this phase.

- Tournament: existing teams/games/events/stats remain authoritative and unchanged.
- Club history: men’s section, official/Arabic name, city, founded year with multisport/section scope, bio, sourced honours, verification metadata. Counts carry an as-of date; do not imply a historical total is current.
- Head-to-head: canonical clubs, MEN, ISO date, competition, score, decisive/exceptional status, evidence. Only VERIFIED decisive games contribute to wins and percentages. Cancelled/unresolved records remain separate. `lastMeeting` derives from the latest eligible date, not manual duplicate fields. Sparse research does not prove a first-ever meeting.
- Broadcast: game ID, platform, URL, embed ID, NOT_AVAILABLE/SCHEDULED/LIVE/ENDED, broadcaster, verification, sources. Provider registry will map supported verified providers to safe official embed origins; arbitrary URLs never become iframes. No provider enabled here. Match status and broadcast status are independent. Live match with unavailable broadcast remains placeholder; ENDED can show approved replay later in the same 16:9 media slot.
- Assets: identity verification and reuse permission are separate. REFERENCE_ONLY is never publicly promoted. Store source page, exact asset URL, checked date and later permission evidence.

ManualResearchProvider demonstrates separate read interfaces for club history and historical meetings. A future ManualProvider extension can implement them without changing SQLite/SSE. Historical meetings must never be passed to standings, tournament stats or current record calculations.

Later Admin integration must reuse existing authorization, CSRF, transactional audit and conflict rules. Historical edits require evidence; draft NEEDS_REVIEW records remain hidden publicly. Slug aliases/redirects preserve current `/team/[id]` while canonical `/teams/[slug]` is added. SEO metadata will use verified identity only. Admin, redirects, metadata and production integration are intentionally deferred until design approval.

Tests in this folder exercise the draft model, calculations and four visual previews; they do not prove production Admin/SEO integration. No production database is opened by these files.
