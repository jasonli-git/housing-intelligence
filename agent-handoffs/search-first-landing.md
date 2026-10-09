# Search-first landing experiment

## What changed

- Combine the landing page's place search and national coverage map into one area below the project introduction. Search is initially foregrounded over a softly blurred map; “Explore by state” reveals the existing map and controls. “Search for a place” switches back.
- Remove the separate upper search and “Try Princeton or 07030” text. Keep the concise coverage limit and direct New Jersey entry visible.
- Render “Detailed coverage available now” in the neutral secondary text colour, distinct from New Jersey's blue link.

## Files/modules affected

- `web/app/page.tsx`: one combined “Find your place” section.
- `web/components/NationalCoverageMap.tsx`: optional `searchFirst` mode, reused `PlaceSearch`, reveal/return controls and focus management.
- `web/app/ui-refinement.css`: neutral label, responsive overlay, restrained reveal transition and reduced-motion handling.
- `web/scripts/check-ui-refinement.mjs`, `check-accessibility-interactions.mjs`: search/map mode and retained interaction checks.

## Architectural or implementation decisions

- Keep both the map and search mounted, preserving search text and map viewport through switches. No duplicate place search, new map engine, dependency or backend change.
- Blur is decorative, not the access-control mechanism: the background map is `inert` and `aria-hidden` while searching. Revealing transfers focus to the map (or return button if geometry is unavailable); returning transfers focus to the search without a forced page scroll.
- Search suggestions can extend beyond the foreground panel without being clipped by the outer atlas. The map's own geometry remains clipped to its viewport.
- Keep the direct New Jersey link outside the gated map for immediate navigation, unavailable geometry and no-JavaScript visits. The existing search and map still require JavaScript for their interactions.
- Preserve zoom/pan, state entry animation, geography colours, source notices and the national benchmark pair. Reduced-motion preferences disable the blur transition.

## Assumptions

- User requested a working experiment on the existing `experiment/ui-density-discoverability` branch, not a new branch or production deployment.
- This tests the proposed search-first hierarchy; it does not imply additional state coverage or change place results.
- Canonical documents, Director Notes and data remain unchanged.

## New TODOs / limitations

- Reader review is still needed to decide whether an initially blurred map is inviting or feels unnecessarily gated. Switching requires an explicit action; direct New Jersey navigation never does.
- First-load geometry can arrive after mode switching. In that case focus goes to the return button rather than an unavailable SVG; the map remains reachable in normal keyboard order once loaded.
- Automated audits supplement rather than replace screen-reader/device review.

## Verification

- `npm run typecheck` — passed.
- `npm test` — 556 tests passed across 78 files.
- `npm run build` — passed; 2,386 static pages, using the running local API. Port 3002 serves the updated export; no production deployment.
- `A11Y_ORIGIN=http://localhost:3002 npm run check:ui-refinement` — passed. One search, inert/hidden map, removed example text, focus transfers, preserved query/zoom, neutral availability label, and 1280/390/320px layout checks in both themes. Revealed-map mobile axe checks passed in both themes. Screenshots under `/tmp/housing-ui-refinement/search-map-*` and `revealed-map-*` reviewed for desktop/mobile presentation.
- `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/' A11Y_OUTPUT=/tmp/search-first-a11y.json npm run check:a11y` — eight states passed: desktop/mobile, light/dark, closed/expanded. No automated axe violations, application errors or page overflow; incomplete/manual checks remain manual.
- `A11Y_ORIGIN=http://localhost:3002 npm run check:a11y:interactions` — passed; revealed-map keyboard movement, theme/search/disclosure focus, 12 expanded routes at 320px, unique IDs and no-JavaScript report fallback.
- `git diff --check` — passed. No backend tests run for this presentation-only follow-up; no separate frontend linter configured.
