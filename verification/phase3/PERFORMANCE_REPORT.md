# Phase 3 performance and release evidence

## Measurement integrity

Production runtime, installed Chrome, cold browser cache, 390×844, CPU 4×, configured RTT 150ms, down 1.6Mbps/up 750Kbps — same settings as Phase 2. Baseline and final public samples were each taken three times, serially. Measurements are local synthetic observations, not field Core Web Vitals or hosting capacity.

The historical Phase 2 5692ms/CLS 0.0591 result was one sample on a fixture homepage containing live games. That sampler did not record its LCP element or dependency timings; an exact retrospective breakdown is unavailable. It must not be equated with the public pre-tournament homepage or advertised as a proved 75% optimization. The historical result is preserved in phase2-original-performance.json. Before Phase 3 edits, actual public homepage samples were 1292/1256/1276ms (median 1276ms), CLS 0.01138.

## Actual LCP and original breakdown

Public LCP is `.hero-type strong`, `<strong>TRI<span>POLI</span></strong>`; text, no hero image. Hero uses original CSS court geometry. In the isolated live-data homepage the smaller compact hero changes the largest element to the heading `مباشر من طرابلس`; context matters.

Representative original public sample (the median-LCP sample):

| Timing | Observed |
|---|---:|
| TTFB / responseStart | 12.7ms |
| LCP | 1276ms |
| Direct LCP resource load delay | 0ms — text has no resource URL |
| Direct LCP resource load duration | 0ms — text has no resource URL |
| Text render delay after TTFB | 1263.3ms |
| Blocking CSS start → finish | 198.1 → 510.9ms |
| Display-font request start → finish | 645.8 → 1282.1ms |
| Display-font dependency discovery after TTFB | 633.1ms |
| Display-font download duration | 636.3ms |

Font dependency timings are separate from the standard text-LCP decomposition and must not be added again to render delay. The LCP candidate can use fallback text while the font loads; CSS/font completion does not prove every millisecond was causally blocked by fonts. Original median TTFB across samples was 14.2ms; median longest main-thread task was 553ms. JSON includes navigation/resource timings and long tasks, not a fabricated isolated hydration duration.

One blocking stylesheet (~8.2KB encoded) precedes text layout. Browser JS had a 114990-byte encoded shared application chunk containing domain schemas/Zod, alongside React/Next runtime chunks of 71576/45185 bytes. Zod was reachable because the public client imported the schema-bearing domain module even though it only needed display calculations. No Framer Motion, analytics or external font/script requests are present. Hero/date/countdown markup is rendered into initial server HTML; CSS below the fold is in the same small stylesheet. Team images use existing lazy image behavior and fixed dimensions; none is a public hero/LCP image. No image compression or visual asset replacement was justified.

## Changes and intermediate checks

1. Use Next local-font loader to preload only the 13768-byte Bebas Neue font. All score/date/Road declarations use the same CSS variable. Font file/weight/display remain unchanged; automatic fallback adjustment is disabled to preserve layout. Intermediate public LCP samples: 1364/1256/1256ms, median 1256ms; CLS 0.00454. Discovery moved earlier; first cold server response explains some sample variability. This is a targeted dependency improvement, not a dramatic LCP claim.
2. Move unchanged transitions/clock/freshness/standings/qualification display logic into public-domain.ts with erased type-only imports. Existing domain exports remain compatible; validation/scoring stays on the server. Public client no longer imports schema initialization/Zod. This is a module dependency boundary, not an architecture rebuild or rules change.

Final public samples: **1308/1208/1228ms**, median **1228ms**, CLS **0.00454**. Encoded JS **156543 bytes**, down **91235 bytes / 36.8%** from 247778. Application chunk becomes 23755 bytes. Shared React/Next runtime remains. Representative final median-LCP sample: TTFB33.3ms, text render delay1194.7ms, CSS209.5→568.8ms, display-font204.1→662.3ms. Font request is discovered ~442ms earlier than representative baseline. Median summed long-task duration fell from1446ms to1103ms, but CPU measurements vary and are not an isolated hydration benchmark.

The existing Phase 2 sampler rerun with current isolated live fixtures produced homepage **1424ms / CLS0.00498**, Match Center **1056ms / CLS0.00862**, JS156543 bytes. This reaches the requested 2.5-second local target; the old 5.69-second outlier was not reproduced. final-fixture-performance.json preserves that result. The separate final-fixture.json profiling run overlapped browser regressions and is diagnostic only, not the primary fair performance comparison.

## Fonts, hydration and PWA controls

Two font families remain: Noto Sans Arabic Variable and Bebas Neue 400. Arabic/Latin variable subsets and Latin display font load on the public homepage: **211144 bytes**. A symbols subset adds14584 bytes on live fixtures: **225728 bytes**, unchanged for the same content. Math/Latin-ext faces are declared but not downloaded in these samples. No duplicate static Arabic weight is loaded by the page; the static Arabic font used by server-side OG rendering is separate. Variable weights support the existing design; no Arabic glyph/weight/quality reduction was made. Font-display remains swap; only display font is preloaded, no below-fold imagery/font family preloads were added.

Final diagnostic controls, one sample each: normal1360ms, JS assets blocked1224ms, fonts blocked1336ms. These controlled modes alter the page and are not shippable optimizations. They demonstrate that hero text is available before hydration and that a huge hero-image delay is absent. They do not isolate a precise hydration cost or retrospectively explain the historical5692ms sample. No-font CLS0 versus normal0.00454 confirms a small font-swap shift remains. Service-worker registration runs from the existing post-mount effect, no third-party registration/bootstrap blocks server HTML, and the actual offline/controller/restart checks still pass. No PWA changes were needed.

## Regression and release

26 unit/integration tests pass; 9 production-runtime browser cases pass (54.3seconds); lint/typecheck/build exit0. Repeated public60 and isolated96 visual views have zero overflow/missing H1/unexpected console/page errors. Mobile and desktop hero, Arabic/RTL and typography inspected; mobile before/after screenshots preserve visual layout aside from countdown time. Existing tests verify reduced motion, navigation, score, offline shell, reconnect and restart. Production smoke: teams10, games0, players/stats0, OG200, no page errors. Final logs have no startup errors. No public QA records were introduced.

Backup/restore runtime verification and functional20-SSE/30-write checks pass again; they do not establish production load readiness. README/VERIFICATION reference the Phase3 evidence and RELEASE_CHECKLIST.md. Checklist covers deployment/secrets/HTTPS/proxy/SSE/backup/restore/storage/restart/devices/official content/operator rehearsals and a bounded hosting-specific load plan. Actual hosting, audience estimate, TLS/proxy/PWA devices and production-storage recovery are not yet verified.

Verdict: **READY WITH BLOCKERS**. Local performance target and regressions pass. Actual hosting operations/capacity and official tournament data remain required before release. No PRODUCTION-READY claim.
