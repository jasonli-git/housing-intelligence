# Compact statewide snapshot

## What changed
- Tighter card padding/type; three equal desktop figures and short value-aligned mobile rows.
- Remove redundant kicker labels. Keep sold-home basis, national mortgage qualifier/not-a-quote, dates, preliminary flags and reporting-town coverage visible.
- Consolidate longer scope explanations and reporting percentages in one local disclosure; smaller embedded mosaic artwork/spacing and preserved legend targets.

## Files/modules affected
- StateOverview and regression test; housing-mosaic.css.

## Architectural or implementation decisions
- All source figures/calculations unchanged. Consolidated detail stays in DOM and print CSS reveals it.
- Keep mosaic interaction and extra statewide figures; no autoplay or added data.

## Assumptions
- As compact as possible means reducing redundant presentation while retaining readable text and controls, not removing facts.

## New TODOs / limitations
- Full scope/coverage explanations now require opening one disclosure on screen.
- Mosaic tiles are decorative; accessible category buttons remain the primary controls.
- Canonical docs unchanged; no backend/method changes.

## Verification
- Type checking and existing 648 tests passed; new regression and browser checks recorded after completion.
- Snapshot basis/period/reporting regression passed. Preview build passed (2,386 pages); local guide override is not for deployment.
- `node scripts/check-state-snapshot.mjs` passed 320/390/1280px in both themes: figures, open scope notes, 44px mosaic controls, no page overflow, scoped axe/contrast and print visibility of closed scope details.
- Dark desktop/mobile screenshots inspected. Snapshot measured 480px desktop, 777px at 390px and 909px at 320px with the default new-homes view; content wraps rather than being clipped.
- No configured frontend lint command; backend tests skipped (presentation-only).
- Final full suite: 649 tests passed in 102 files; `git diff --check` passed.
