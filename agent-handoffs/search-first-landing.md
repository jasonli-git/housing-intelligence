# Search-first landing experiment

## What changed

- Combine the landing page's place search and national coverage map into one area below the project introduction. Search is initially foregrounded over a softly blurred map; “Explore by state” reveals the existing map and controls. “Search for a place” switches back.
- Remove the separate upper search and “Try Princeton or 07030” text. Keep the concise coverage limit and direct New Jersey entry visible.
- Render “Detailed coverage available now” in the neutral secondary text colour, distinct from New Jersey's blue link.
- Approved visual follow-up supersedes the initial blurred-map treatment: remove blur and the foreground panel border/shadow. Render the same state geometry as a fine-line, stippled atlas behind the integrated search. State boundaries trace once on entering search mode; a slow decorative line loops across the composition. New Jersey retains blue. Rename the action “Explore the map” and add a native SVG map icon.

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
- Preserve zoom/pan, state entry animation, geography colours, source notices and the national benchmark pair.
- The subsequent drawn-atlas treatment uses existing SVG geography, a small SVG stipple pattern and CSS animation; no additional geography download, image asset, JavaScript animation loop or package. Guide lines and the moving accent are decorative, not broadband coverage, migration, routes or other measurements. All are inside the already-hidden preview map.
- Exploration restores the existing filled/raised map, controls and land backdrop; SVG colour/opacity changes transition for 300ms. Reduced motion disables tracing, decorative motion and transitions. The artwork adds no page-height block and replaces—not layers over—the locked-looking blur/card design.

## Assumptions

- User requested a working experiment on the existing `experiment/ui-density-discoverability` branch, not a new branch or production deployment.
- This tests the proposed search-first hierarchy; it does not imply additional state coverage or change place results.
- Canonical documents, Director Notes and data remain unchanged.

## New TODOs / limitations

- User rejected the blur's locked/paywalled implication and approved the illustrated atlas instead. Reader review is still needed for its contrast/composition. Switching still requires an explicit action; direct New Jersey navigation never does.
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
- Drawn-atlas revision: reran typecheck, all 556 tests/78 files, 2,386-page build, focused UI checks and the full interaction audit successfully. New assertions verify zero CSS blur, no foreground panel border/shadow, tracing animation and looping decorative accent with normal motion, and static artwork with reduced motion. Desktop dark and mobile light screenshots reviewed.
- Final atlas audit: `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/' A11Y_OUTPUT=/tmp/drawn-atlas-a11y.json npm run check:a11y` — all eight states passed with no automated axe violations, application errors or overflow. Revealed-map mobile axe checks also passed in both themes. Manual/incomplete checks are not claimed as passes.
