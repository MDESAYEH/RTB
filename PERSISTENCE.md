# Persistence audit and infrastructure decision

Status: preparation implemented; **Vercel production persistence is not implemented yet**. No resources, deployments, production imports, credentials or Vercel settings were changed. The application now refuses local persistence on Vercel with `StorageConfigurationError`. This is a safety boundary, not a working production database.

## Audit (2026-10-07)

`lib/store.ts` previously created the SQLite parent directory, opened a writable database, ran DDL/migrations and seeded records at module import. On Vercel the relative path resolves under the immutable function bundle (`/var/task/data`). `/tmp` cannot retain tournament state between invocations or share it between instances.

Database access is synchronous and uses SQLite-specific JSON functions, partial expression unique indexes, `INSERT OR IGNORE`, positional bindings, integer audit/undo primary keys, PRAGMA migrations (user_version 3), WAL, foreign keys and BEGIN IMMEDIATE. `LocalDatabase.transaction` rolls back exceptions. Business mutations in the admin route perform command deduplication, version checking, score/clock/status/correction/undo, dependent pulse records, audit and revision increments within the same transaction. An async adapter must use one transaction connection for every read and write in that unit; replacing synchronous calls with independent HTTP writes is incorrect.

Tables: records, entity_refs, admins, sessions, audit, undo, revision, rate_limits, commands, club_profiles. References cascade on owner deletion and reject missing target entities. Unique indexes protect news slugs and game/player and game/team stats. There is no media delete API. Historical club records have an independent seed and no tournament revision changes.

The existing database was inspected read-only: 11 records, 13 audit rows, 10 club profiles, one revision row; admins/sessions/commands/undo/rate_limits/entity_refs were empty. These counts do not justify deletion. The snapshot tool preserves every table including future tables, not just nonempty tables.

Sessions use hashed opaque tokens and persisted eight-hour expiry; rate limits persist their counters and expiry; commands deduplicate per actor/requestId for 24 hours. These must share the same authoritative database across functions. SSE polls persisted revision every two seconds, so no global event bus is inherently needed; finite function lifetimes require reconnect, already present in the client. A future async poll must not overlap and must stop on disconnect/failure. Reads after commits must reach the authoritative primary to avoid replica lag affecting control operations.

The public data API is `app/api/data/route.ts` (the broad `data/` ignore pattern hides it from ordinary rg enumeration); consumers also include the catch-all page, OG route, admin CLI, backup tooling and club repository. Domain validation, request byte/origin controls, image validation, login buckets, metadata consumers and test/verification scripts were traced. Static asset reads and local QA artifact writes do not need production writable storage.

`app/api/media` previously wrote beside DATABASE_PATH; GET read from the same directory. A small asynchronous `MediaStorage` interface now isolates local put/get and atomically publishes files. Authentication, persistent rate limiting, upload audit, hash IDs, Sharp decode/re-encode, 5 MB/16 MP limits and existing URLs remain. Missing images return 404; backend failures return uncached 503. Local media remains the only implemented adapter.

No database/object storage provider was found in dependencies, code, `.env.local`, the locally pulled `.vercel/.env.production.local` variable names, or Vercel project config. No remote account settings were inspected. The local Vercel config uses Next.js and Node 24.x; framework/root settings need no change. package.json and lockfile now restrict Node to 24.x.

## Implemented architecture

Store and historical seed initialize at first use, so importing modules/build collection does not create files. SQLite and media adapters reject Vercel before filesystem writes or database creation, even with DATABASE_PATH=/tmp/road.db. Local development and persistent single-host `next start` retain the current SQLite SQL and transaction contracts. No business logic or UI was rewritten. Cloud environment variables deliberately await the approved adapters; invented variables would imply support that does not exist.

## Proposed next implementation

Preferred smallest SQL change: a remote **libSQL-compatible database (Turso libSQL)** with an async transaction-aware implementation, plus **private Vercel Blob** for canonical media. This keeps SQLite SQL/index semantics closest to the existing system. The SDK/provider choice still needs explicit approval; do not silently substitute the newer Turso engine without checking compatibility. Remote access only: no local replicas or sync files in functions.

Alternative: **managed PostgreSQL (for example Neon)** plus private Vercel Blob. It offers PostgreSQL concurrency and ecosystem, but requires translating JSON/index/DDL, conflict syntax, generated IDs and row locking, and testing both local SQLite and PostgreSQL behavior. It is a larger migration for this repository.

Sources: [Turso TypeScript reference](https://docs.turso.tech/sdk/ts/reference), [Turso database import](https://docs.turso.tech/cli/db/create), [Vercel private Blob](https://vercel.com/docs/vercel-blob/private-storage), [Vercel server uploads](https://vercel.com/docs/vercel-blob/server-upload).

Vercel Functions impose a 4.5 MB request body limit, below this application's 5 MB file limit. The final cloud implementation must stage raw uploads directly into private object storage using narrowly scoped authorized upload credentials, then process the staged object on the server with the existing validation and Sharp sanitization, publish only sanitized bytes under their content hash, and audit success. Never expose raw uploads as public canonical media. This requires an internal staged-upload handshake while keeping the visible UI and final `/api/media/<id>` contract. Auditing/publication should be retryable; failed DB auditing may leave an unreferenced immutable object, which needs safe orphan cleanup, not deletion of a shared hash.

## Migration preparation and execution boundary

Run `npm run db:backup` locally with DATABASE_PATH pointing to the source and BACKUP_DIRECTORY to a private off-host backup destination. This uses the SQLite online backup API, including committed WAL data, verifies integrity and foreign keys, copies media, and now writes `manifest.json` with schema version, revision, counts for all tables, database checksum and media checksums. It logs only the backup location and validation status. Repeated runs create independent snapshots and never replace the source. For a migration cutover, stop all writers/uploads while capturing the database/media pair; ordinary online database backup alone cannot make filesystem uploads and SQLite globally atomic.

The provider-specific import tool has **not** been implemented before provider approval. After selection it must import a verified snapshot into an empty destination under a migration lock, preserve all rows/IDs/password hash+salt/audit/revision/undo/commands/rate limits/club profiles and references, and record the source fingerprint atomically so identical reruns are no-ops and different-source reruns refuse overwrite. Admin hash transfer is explicit; revoke old sessions/rotate credentials at cutover. Import media with exact original IDs so record URLs stay valid. Validate row counts, foreign keys, revision and media checksums before enabling writes. Preserve the source/snapshot for rollback. Never copy the live road.db alone or reuse stale WAL/SHM files.

No production migration was run. Production variables, cloud adapter tests, true remote concurrency/version/idempotency tests, staged uploads and a Vercel runtime smoke test remain pending selection. Passing the local checks does not establish cloud correctness.

## Verification of implemented preparation

- `npm test`: 46/46 passed, including production-like import/no-filesystem checks, explicit `/tmp` rejection, rollback/independent connection persistence, session expiry/revocation, concurrent identical media publication and immutable-content conflict, and a snapshot containing committed WAL writes and an unknown future table.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; repeated with VERCEL=1 and DATABASE_PATH=/var/task/data/road.db, also passed. Build imports no longer need a writable database. Requests that need data intentionally fail until a cloud adapter is implemented.
- Next build added its generated route type include paths to tsconfig.json; retained as recommended by the installed framework.

Modified files: lib/store.ts, lib/database.ts, lib/storage-config.ts, lib/club-repository.ts, lib/media-storage.ts, both media routes, scripts/backup.mjs, tests/storage.test.ts, tests/store.test.ts, tests/club-repository.test.ts, package.json, package-lock.json, tsconfig.json, .env.example, README.md and this report.
