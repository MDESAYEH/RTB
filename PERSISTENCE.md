# Vercel persistence: implementation and cutover

The code implements remote Turso/libSQL and **Private Vercel Blob**. No cloud resources, real credentials, production import or deployment were performed. Cloud acceptance remains pending. Node is pinned to `24.x`. The homepage hero also uses the supplied public background; public routes and media URLs are unchanged.

## Root cause and audit

The former eager `lib/store.ts` initialization resolved `data/road.db` inside `/var/task`, created directories, opened writable SQLite and enabled WAL. Vercel's function bundle is not persistent writable storage; `/tmp` cannot share state between instances. The media upload route had the same filesystem assumption. Build success never proved runtime persistence.

The traced tables were records, entity_refs, admins, sessions, audit, undo, revision, rate_limits, commands and club_profiles. SQLite JSON functions, partial/expression unique indexes, foreign keys, generated integer IDs and transaction semantics are retained. An earlier read-only audit found 11 records, 13 audit rows, 10 club profiles and one revision row. This is an inventory, not permission to discard data. No original `data/road.db` was modified by this implementation.

## Actual architecture

`lib/sql-database.ts` opens lazily. Local development uses `node:sqlite`, WAL, FK enforcement and busy timeout. Vercel requires a remote `libsql://` or HTTPS URL and token; no replicas, sync files or `/tmp` fallback exist. The remote SDK is `@libsql/client/web`. `AsyncLocalStorage` binds every query/batch in a mutation to one SDK write transaction. Nested calls reuse that transaction. Score/clock/status/correction/undo, entity references, audit, revision and command receipt either commit together or roll back. Acquisition may retry lock contention; uncertain commits and command bodies are never automatically replayed. Version conflicts and 24-hour actor/requestId deduplication are preserved.

Sessions, limits, receipts, undo and revision live in the same authoritative database. Credential rotation revokes sessions atomically. Public data and its revision are read in one read transaction. SSE polls authoritative revision without overlapping polls, ends after four minutes and relies on existing client reconnect. No global memory holds authoritative application state. Local process queues only avoid blocking the event loop during overlapping synchronous SQLite transactions.

Remote requests never bootstrap or seed an empty database. They require the explicit importer and schema version 5. Local bootstrap performs additive migrations and keeps the existing verified seed. Existing remote version-4 preparation databases are deliberately refused; this first cutover targets a new empty database, not an in-place remote upgrade.

## Private media and staging

Admin POST `/api/media` validates Origin, session and persisted rate limit before creating an owner-bound 15-minute upload record. It signs a five-minute SDK client token restricted to **exactly** `staging/<random-id>`, declared size (at most 5 MB), one accepted MIME, no random suffix and no overwrite. The browser sends raw bytes directly to the private store, bypassing the Function's 4.5 MB body limit. The read-write token never reaches the browser. There is no webhook dependency or arbitrary client-supplied URL fetch.

The completion request authenticates again, checks ownership/expiry, reads the exact staged pathname with authenticated SDK `get()` and bypasses Blob cache. Actual bytes must match the declared size. Existing full decode, extension/MIME checks, 16 MP limit, animation rejection, Sharp resize/metadata stripping and deterministic WebP re-encode remain. Sanitized bytes are stored privately at `media/<SHA-256>.webp`, without overwrite. A database transaction writes audit, publication record and upload result. The server returns the same `/api/media/<id>` URL only after commit; completion retries use the stored result. SQLite development retains bounded 512 KiB private SQL chunks, requiring no external service.

GET `/api/media/[id]` remains public for tournament images, but only serves a cloud canonical object with a committed publication record. It reads Private Blob on a cache miss, verifies its checksum, and returns fixed MIME, nosniff and `public, max-age=31536000, immutable`. Staging paths can never be requested through this route. Failures return uncached 503; missing/unpublished media return uncached 404. No redirect, signed public URL, filename or frontend contract change is needed. This adds Function/database/Blob work on a cold image request; browser/CDN immutable caching reduces repeat reads. This cost is accepted to preserve the contract with the expressly requested Private store.

