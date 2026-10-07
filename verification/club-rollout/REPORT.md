# Club UI rollout verification

- Ten club profiles use the shared editorial design with claim-dependent sections.
- Historical profile JSON, historical SQLite data and tournament calculation code were not edited.
- Final routes: /teams/[slug]; known /team/[id] paths redirect permanently (308).
- Dynamic verified descriptions, canonical metadata, Open Graph identity and sitemap paths updated.
- 36 unit/integration tests PASS.
- 10 browser tests PASS against an isolated SQLite database (production build/start).
- lint, typecheck and production build PASS.
- 60 viewport checks PASS: ten clubs at 390, 430, 768, 1024, 1440, 1920 pixels. No horizontal overflow, hero name/logo overlap, broken images or page errors.
- Missing registry identity tested with an isolated rendering fixture; initials render and unverified history/empty honours remain absent.
- Existing browser journey selector updated from .hero-actions to the current .court-actions; no Hero changes.
- Existing registry contains ten logo assets: Al Ittihad OWNER_SUPPLIED; nine SOURCED. No new logos downloaded. Owner-approved replacements remain welcome.
- Nabaya/AS Douanes championship claims remain unpublished pending stronger verification; Red Flames has participation identity only.
