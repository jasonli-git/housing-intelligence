# Checklist after Living there

## What changed

Moved Princeton's Check the actual home callout below Living there, after the exhibit gallery. It remains inside About this place and before similar-place exploration. Preserved its guide link and all text.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`

## Architectural or implementation decisions

DOM order matches visual order; no CSS reordering. Existing marketFirst gate unchanged, other place pages unaffected.

## Assumptions

The requested move is approved; further redesign of Living there is exploratory only.

## New TODOs / limitations

Living there currently holds school district associations, county agency reporting context and health estimates. These differ in audience and geographic scope. Proposed direction: schools as a compact practical check; agency completeness in full-report evidence; health as optional contextual exploration, potentially a story. No such content changes made here.

## Verification

- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Browser check at 390 and 1440px: checklist follows Living there in DOM and visual order; place-aware guide URL preserved.
- No full suite/build rerun for this section-only move.
