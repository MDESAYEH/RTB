# Assets, Team Identity and Header Prototype

## A. FIBA study
Opened the requested FIBA teams page in a real browser, desktop and 390px. Observed event logo/date separation, section navigation, Teams active marker; mobile uses a compact identity and bottom navigation. Desktop header left the viewport when scrolling. Our deliberate choice: two levels, persistent 54px sports navigation and native dark mobile modal. No copying of colors, fonts, icons, exact layout or institutional affiliation claims. Source: https://www.fiba.basketball/en/events/fiba-africa-champions-clubs-road-to-bal-2027/teams

## B. Inventory
See ASSET_INVENTORY.md and JSON: 14 files including five owner-labelled institutional marks, Al Ittihad club SVG, three app icons, campaign image and PWA support. Originals untouched.

## C. Team logo status
Al Ittihad: OWNER_SUPPLIED / public/al-ittihad.svg. Nine pending: Stade Malien, NB Staouéli, Nabaya Sofas, Kriol Star, Spintex Knights, AS Douanes Burkina Faso, Energie BBC Benin men, NPA Pythons, Red Flames. External reference logos from previous research are not rendered here. No logo search or downloads. Historical verification matrix preserved independently.

## D. Header
Desktop: identity 88px + navigation 54px. Scroll: identity moves out naturally, same navigation remains 54px without height changes. Mobile: 76px identity/menu; native dialog full height, safe-area padding, Escape, focus trapping/restoration, body scroll lock. Active underline/marker plus aria-current. No animation library.

## E. Routing
Home /; Matches /matches; Standings /standings; Teams /teams; Stats /stats; The Road /the-road; News /news. Main sections redirect from the prototype to the existing app on 3000; no fake pages. Detail preview /teams/[slug] and /matches/demo-live are isolated on 3032. Existing production team detail route remains /team/[id]; canonical migration is deferred until approval.

## F. Identity
Single source lib/team-identity.json; typed lib/team-identity.ts lookup by existing tournament ID or slug. Energie ID energie-bc maps to slug energie-bbc; Burkina AS Douanes retains existing ID. Semantic separate logo/name links, no nested anchors. New assets must be assigned explicitly, no filename guessing. Prototype reference histories are never written to SQLite.

## G. Verification
26 existing unit/integration PASS; 9 existing browser PASS on isolated e2e-isolated.db; 3 identity tests PASS; 40 new browser checks PASS; typecheck PASS. Widths 360,390,412,768,1024,1440. Tests cover route responses, active mapping, sticky, menu keyboard/Escape/focus/body lock, reduced motion, fallback, no nested links, image failures and page errors. Production app/runtime files untouched.

## H. Screens
Six viewport PNGs in this directory: home-desktop-top, home-desktop-sticky, home-mobile-closed, home-mobile-menu, team-desktop, match-desktop.

## I. Changes
New lib/team-identity.json, lib/team-identity.ts; isolated verification/navigation-prototype assets inventory, header HTML/CSS/JS, route model, server, tests and screenshots. Previous prototype model.test.ts received typing-only fixes so repository typecheck passes. No approved design source files changed.

## J. Blockers / stop
Owner must supply nine club assets and explicitly identify each. Header approval before app-wide rollout. Existing /team/[id] to /teams/[slug] canonical integration requires next approved step. No production integration, no redesign expansion.

Lint PASS. Earlier screenshot capture script received an unused-variable alias only; rendering unchanged. Prototype test harness collects both console.error and uncaught page errors. Original Next pages were exercised with DATABASE_PATH pointing only to the isolated route-test/e2e databases.

## Logo follow-up — 06 Oct 2026
Owner subsequently authorised internet/FIBA club logo sourcing. Nine waiting logos have now been installed centrally; prior waiting-status section is historical. See verification/club-logos/manifest.json. Public Badge now reads registry fallback while preserving admin-supplied logos. No Header/Hero redesign.
