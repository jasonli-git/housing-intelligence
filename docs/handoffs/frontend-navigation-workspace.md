# Frontend navigation and workspace refinement

## What changed

- Shared navigation now prioritizes Explore, Compare, Budget and Stories; Buyer’s Guide, Property Tax and Housing Help live in Tools. Small screens expose the same destinations through Menu, alongside search and theme controls.
- Place cost cards align the ownership and rental headline figures. The ownership breakdown occupies a shared row below them. Supporting profile decoration and the curved cash-comparison decoration are removed.
- Down payment joins income, cash and rent in Make it yours. Purchase price and advanced assumptions now follow those controls, retaining the existing monthly-bill feedback, reset and guide-transfer behavior.
- Comparison starts with five principal measures; a topic selector exposes the existing groups or all figures. Table headings remain visible within a bounded scrolling region. Mobile shows the starting place and one selectable alternative while retaining all four URL selections.
- Published metric differences appear only for matching units, observation windows and geographic levels; percentage shares use percentage points. Missing observations remain missing, survey margins stay visible, and the explanation distinguishes arithmetic differences from significance tests.
- Mobile atlas adds Map/List controls without clearing selected place, filters or comparison picks. View place and Add to comparison sit together in the selected-place preview.
- Masthead and ReaderDetails now own basic layout/interaction styling in scoped modules; native details, source links, print disclosure behavior and existing report overrides remain.

## Files/modules affected

- `web/components/Masthead.tsx`, `Masthead.module.css`, `ReaderDetails.tsx`, `ReaderDetails.module.css`
- `web/components/CostToOwn.tsx`, `CostToOwn.test.tsx`, `web/app/place-overview.module.css`
- `web/components/ComparePlaces.tsx`, `ComparePlaces.test.tsx`, `web/app/compare/compare.css`
- `web/components/HousingAtlas.tsx`, `web/app/atlas/atlas-horizon.css`
- `web/lib/mastheadBudget.test.ts`, `web/scripts/check-place-polish.mjs`

## Architectural or implementation decisions

This is an incremental implementation of the approved design direction on the existing task branch. It reuses published packets, the existing ownership engine, atlas selection state and budget-transfer mechanisms. No new data service, overall place score, persistence scheme or dependency was introduced. Comparison uses a topic selector instead of nesting multiple disclosures around tables. The initial overview contains home value, rent, ownership cost, household income and commute time.

## Assumptions

- Explore leads to the existing atlas; specialist routes remain available in the shared menu.
- The first comparison place is the baseline. On phones the second visible place can change without losing the other selections.
- Preview data comes from existing `dist/artifacts` served at localhost:8093, with API on 8000. This is a local build configuration, not a production deployment.

## New TODOs / limitations

- User testing with actual visitors has not been performed. Validate finding a place, comparing alternatives and adjusting a budget before further structural changes.
- This starts stylesheet consolidation with two shared components; it does not migrate every legacy chart and page to a new design system.
- Comparison displays arithmetic differences, not statistical significance. Ownership estimates are intentionally not assigned a difference because missing cost coverage and home-price bases can differ.
- Printing the comparison reflects the current topic and rendered columns. All saved selections remain in the URL.
- Historical browser scripts for old atlas interactions were not rewritten wholesale. The place polish script was updated for the four controls in two columns, but not executed in this turn.
- No new automated accessibility audit or physical-device/screen-reader testing was performed this turn.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 130 files, 777 tests passed. New regressions cover topic selection, mismatched periods, four URL selections with a mobile pair, and compact scenario grouping/reset.
- `npm run build` with local API and artifact preview configuration: passed; 2,430 static pages generated and publication diagnostics completed.
- `git diff --check`: passed before final handoff.
- Browser verification through the in-app browser: desktop navigation and cost composition; 390px comparison pair and topic controls, shared menu and no document overflow; 390px atlas List selection, Add to comparison, Map return preserving selected Mercer County and no overflow; 320px Princeton no overflow and down-payment editing/assumption disclosure; 768px control alignment inspected and label font mismatch corrected and paired input baselines rechecked equal. Final static comparison preview on port 3002 loads all four places and their figures.
- No lint script is configured in `web/package.json`.
