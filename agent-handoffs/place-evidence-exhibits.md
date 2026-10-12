# Place evidence exhibits

## What changed
- Remaining flood, ground/water, utilities, schools, internet address-check, public-safety and health context moved from the evidence expansion into individually themed gallery exhibits.
- Annual construction/work charts, indexed comparison and each individual trend chart now have exhibit presentations outside the evidence expansion.
- Rank-at-a-glance remains in evidence with figure tables, downloads and data summary.

## Files/modules affected
- Place page, CommunityContext, LocalEvidenceCharts, TrendsExplorer, compact exhibit CSS and place browser diagnostic.

## Architectural or implementation decisions
- Optional exhibit props leave guide/default component presentation unchanged.
- Preserve chart values, periods, uncertainty, tables, source text and all caveats; do not turn area figures into property assessments or safety grades.
- Existing property-context anchor retained on the visible services exhibit; trends get a full-width anchor/group with shared year controls and separate chart exhibits.

## Assumptions
- Becoming exhibits means visible outside the deep evidence expansion, consistent with the preceding approved treatment.

## New TODOs / limitations
- More visible exhibits increase gallery length; users need not absorb every exhibit. Supporting records still expand locally.
- Ground/water and utilities are grouped by their existing component; school, safety and health each have separate exhibits.
- Default guide/property checks are not removed. No backend/data/method changes. Canonical docs untouched.

## Verification
- Type checking and 642 existing tests passed.
- Added regression tests: all 644 tests passed in 100 files, including optional community exhibit wrappers and source-table preservation in trend exhibits.
- Final static preview build passed, 2,386 pages (guide override is local-only, not for deployment).
- Place browser diagnostic passed county/town/ZIP at 390/1280px in both themes: content relocation, rank exception, no horizontal page overflow and scoped axe/contrast. Representative flood and trend screenshots inspected.
- `git diff --check` passed. No configured frontend lint command; backend tests skipped (presentation-only).