SQL and Blob cannot share a distributed transaction. A failed audit keeps the staged input retryable and may leave an **unpublished private canonical orphan**. It is not publicly served. Never eagerly delete a shared content hash after failure: another upload/import can use it. Staging is removed only after commit; failed cleanup is safe. `npm run media:cleanup` inventories exact staging IDs older than 24 hours with no live DB lease; `-- --apply` explicitly deletes those objects. It never deletes canonical objects. Run maintenance regularly; expired upload records are also purged on subsequent upload starts. Canonical orphan retention is safe but has storage cost; any future deletion requires an offline reference inventory and a maintenance window.

Authentication uses **BLOB_READ_WRITE_TOKEN explicitly**, rather than OIDC, because the selected scoped-client-token signing API uses the store's read-write token and the same credentials support local migration. The installed SDK supports OIDC for other operations, but this implementation does not claim an OIDC-only upload path. Restrict and rotate the server secret; never use NEXT_PUBLIC variables for it.

## Required configuration

| Variable | Use |
|---|---|
| TURSO_DATABASE_URL | Authoritative remote libSQL database URL; no file URL |
| TURSO_AUTH_TOKEN | Write-capable database-scoped token; server/CLI only |
| BLOB_READ_WRITE_TOKEN | Token for the **Private** store; server/CLI only |
| SITE_URL | Exact HTTPS Preview or Production origin; metadata, Origin checks, secure sessions |
| DATABASE_PATH | Local SQLite only; ignored as a fallback on Vercel |
| ADMIN_PASSWORD | Explicit admin creation/rotation CLI only; do not keep in deployed env |
| TRUST_PROXY_IP | Defaults to 0 (shared persistent global login bucket); set 1 only with a verified proxy replacing X-Real-IP |
| BACKUP_DIRECTORY | Optional local backup command destination, preferably encrypted off-host |

Use separate Preview and Production databases/stores/tokens. Missing/invalid database or Blob configuration fails closed, never by writing `/var/task`. Build collection imports do not need a writable database. Do not use `--from-file` to bypass this tool's credential policy, marker and verification.

## Resource creation: owner actions only

Choose a **libSQL-compatible** Turso database/group in the Dashboard; do not silently substitute another engine. With the owner's installed/authenticated CLI:

```text
turso db create road-to-bal-preview --group <existing-libsql-group> --wait
turso db show road-to-bal-preview --url
turso db tokens create road-to-bal-preview
```

