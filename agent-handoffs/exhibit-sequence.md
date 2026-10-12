# Exhibit sequence and spacing

## What changed
- Reordered place exhibits: sales/paychecks, historical context/migration, building activity/annual construction, lending/work, ground-water/providers, flood/broadband, community context/work geography, then full-width costs/income.
- Reordered statewide exhibits: sales/lending, historical context/building, work/broadband.
- Split construction and work chart placement without duplicating either chart.

## Files/modules affected
- State/place page composition; StateContextExhibits topic selection; LocalEvidenceCharts kind selection; compact CSS; regression tests.

## Architectural or implementation decisions
- Actual DOM order follows the new reading order; no CSS-only visual reordering or hover-driven rearrangement.
- Similar-height pairings reduce gaps, but preserve a meaningful thematic sequence and normal mobile flow.
- Existing figures, sources, dates, caveats and interactions unchanged. Unsupported exhibits still omitted.

## Assumptions
- Scope covers the current place gallery and corresponding state exhibit order.

## New TODOs / limitations
- Heights vary by available geography/data and expanded details; not a fixed-height or masonry layout.
- No canonical-document/backend/data-method changes.

## Verification
- Type checking and the existing 646 tests passed before the new topic-selection regressions; final results recorded below.
- All 648 tests passed, including retained original chart tests and new topic-selection/unsupported-chart checks. Initial new fixture omitted the four construction-series slots; corrected it before rerun.
- State/place browser diagnostics passed topic order, visibility, missingness, overflow and scoped axe/contrast across both themes and responsive widths.
- Final height measurements found a legacy full-row chart rule; constrained it to unsplit charts and added a desktop pairing assertion.
- Final static preview build passed (2,386 pages); place diagnostic rerun passed all 12 page/width/theme combinations, including annual/building same-row bounds. `git diff --check` passed. Guide preview override remains local-only, not for deployment.
- No configured frontend lint command; backend tests skipped (presentation-only).
