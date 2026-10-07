# Historical club data — 2026-10-07

The logo registry is independent of historical evidence. Existing tournament IDs and routes are preserved. Claims are published only when their own sources are verified, regardless of the aggregate team status.

| Team | Status | Published honours | Review only |
|---|---|---|---|
| Al Ittihad | VERIFIED | 18× LIBYAN CHAMPION; 2023 LIBYAN CUP | None |
| Stade Malien | VERIFIED | 2023 BAL — 3RD PLACE; 1972 AFRICAN CLUB FINALIST; 1989 AFRICAN CLUB FINALIST; 19× MALI NATIONAL CHAMPION; 25× MALI NATIONAL CUP | None |
| NB Staouéli | PARTIALLY_VERIFIED | 4× ALGERIAN CUP; 2025 ALGERIAN CHAMPION; 2× LEAGUE + CUP DOUBLE | domesticHonours: 3 league titles (2007, 2022, 2025); recentAchievements: 2026 Cup runner-up |
| Nabaya Sofas | PARTIALLY_VERIFIED | None | city: Kankan; domesticHonours: 2026 first Guinea league title; Moussa Diabaté MVP; domesticHonours: 2026 Cup / league and cup double |
| Kriol Star | VERIFIED | FIRST CAPE VERDE ROAD TO BAL TEAM; 2025 BAL PARTICIPANT; CHAMPION IN FIRST SEASON | None |
| Spintex Knights | VERIFIED | FIRST GHANAIAN ELITE 16 CLUB | recentAchievements: 2023 top-division champion |
| AS Douanes | PARTIALLY_VERIFIED | None | domesticHonours: 2024–25 champion; USFA 51–29 |
| Énergie BBC | VERIFIED | 2026 BENIN MEN’S CHAMPION | keyFacts: Nour Seydou Diallo — season MVP |
| NPA Pythons | VERIFIED | 2026 LIBERIA FIRST DIVISION CHAMPION | historicTitleCount: 3; domesticHonours: 2007 and 2019 titles |
| Red Flames | NEEDS_REVIEW | None | possibleLocalName: Archibald Red Flames |

## Corrections
- Stade Malien Tripoli qualification: event year 2024, season 2025.
- Kriol Star: 2024 is the competitive basketball team, not the foundation. BAL 2025 participation is supported by a separate FIBA participant announcement.
- NB Staoueli: Radio Algerienne full text confirms four cups and two doubles; total league title count remains review-only.
- Nabaya: federation mirror is secondary; first title, MVP and double remain review-only until direct primary evidence.
- AS Douanes: Burkina Faso identity; secondary league title not published as verified.
- Red Flames: no city, founding date, arena or title count invented.
- NPA: 2026 title verified; aggregate three titles not published.

## Storage
`club_profiles` is a separate SQLite table with one validated JSON body per existing team ID. Initial insert is idempotent and never overwrites existing profiles. Tournament tables/revision/standings/SSE are untouched. `lib/club-data/profiles.json` is the sourced manual fallback; `lib/club-repository.ts` reads SQLite. Future profile edits should use an authorized audited write path; this phase does not add an Admin editor.

## Verification
33 automated tests pass; lint, typecheck and production build pass. Ten existing team routes checked at 390px with no horizontal overflow.
