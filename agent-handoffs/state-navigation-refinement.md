# State navigation refinement

## What changed

- Removed the redundant United States framing shortcut from the national landing map; zoom and reset remain.
- Added Northeast, Midwest, South and West geographic framing buttons, using Census regions rather than time zones.
- Added a searchable, alphabetical Explore counties disclosure on New Jersey, available in both comparison and budget modes. It links directly to all 21 published county pages.
- Simplified NJ map filters into one grouped measure selector and the existing time-window controls. Moved the selected measure's definition into About this measure, alongside its existing window caveats.
- Made NJ's statewide evidence expansion blue, leaving county/municipal evidence styling unchanged.

## Files/modules affected

- `web/components/NationalCoverageMap.tsx`, `web/lib/coverageMap.ts` and its tests: geographic region framing and controls.
- `web/components/CountyPicker.tsx`, `web/lib/countyPicker.ts` and its tests: native disclosure, filtering and page links.
- `web/components/StateModeWorkspace.tsx`, `web/app/states/new-jersey/page.tsx`: county catalogue loading and navigation placement.
- `web/components/CountyExplorer.tsx`: streamlined filters and expandable definitions.
- `web/app/state-navigation.css`, `web/app/page.tsx`: scoped national/NJ styling.

## Architectural or implementation decisions

- Region membership follows the [Census geographic hierarchy](https://www.census.gov/programs-surveys/economic-census/guidance-geographies/levels.html). Buttons frame geography, not available housing data. Only New Jersey remains a navigable state destination.
- Regional framing uses the national map's existing projection and bounded viewport; no new geometry downloads or continuous animation loop.
- Alaska and Hawaii belong to West but remain outside the existing contiguous-US map. This is disclosed below the map.
- County destinations come from the existing region catalogue, not the selected measure's ranking. Missing metric coverage therefore cannot hide a published county page.
- The county picker uses native details/summary with normal-flow content, real links, a labelled search field, Escape-to-close and focus return. It is not a modal or overlay.
- All selected measure definitions and time-window caveats remain available. Existing ranking mathematics, time-window availability, radio keyboard navigation and budget calculations are unchanged.
- No dependencies, backend code, generated readings, source data or canonical documentation were changed.

## Assumptions

- Regional browsing is preferable to time zones for discovering places; it does not suggest national housing coverage is already implemented.
- An explicit Explore counties entry is clearer than relying solely on the map's county interaction.
- This is an experimental design for review, not a deployment.

## New TODOs / limitations

- The landing map still omits Alaska/Hawaii; a future national coverage expansion should design appropriate insets or a whole-country framing strategy.
- County search is name-only and does not add municipality/ZIP search; the existing global search remains responsible for those destinations.
- Headless Chromium checks are not physical iPhone/Safari testing or a full accessibility audit.
- No backend tests were run because this change is frontend-only. The frontend has no lint script configured.
- Local production build warns that `NEXT_PUBLIC_ARTIFACT_URL` is unset, so artifact download links target localhost. Set the published artifact origin for a deployment; this branch does not change deployment configuration.

## Verification

- `cd web && npm test`: 443 tests passed in 54 files, including four new region/picker tests.
- `cd web && npm run typecheck`: passed.
- `cd web && npm run build`: passed; 2,379 static pages generated. Local artifact-origin warning noted above.
- `git diff --check`: passed.
- Temporary headless Playwright checks at 1440px desktop and 390px mobile: national region selection/reset; removal of redundant framing shortcut; 21 county links; Somerset filtering; Escape close; measure definition expansion; comparison/budget switching; mobile map reload; light/dark styling. No page errors in the first cross-page run and no horizontal overflow at either viewport.
- One additional mobile QA attempt timed out while the production build was concurrently loading the local API. Rerun after the build passed and confirmed the map loads after mode switching; this was not treated as a passing attempt.
- Temporary QA scripts/screenshots stayed under `/tmp`; no full screenshot automation pipeline was added.
