# Compact statewide exhibits

## What changed
- Removed the duplicate programmes/reported-homes disclosure from statewide evidence at the user's request; Your next step still links the housing-help tool. Removed its unused page import and API fetch; the housing-help tool and data remain unchanged.
- State sales/history/construction exhibits are smaller, in a two-column desktop gallery and single-column mobile layout.
- Mortgage lending, work/transit and broadband moved out of the statewide evidence expansion into visible exhibits with distinct ledger/destination/network themes.
- Lending and work preview key figures; full existing records and source explanations remain in local disclosures. Broadband retains its published shares and important denominator/address caveats.

## Files/modules affected
- NJ page composition, new `StateContextExhibits` and tests, `LearningExhibit` topic styles/tests, `state-exhibits.css` and layout import.
- `web/scripts/check-state-exhibits.mjs`.

## Architectural or implementation decisions
- Existing source helpers supply all figures; no backend or calculation changes.
- Work bars show each destination's share of all resident jobs, not shares renormalized among the top three. Decorative artwork is separate from data.
- Snapshot's More statewide figures and the all-figures evidence table remain unchanged.
- Compact layout styles are state-scoped; place pages are unchanged.

## Assumptions
- The approved supporting-context move refers to lending, work/transit and broadband, not the snapshot's extra profile metrics.

## New TODOs / limitations
- Adding three visible exhibits still adds reading; compact grid and previews reduce footprint, not total information.
- Detailed lending/work records remain expandable. Missing source data is explicitly labelled.
- No configured frontend lint script. Canonical docs unchanged.

## Verification
- Initial build failed because local API was stopped; restarted API and preview and retried.
- Type checking passed; all 641 tests passed in 99 files. Initial new test matched duplicate preview/detail rate text; narrowed the assertion and reran.
- Browser accessibility initially found small-text contrast failures on exhibit backgrounds; corrected scoped muted/secondary colours and reran successfully at 320/390/1280px in both themes.
- Visual review caught legacy heading/chart sizes overriding compact styles; tightened scoped selectors and spacing for final build.
- Local preview uses explicit guide artifact override; do not deploy that preview build. Production defaults unchanged.
- Backend tests skipped (presentation-only); no configured frontend lint command.
- Final preview build passed (2,386 pages). `node scripts/check-state-exhibits.mjs` passed all six widths/themes combinations, six visible exhibits, removal from the deep evidence expansion, scoped axe including contrast, and no overflow before/after opening lending/work details.
- Final desktop dark screenshot inspected; `git diff --check` passed. Existing construction wording about the five-year reporting window and county totals is inherited from HomesAdded and not changed here.
- Programmes removal follow-up: type checking, preview build and browser diagnostic passed, including explicit absence of the programmes disclosure and retention of the Your next step housing-help link. Unit suite not rerun for this markup/import/fetch removal.
