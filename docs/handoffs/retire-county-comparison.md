# Retire county comparison

## What changed
- Removed county comparison from the rendered New Jersey page and jump menu.
- Parked the full ranking-window assembly and render call behind `COUNTY_COMPARISON_ENABLED = false` in the state page; rankings are not fetched while disabled.
- Preserved CountyComparison, StateModeWorkspace, related styling, underlying APIs and data for a later display redesign.
- Page metadata no longer advertises comparisons. Existing `#nj-explore` links now reach the county navigation row.

## Files/modules affected
- `web/app/states/new-jersey/page.tsx`
- `web/components/SectionJump.tsx`
- County strip and shared navigation browser regression scripts

## Architectural or implementation decisions
- No CSS-hidden comparison, empty disclosure or spacer remains in the page.
- The disabled render wrapper carries `data-jump-label="Compare counties"`, so re-enabling after redesign can restore its jump destination without reinstating duplicate hardcoded menu entries.
- Find your fit remains available in the shared tools menu; no need to relocate the retired comparison heading's duplicate link.

## Assumptions
- Retire for now means preserve source code and data, not delete the implementation.

## New TODOs / limitations
- Future comparison presentation is undecided. Restore/redesign behind the feature flag, then update retirement assertions in browser scripts.
- No canonical-document, backend or source-data changes. Physical Safari testing unavailable.

## Verification
- Results below.
- `npm run typecheck`: passed. `npm test`: all 656 tests / 105 files passed.
- Static preview build passed: 2,386 pages / 16,695 exported files.
- `node scripts/check-county-strip.mjs`: eight width/theme cases passed with comparison absent and direct county links functional.
- `node scripts/check-shared-navigation.mjs`: 12 responsive/page cases passed; NJ comparison absent from DOM and jump options, shared controls and licence disclosure functional, reflow/axe checks passed.
- `git diff --check`: passed. Backend tests not run (no backend changes).
