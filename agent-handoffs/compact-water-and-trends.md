# Compact water and trends

## What changed
- Latest superseding direction: remove Explore each measure and individual trend graphs from place pages; restore full-width indexed housing-cost/income comparison. Retain each series' recent historical values/source/uncertainty rows under Historical values & sources in evidence. Chart-count copy updated; default trend components elsewhere unchanged.
- Superseding user refinement: water preview now shows two systems. Reverted single-measure selection; all supported trend charts return beside a horizontally narrower indexed comparison on desktop, stacked on mobile. Expanded exhibit theme distinctions in surfaces, typography, framing and decorative patterns.
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
- Follow-up type checking and all 646 tests passed, including revised top-two water test. Verification of the final layout follows below.
- Type checking passed; verification results below recorded after completion.
- All 646 tests passed in 101 files, including top-three coverage ordering and unchanged default water table.
- Browser checks passed Camden County, Princeton and ZIP 07030 at 390/1280px in both themes: single-chart measure selection, additional systems expansion, no horizontal page overflow and scoped axe accessibility/contrast.
- Preview build passed; final singular/plural label rebuild run before completion. Guide artifact override remains local-only, not for deployment.
- No configured frontend lint command. Backend tests skipped (presentation-only).
- Final preview build passed (2,386 pages); singular/plural label tests passed. `git diff --check` passed.
- Superseding layout follow-up: all 646 tests passed; final type checking and four affected tests passed after adding stable metric-keyed colour cues. Browser diagnostics updated for restored multiple charts and top-two water preview. Initial browser run passed all county/town/ZIP width/theme combinations; final build rerun includes series cues.
- Individual graph cues use metric IDs, not display order, so missing-year charts do not shift the colour mapping.
- Final cue build passed (2,386 pages); browser diagnostic passed all 12 page/width/theme combinations, including desktop side-by-side bounds and full accessibility/contrast. Desktop trend layout screenshot inspected. Final keyed-metric regression test and diff check passed.
- Final removal follow-up: type checking, 646 tests and static preview build passed. Updated browser checks passed all county/town/ZIP width/theme combinations: no Explore each measure or individual charts, full-width comparison and retained historical-source tables; axe/overflow checks passed. Removed stale side-layout CSS.
