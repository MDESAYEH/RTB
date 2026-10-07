# Digital court — ROAD TO BAL / TRIPOLI 2027

Frontend presentation rebuild. No new tournament records, historical claims, business rules, providers or authentication changes.

## Research and exploration
Actually opened Animus Studios, Playbook, UXpert, NBA, BAL and Lando Norris in the browser. Examined composition, scrolling and navigation. EuroLeague returned a security checkpoint, so its visual experience was not assessed.

- [Animus](https://www.animusstudios.com/): one coherent graphic world, expressive type and transitions between surfaces. Borrow the principle of continuity, not its wave pattern or custom letterforms.
- [Playbook](https://www.playbook.com/): a memorable environment around useful product content. Borrow depth and purposeful image placement, not its landscape or interface.
- [UXpert](https://www.uxpert.com/): one confident field of colour and a direct statement. Borrow restraint, not its yellow palette or layout.
- [NBA](https://www.nba.com/) and [BAL](https://bal.nba.com/): score and state must be understood immediately; action photography conveys competition. No official proprietary campaign artwork was copied.
- [Lando Norris](https://landonorris.com/): motion and navigation share the personality of the sport. No WebGL, 3D likeness, assets or interactions were copied.

Three hero treatments were rendered and compared: warm paper, arena ink, and basketball orange. The orange opening gives the clearest energetic distinction. Paper carries editorial reading and tables; ink carries the arena and achievement moments. Exploration screenshots are in verification/design-rebuild.

## Signature grammar

1. An original basketball seam glyph, a three-point arc and a hard baseline. Geometry frames images, anchors team crests and becomes score/fixture separators.
2. The giant host-city wordmark and strong Arabic headlines are equal parts of the campaign. Condensed Latin belongs to names and sports numbers; Noto Sans Arabic carries readable Arabic copy.
3. Orange interrupts; paper supports reading; ink signals arena intensity; acid identifies actual live states and selected journey moments. It never invents a live broadcast.
4. Club pages adapt to verified content: a podium story, league double, continental journey or concise participation. No empty trophy panels.
5. Phone hero and group compositions use their own normal-flow layout; content growth must not collide with graphics.

## Implementation choice
Custom CSS with shared properties and small SVG primitives. Geometric art direction benefits from authored styles; a Tailwind migration would add work without improving this execution. Removed the legacy public stylesheet cascade from the active implementation. Foundation, team/editorial, utility and loading styles have distinct responsibilities. No motion library added.

## Motion and loading
The original ball travels along a baseline while bouncing with compression and a changing shadow. Wordmark clip reveals introduce the event. This is a Next Suspense loading fallback, with no timer delaying the real page. Reduced motion uses a static basketball and readable status. Hover movement and score reveals are restrained; scores animate when their actual value changes.

## Content and assets
Existing registry logos remain; absent assets use initials. Original logo files and colours are retained. Red Flames uses the existing transparency filter. Kriol receives an ink contrast surface; Nabaya retains a light surface. Existing photography is used as supplied reference material; no new external photographs or logos were downloaded.

Existing routes, canonical metadata, ManualProvider, SQLite, SSE, club verification and competition calculations remain in place. Broadcast area is a presentation placeholder, with no fake player or stream.
