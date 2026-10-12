# Compact place exhibits

## What changed
- Applied state exhibit compaction to county, municipality and ZIP galleries with two desktop columns and a single mobile column; original topic themes remain distinct.
- Lending and work/transit previews move out of deep evidence. County broadband becomes a network exhibit; duplicate county broadband removed from the supporting community component.
- No programmes disclosure was present in the current place template; none added. Housing help remains linked through Your next step.

## Files/modules affected
- Place page, shared StateContextExhibits/StateBroadband, CommunityContext, compact exhibit CSS and tests/browser diagnostic.

## Architectural or implementation decisions
- Reuse the same source helpers and components; labels use the current place name and geographic level.
- Town lending estimates explicitly labelled census-tract estimates. No county broadband substituted as town/ZIP measurements.
- Property checks and safety/school context are not promoted into new exhibits.

## Assumptions
- Both means compaction/context visibility plus removal of any duplicate programmes UI, not removing the housing-help data/tool.

## New TODOs / limitations
- Detailed lending/work figures still use disclosures. Unavailable data is labelled instead of manufactured.
- Canonical docs unchanged. No backend or methodology changes.

## Verification
- Type checking passed. Initial test failure was the old statewide-specific unavailable broadband wording; updated for the reusable geography label.
- All 642 tests passed in 99 files.
- Browser checks passed Camden County, Princeton and ZIP 07030 at 390/1280px in both themes: visible exhibits, no lending/work duplicates in deep evidence, county-only broadband, no page overflow and scoped axe accessibility/contrast.
- Desktop dark Princeton screenshot inspected. Final build rerun includes explicit town estimate wording; local guide override is preview-only, not for deployment.
- No configured lint command. Backend tests skipped (presentation-only).
- Final local preview build passed, 2,386 pages. Browser diagnostic rerun passed all 12 page/width/theme combinations; `git diff --check` passed.
