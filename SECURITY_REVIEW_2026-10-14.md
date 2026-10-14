# Security review — 14 October 2026

Scope: application source at `59d8dab`, dependencies, unit/integration tests and a small number of unauthenticated, read-only requests to https://roadtobal27.ly. No production login attempts, uploads, record edits, load tests or exploit payloads were sent. Application behavior was not changed during this review.

No high/critical vulnerability was demonstrated within this scope. This is a focused review, not a penetration-test certification. Authenticated production sessions, infrastructure configuration, WAF settings, account security, backups and repository history were not comprehensively audited.

## Findings

| Priority | Finding | Evidence | Recommended action |
| --- | --- | --- | --- |
| Medium | Script CSP permits inline JavaScript without a nonce/hash. This reduces protection if an HTML injection is introduced; no exploitable XSS was identified. | `next.config.ts:22`; same policy observed on production. React renders article text as text, not raw HTML. | Introduce per-request nonces using the installed Next.js conventions; test hydration, navigation, image delivery and embedded players before enforcement. Do not simply delete `unsafe-inline` and break hydration. |
| Medium | HTTPS responses lack HSTS. HTTP currently redirects with 301, but this alone does not protect a first HTTP visit against downgrade/interception. | GET `/`, `/admin`, `/api/admin`, `/api/data`, `/api/cron/fiba`: no `Strict-Transport-Security`; HTTP `/` redirects to HTTPS. | Add HSTS on HTTPS responses after verifying certificate and host coverage. Start with an appropriate limited policy; do not enable preload or includeSubDomains without checking all subdomains. |
| Medium, infrastructure-dependent | Public data/SSE routes have no application-level request or concurrent-connection limit. This can increase resource cost under abuse. Availability impact was not reproduced. | `app/api/data/route.ts:4` reads a snapshot per request; `app/api/live/route.ts:7` opens an unauthenticated stream for up to 240 seconds. Shared revision caching reduces database reads but does not limit connections. | Verify/configure edge rate limits and connection protection; add bounded application handling where needed. WAF/hosting controls were not inspected. |
| Low | No Permissions-Policy header observed. | Production responses and `next.config.ts`. | Explicitly restrict unused camera, microphone and geolocation features, considering any embedded-player requirements. |

## Controls verified

- Unauthenticated `GET /api/admin` and `GET /api/cron/fiba` returned 401.
- `GET /api/media/staging/test` and malformed public media IDs returned 404.
- Mutation handlers check request Origin and authorization. Login throttling trusts client IP only with explicitly trusted proxy/Vercel configuration.
- Password provisioning requires at least 14 characters, uses salted scrypt and constant-time comparison. Session tokens use 32 random bytes; the database stores SHA-256 hashes of tokens. Expiration and revocation are implemented.
- Session-cookie flags in code are HttpOnly, SameSite=Strict and Secure for configured HTTPS, with an eight-hour expiry. A real authenticated production cookie was not issued during this review.
- Authenticated admin snapshots explicitly use no-store; public API snapshots contain public collections and published news, not session/admin/audit tables.
- Upload validation enforces byte/pixel limits, rejects SVG and invalid formats, performs a full image decode and re-encodes sanitized WebP. Staging credentials are scoped, and private media publication is gated.
- CSP frame-ancestors and X-Frame-Options deny framing; nosniff and Referrer-Policy were present. Production CSP does not include unsafe-eval.
- Database writes use validation, parameterized values, transactions and audit trails.
- Tracked-file inventory contained environment examples, not active .env files or database files. This was not a full historical secret scan.

## Validation

- `npm audit --omit=dev --json`: zero reported vulnerabilities.
- `npm audit --json`: zero reported vulnerabilities including development dependencies.
- `npm test`: 87 tests passed, zero failures.
- Dedicated security/private-media tests: 11 passed.
- Browser-driven E2E tests and authenticated production flows were not run for this review.

References: [MDN CSP guidance](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP), [OWASP DoS guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html), [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
