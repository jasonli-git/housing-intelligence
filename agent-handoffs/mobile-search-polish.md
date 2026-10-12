# Mobile search polish

## What changed
- Fixed US landing suggestions appearing see-through: scale caption painted above the solid popup, rather than actual background transparency.
- Raise search overlay above caption only while suggestions exist, preserving art and controls in the closed state.
- Added visual popup regression diagnostic and actual result navigation check.

## Files/modules affected
- web/app/landing-search-first.css
- web/scripts/check-mobile-search-popup.mjs

## Architectural or implementation decisions
- Popup background already computed to fully opaque rgb(32,31,28) in dark mode; all ancestors had opacity 1. Overlay stacking context was z=3, caption z=4. Raising the child popup's z=20 alone could not escape its parent.
- Scoped parent-layer change, not a global popup redesign, background recolor or portal.
- Pixel test crops opaque popup interior and compares it before/after hiding background art, counts and benchmarks. Rounded corners/shadows are excluded from comparison.

## Assumptions
- New experimental branch from clean main, approved by user; no work carried between branches.
- Focus is US landing search; other pages remain unchanged.

## New TODOs / limitations
- Browser diagnostics use Chromium; Safari and physical-device checks not performed.
- No canonical documentation changes.

## Verification
- Reproduced overlap in 390px dark screenshot and inspected ancestor colors/opacity/z-index.
- New pixel regression failed against original output, confirming test detects the issue.
- Final results below.
- `npm run typecheck`: passed. `npm test`: 656 tests in 105 files passed.
- Static build passed, 2,386 pages / 16,695 exported files. Preview guide artifact adapter remains local-only.
- `node scripts/check-mobile-search-popup.mjs`: all 12 width/theme cases passed (320/390/600/768/1024/1280, light/dark): exact interior pixel invariance, popup axe, actual result selection/navigation.
- `node scripts/check-search-first.mjs`: all 14 width/theme cases passed, including map/search motion, reduced motion, icon alignment, zoom/reset, suggestion hit testing, axe and overflow.
- Inspected before/after 390px dark screenshots. `git diff --check` passed. Backend tests not run (no backend changes).