Token creation prints a secret: capture it privately in your secret manager, not a shared transcript. Official references: [Turso create](https://docs.turso.tech/cli/db/create), [token creation](https://docs.turso.tech/cli/db/tokens/create), [transaction API](https://docs.turso.tech/sdk/ts/reference).

Vercel Dashboard → project → Storage → Create Storage → Blob → access **Private**. Connect the store to Preview only first. Obtain/set its `BLOB_READ_WRITE_TOKEN` for that environment and the local import terminal. Alternatively the owner's CLI can run `vercel blob create-store road-to-bal-preview --access private`, then connect it to the project in Dashboard. Do not connect the Preview store to Production. See [Private Blob](https://vercel.com/docs/vercel-blob/private-storage) and [client token constraints](https://vercel.com/docs/vercel-blob/using-blob-sdk#generateclienttokenfromreadwritetoken).

## Backup, import, verification and admin

First stop **all source writers and uploads**. The online backup captures committed WAL; pausing writers makes the database/media pair consistent. In a fresh PowerShell terminal without cloud env:

```powershell
$env:DATABASE_PATH = 'C:\Users\moham\Documents\GitHub\RTB\data\road.db'
$env:BACKUP_DIRECTORY = 'D:\private-road-backups'
npm run db:backup
```

The output names a unique snapshot directory containing `road.db`, `media/` and `manifest.json`. Source is opened read-only. The backup verifies integrity/FKs and records counts/revision/database/media checksums. Never copy a live database alone or delete/reuse its WAL/SHM files. After cutover, `db:backup` intentionally rejects remote-configured environments: use Turso provider backup/export and retain immutable Blob media inventories under an appropriate retention policy.

Set cloud variables privately in the migration terminal; no secrets are included here. Use the actual snapshot directory printed by backup:

```text
npm run db:import -- --source "D:\private-road-backups\<snapshot>\road.db" --media "D:\private-road-backups\<snapshot>\media" --confirm-empty-destination --include-admins
npm run db:verify -- --source "D:\private-road-backups\<snapshot>\road.db" --media "D:\private-road-backups\<snapshot>\media" --include-admins
```

**Media migration is included in that same `db:import` command**: there is no second tool or alternate destination. It validates source checksum/decoding, writes each exact ID to Private Blob and reads it back for byte equality before the database import. The source bytes/URLs remain unchanged. Only an already-sanitized trusted application's snapshot should be imported; this is not a raw-file upload interface.

The CLI requires a backup manifest. It verifies database/media checksums, source integrity/FKs/schema/settings; preserves all source tables, columns, rows, IDs, indexes/triggers and AUTOINCREMENT sequence state, including unknown future tables. It holds one database write transaction (the migration lock) over empty-target recheck, bounded batches, row count/row checksum checks, FK/integrity/revision verification and marker insertion. Version-5 staging/publication tables are additive. Existing club profiles are retained; the historical seed is used only if that table was absent. Media publication records are added for verified canonical images.

Default policy: skip admin credentials unless `--include-admins` is explicit; always revoke old sessions by default. The command above preserves password salt/hash, while leaving sessions empty. Optional `--include-sessions` requires `--include-admins` and is intended only for an explicitly controlled continuity drill. All other state, including audit, undo, commands and rate limits, is preserved. Identical snapshot/options rerun is a no-op; different source/options or nonempty destination refuse overwrite. Never remove the marker to force a new import. A failed media upload does not commit SQL; a failed SQL import can leave private immutable media but no partial tournament import. Large imports exceeding provider transaction duration/row limits fail safely rather than relaxing atomicity.

`db:verify` is read-only: reports per-table counts/checksum status, revision and media byte equality/publication status, without printing records or credential hashes. Run it **before** admin rotation or allowing any target writes, since those intentionally change the snapshot.

After verification, supply a new password via a private environment variable, then run:

```text
npm run admin:create
```

This creates/rotates the admin hash and atomically revokes every existing session. Remove ADMIN_PASSWORD from the terminal environment afterward. No passwords are printed. Preserve original source and backup for rollback; once target writers are enabled, rolling back to an old source loses new results unless reconciled.

## Preview cutover order and pending cloud acceptance

1. Owner creates isolated empty libSQL database and Private Blob store, supplies scoped secrets. No deployment or import is performed by this change.
2. Pause source writers/uploads and produce verified snapshot. Keep source/backup immutable.
3. Owner runs the combined import, repeats identical command to confirm no-op, then runs read-only verification before target writes.
4. Rotate/create admin; set Preview-only cloud env and exact SITE_URL. Owner deploys Preview when separately authorized.
5. With Deployment Protection use `vercel curl <preview-url>/api/data`. Confirm revision/counts, homepage, login/logout, invalid Origin, session sharing and rate-limit persistence across instances.
6. On the isolated Preview, test score/clock/status/correct/undo, same-version competing commands (one 409), requestId replay (one mutation), rollback injected at audit/revision, and SSE reconnect after Function lifetime. Verify no local filesystem persistence.
7. Upload a real 5 MB JPEG/PNG directly into private staging; confirm unauthenticated handshake denied, stolen/wrong path/oversize/expired token rejected, raw Blob URL inaccessible publicly, malformed/16 MP+ input rejected, sanitized metadata removed, canonical ID verified, audit failure unpublished, retry once, final media GET publicly cached. Measure cold image Function latency/cost. Test cleanup dry run, then explicit cleanup on a disposable fixture.
8. Only after cloud acceptance and a new explicit authorization, repeat with distinct Production resources and a fresh frozen snapshot. Never reuse an active Preview database as Production.

## Verification evidence and limits

Local suite: 51/51 passing, including an isolated worker with 8 real SQLite/native-libSQL scenarios (rollback across all five mutations, independent instances, versions, idempotency, shared sessions/limits, revision, full import and late import failure). SDK token signing and Sharp sanitization run for real. Blob I/O and failure tests use injected operations: these prove application behavior, not Vercel service behavior. Browser/HTTP regression and final lint/typecheck/build results are recorded after final verification.

**Still pending:** actual Turso HTTP locking/FK/SQL compatibility, service transaction limits and commit-loss handling; actual Private Blob token enforcement/read/cache/latency; protected Vercel Preview multi-instance runtime and upload tests. These need owner-created isolated resources and credentials. Successful local tests or build do not establish cloud correctness.
