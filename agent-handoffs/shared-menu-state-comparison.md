# Shared menu and direct state comparison

## What changed
- NJ's former Find your place section now presents county comparison directly. Removed duplicate search and mode toggle; preserved measure/change selectors, comparison table and Since 2019 notes.
- Removed the redundant section divider. Find your fit remains a secondary statewide-budget link.
- Moved Jump to a section near the NJ title; changed the destination label to Compare counties and suppressed its nested duplicate.
- Desktop shared menu now orders tools, search, theme. Mobile retains search, Tools disclosure, theme.
- Applied landing-page compact commercial-use/source-check typography, unboxed status link and mobile treatment to every shared masthead. Restrictions and source-check destination/functionality remain unchanged.

## Files/modules affected
- StateModeWorkspace, Masthead, SectionJump, NJ page
- redesign.css, county-cabinet.css
- check-county-strip.mjs updated for direct comparison; check-shared-navigation.mjs added

## Architectural or implementation decisions
- Retain `#nj-explore` for existing inbound links; no longer need county-page data inside the comparison component.
- Shared masthead uses a scoped shared-meta class, preserving native licence disclosure and print rules.
- No data changes, regenerated readings, backend edits or canonical-document edits.

## Assumptions
- Approved refinements stay on `experiment/mobile-search-polish` / PR #158.

## New TODOs / limitations
- Physical Safari/mobile verification unavailable.
- Archived scripts targeting removed explore/compare modes are not applicable; current county-strip regression updated.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 656 tests / 105 files passed.
- Final build and browser results below.
- Static preview build passed: 2,386 pages / 16,695 exported files.
- `node scripts/check-shared-navigation.mjs`: 12 cases (390/814/1243px across NJ, guide, tax, county): desktop order, mobile Tools availability, functional licence disclosure, unboxed source status, no overflow, metadata axe checks; NJ direct comparison and single jump destination verified.
- `node scripts/check-county-strip.mjs`: all eight width/theme cases passed after updating expectations for direct county comparison.
- Viewed full-page desktop NJ screenshot. `git diff --check` passed. Backend tests skipped (frontend-only); no physical Safari test.
