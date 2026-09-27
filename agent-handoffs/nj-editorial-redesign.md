# New Jersey atlas design experiment

## What changed

- A larger, blue state title and a county-count link give the opening a stronger hierarchy. The count comes from the existing county geometry response.
- The statewide conveyor uses a deep-blue background with light text and a compact profile control.
- The selected measure, controls, map, and county comparison form one connected workspace. On wide screens, the measure explanation sits beside the controls.
- The map uses a softer coastal background and simpler frame. The comparison table has a stronger heading and sticky column labels.
- Desktop county comparisons scroll within a bounded panel; mobile and print retain the full table. Keyboard focus can reach and reveal the last county.
- Mobile controls use compact label/input rows.
- After visual sign-off, the atlas language was extended to county, municipality, ZIP, standalone affordability, and source-history pages. Local profiles use a deep-green conveyor, larger editorial titles, a quieter report link, and connected cost cards. ZIP pages get the heading and cost treatment without a profile conveyor where no profile exists.
- The affordability tool keeps its orange identity while its map and county list become a connected atlas workspace. Freshness and revision history use blue ledger headings and grouped table cards. Reports deliberately retain their paper and print presentation.

## Files/modules affected

- `web/app/page.tsx`: county-count jump link and explorer anchor.
- `web/app/new-jersey.css`: presentation and responsive layout.
- `web/app/atlas-pages.css`: scoped treatments for local profiles, the standalone tool, and source-history pages.
- `web/app/layout.tsx`: load the scoped continuation stylesheet.
- `web/app/regions/[id]/page.tsx`, `web/app/afford/page.tsx`, `web/app/freshness/page.tsx`, `web/app/changes/page.tsx`: page scope classes; revision batches marked for ledger styling.

## Architectural or implementation decisions

- Use existing components, data, fonts, and tokens. No new dependencies, source queries, or map-engine changes.
- Keep the published chart palettes and data methodology intact. This is a presentation experiment, with no performance claim.
- Preserve the profile conveyor, population definition, computed-data definition, affordability mode, source notes, and accessible county links.
- Keep the state-specific map layout in `new-jersey.css`. The follow-up uses a separate screen-only stylesheet with explicit page scopes, so the local and data pages can share the visual system without changing report print output.
- Preserve existing affordability calculations, source-status colors, table columns, definitions, carousel interaction, and cost methodology. No new data or dependencies are introduced.

## Assumptions

- The request authorizes a new experimental UI branch and a reviewable implementation.
- Stronger typography, contrast, and workspace grouping are the intended direction; the draft PR is for visual review before integration.
- “Other pages where applicable” includes local profiles, standalone affordability, and source history. Print-ready reports are intentionally excluded from the large-title and connected-card treatment.

## New TODOs / limitations

- The wide-screen comparison panel introduces internal vertical scrolling. All counties remain in the DOM, and keyboard access was checked.
- Browser verification used Chromium, including narrow viewports. Native iOS Safari was not tested.
- The existing broad redesign check contains a stale population-card selector, previously recorded in the paused-profile handoff; focused interaction checks were used here.
- The affordability county list now has a bounded desktop scroll area; it is uncapped on narrow screens. Table rows remain present and reachable. Native iOS Safari has not been checked.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test`: 280 tests passed across 33 files.
- `cd web && NEXT_PUBLIC_ARTIFACT_URL=https://housing-data.jasonli.app npm run build`: passed; 2,278 static pages generated.
- `cd web && node scripts/check-paused-profile-swipe.mjs`: passed mobile swipes, desktop dragging, keyboard focus, and reduced-motion behavior.
- Playwright checks at 1440, 768, 390, and 320px: no page overflow; all 21 county rows; measure selection and affordability mode switching passed.
- Dark-mode screenshots and computed-data tooltip bounds checked. Last-county keyboard access and uncapped print table passed.
- `git diff --check`: passed.
- Follow-up: `cd web && npm run typecheck` passed; `npm test` passed (280 tests, 33 files); production build passed (2,278 static pages).
- Follow-up: Chromium checks at 1440, 390, and 320px across county, municipality, ZIP, affordability, freshness, revisions, and report routes found no page-level horizontal overflow. Light and dark phone captures were inspected.
- Follow-up: paused profile swiping/dragging, keyboard focus, and reduced-motion checks passed at 320, 390, and 1440px. The cost down-payment selector changed the displayed amount, and the source table scrolled within its card.
- Follow-up: all 21 affordability county links remained in the bounded desktop list; focusing the last link scrolled the list from 0 to 358px.
