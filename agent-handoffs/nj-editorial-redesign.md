# New Jersey atlas design experiment

## What changed

- A larger, blue state title and a county-count link give the opening a stronger hierarchy. The count comes from the existing county geometry response.
- The statewide conveyor uses a deep-blue background with light text and a compact profile control.
- The selected measure, controls, map, and county comparison form one connected workspace. On wide screens, the measure explanation sits beside the controls.
- The map uses a softer coastal background and simpler frame. The comparison table has a stronger heading and sticky column labels.
- Desktop county comparisons scroll within a bounded panel; mobile and print retain the full table. Keyboard focus can reach and reveal the last county.
- Mobile controls use compact label/input rows. Styles remain scoped to the New Jersey page.

## Files/modules affected

- `web/app/page.tsx`: county-count jump link and explorer anchor.
- `web/app/new-jersey.css`: presentation and responsive layout.

## Architectural or implementation decisions

- Use existing components, data, fonts, and tokens. No new dependencies, source queries, or map-engine changes.
- Keep the published chart palettes and data methodology intact. This is a presentation experiment, with no performance claim.
- Preserve the profile conveyor, population definition, computed-data definition, affordability mode, source notes, and accessible county links.
- Keep experimental styles in the existing state-specific stylesheet so county, municipality, ZIP, and report pages retain their presentation.

## Assumptions

- The request authorizes a new experimental UI branch and a reviewable implementation.
- Stronger typography, contrast, and workspace grouping are the intended direction; the draft PR is for visual review before integration.

## New TODOs / limitations

- The wide-screen comparison panel introduces internal vertical scrolling. All counties remain in the DOM, and keyboard access was checked.
- Browser verification used Chromium, including narrow viewports. Native iOS Safari was not tested.
- The existing broad redesign check contains a stale population-card selector, previously recorded in the paused-profile handoff; focused interaction checks were used here.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test`: 280 tests passed across 33 files.
- `cd web && NEXT_PUBLIC_ARTIFACT_URL=https://housing-data.jasonli.app npm run build`: passed; 2,278 static pages generated.
- `cd web && node scripts/check-paused-profile-swipe.mjs`: passed mobile swipes, desktop dragging, keyboard focus, and reduced-motion behavior.
- Playwright checks at 1440, 768, 390, and 320px: no page overflow; all 21 county rows; measure selection and affordability mode switching passed.
- Dark-mode screenshots and computed-data tooltip bounds checked. Last-county keyboard access and uncapped print table passed.
- `git diff --check`: passed.
