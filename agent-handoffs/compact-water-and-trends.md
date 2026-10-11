# Compact water and trends

## What changed
- Place ground/water exhibit previews the three largest systems by estimated share of homes served; remaining systems expand locally.
- Trend exhibit mode shows one selectable measure/chart at a time, keeping all measures and exact source tables available. The separate indexed cost/income comparison is unchanged.

## Files/modules affected
- GroundAndWater and tests, TrendsExplorer, place page compact flag, exhibit CSS.

## Architectural or implementation decisions
- Coverage ordering is not a water-quality/risk ranking. Existing counts, violation resolution, PFAS and source explanations are untouched.
- Default component modes used by the buyer guide/reports remain unchanged.
- Shared year controls retain all-series coverage, while the visible comparison sentence follows the selected measure.

## Assumptions
- Top 2–3 refers to the long water-system list; use three when available, not fabricated headline selections.

## New TODOs / limitations
- Ground/water introductory site/public-water facts remain visible; detailed system records and source notes still expand.
- No backend/source/calculation changes. Canonical docs untouched.

## Verification
- Type checking passed; verification results below recorded after completion.
- All 646 tests passed in 101 files, including top-three coverage ordering and unchanged default water table.
- Browser checks passed Camden County, Princeton and ZIP 07030 at 390/1280px in both themes: single-chart measure selection, additional systems expansion, no horizontal page overflow and scoped axe accessibility/contrast.
- Preview build passed; final singular/plural label rebuild run before completion. Guide artifact override remains local-only, not for deployment.
- No configured frontend lint command. Backend tests skipped (presentation-only).
- Final preview build passed (2,386 pages); singular/plural label tests passed. `git diff --check` passed.
