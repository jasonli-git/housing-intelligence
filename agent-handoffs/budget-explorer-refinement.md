# Budget explorer refinement

## What changed

- Made `/afford` the shared budget destination. NJ now links to it instead of replacing its county comparison with an embedded calculator.
- Global navigation explicitly opens all New Jersey. County/municipality household links retain their county context; cost-card comparison links explicitly open statewide while keeping the selected place.
- Old NJ `?mode=afford` URLs forward their query parameters to `/afford` after hydration.
- Reworked the budget page around visible search scope, household controls and a monthly-budget headline. Extra assumptions and one-place checks use disclosures.
- Mobile starts with results and offers List/Map buttons rather than stacking both. Mobile status text sits beneath place names, preserving incomplete-estimate warnings without an extra wide column.
- Budget map controls are zoom in, zoom out and reset. Removed national framing/crosshair controls from this variant, not the general NJ map. Scoped town colouring follows the selected county; other towns are disclosed as background context.
- Population is unboxed residents metadata in the existing place-type header row. Estimate year, five-year growth and sampling qualifications remain in the floating definition.
- Slightly reduced NJ comparison-table numeric padding and outer padding to give county names breathing room without shrinking their font.

## Files/modules affected

- `web/components/AffordExplorer.tsx`: scope, headline, disclosures, responsive views and contextual map colouring.
- `web/components/GlobeMap.tsx`: optional budget control variant, reset to selected place or NJ, contextual help.
- `web/app/afford/page.tsx`, `web/app/budget-explorer.css`, `web/app/layout.tsx`: shared destination and styling.
- `web/components/StateModeWorkspace.tsx`, `web/app/states/new-jersey/page.tsx`: remove embedded explorer/data payload and preserve legacy query arrivals.
- `web/components/Masthead.tsx`, `web/components/CostToOwn.tsx`, `web/app/regions/[id]/page.tsx`: explicit budget entry scopes and quieter population presentation.
- `web/lib/budgetExplorerUi.test.ts`: server-rendered scope and empty-state checks.

## Architectural or implementation decisions

- This is a presentation/navigation experiment. Existing affordability rules, shared browser-saved assumptions, upfront estimates, missing-cost suppression, sources and cost-card calculations were not changed.
- A visible Where selector and Searching label explain scope. Search all New Jersey widens results while retaining the picked place for comparison. Selecting All New Jersey in the selector clears the picked place.
- The existing arrival parser continues to resolve municipality IDs to their county, honour explicit `county=all`, and reject invalid IDs. No new server API or dependency.
- The mobile List/Map control is native buttons with pressed states; results and map share calculations. Desktop shows both. Print restores lists regardless of mobile selection.
- Existing unused legacy county-workspace/toggle components are not deleted; active profile pages already do not render them. No duplicate mini calculator was introduced.
- No canonical project documents, generated readings or backend files changed.

## Assumptions

- The approved direction is one budget explorer with local starting contexts, not separate county/municipality tools.
- Population remains useful as context but should not compete with primary housing figures.
- Only NJ has published coverage; nearby means the municipality's containing county, not a computed radius or travel-time area.

## New TODOs / limitations

- Scope changes within the explorer remain local state (as before); the original arrival query is not rewritten for every selection. Reload re-applies that arrival scope. Saved income/assumptions remain shared with cost cards.
- Legacy NJ forwarding requires hydration because the site uses static export; the normal NJ comparison remains available without JavaScript.
- The map still fetches/unpacks its file when the explorer loads, even if mobile starts on List. Deferring that payload can be a separate performance task.
- Physical iPhone/Safari and assistive-technology audits were not performed. Headless Chromium covered responsive layouts and focusable population definitions.
- No frontend lint script is configured. Backend tests were not run for this frontend-only change.
- The existing local build warning about unset `NEXT_PUBLIC_ARTIFACT_URL` remains; production deployments need their artifact origin configured.

## Verification

- `cd web && npm test`: 445 tests passed in 55 files, including two new presentation tests and existing affordability/scope/calculation tests.
- `cd web && npm run typecheck`: passed.
- `cd web && npm run build`: passed, 2,379 generated pages, local artifact-origin warning as above.
- `git diff --check`: passed.
- Temporary headless Chromium QA at 1440px desktop / 390px mobile: empty-income start; income entry; county selection; statewide escape; own/rent switching; list/map visibility; map reset; municipality arrival; legacy NJ redirect; population tooltip focus. No page errors or page-level horizontal overflow.
- Browser testing exposed an ambiguous accessible name for the Where select, fixed with an explicit aria-label. An initial screenshot taken during responsive repaint was blank; waiting for reflow verified the list renders. Mobile status placement was then refined to remove internal horizontal scrolling.
- Temporary QA scripts/screenshots remained in `/tmp`, not the repository.
