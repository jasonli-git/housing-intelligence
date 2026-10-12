# Mobile search polish

## What changed
- Theme follow-up: removed full-page snapshot palette reveal. Every press synchronously updates the palette, label and saved choice, with no delayed callbacks. Animated sun/moon icon and map/search transitions retained.
- Map-specific snapshot fragments no longer participate in theme changes because theme changes do not start View Transitions; this removes separate fades and input-blocking overlays.
- Cancel independent hover-color tweens during each synchronous palette update, then restore interaction motion in the same handler. This prevents controls remaining grey after rapid switches; icon motion remains independent.
- Fixed US landing suggestions appearing see-through: scale caption painted above the solid popup, rather than actual background transparency.
- Raise search overlay above caption only while suggestions exist, preserving art and controls in the closed state.
- Added visual popup regression diagnostic and actual result navigation check.

## Files/modules affected
- web/app/landing-search-first.css
- web/scripts/check-mobile-search-popup.mjs
- web/components/ThemeToggle.tsx, web/app/redesign.css, web/scripts/check-theme-interruptions.mjs

## Architectural or implementation decisions
- Popup background already computed to fully opaque rgb(32,31,28) in dark mode; all ancestors had opacity 1. Overlay stacking context was z=3, caption z=4. Raising the child popup's z=20 alone could not escape its parent.
- Scoped parent-layer change, not a global popup redesign, background recolor or portal.
- Pixel test crops opaque popup interior and compares it before/after hiding background art, counts and benchmarks. Rounded corners/shadows are excluded from comparison.
- Tried interruptible snapshot reveal first; direct touchscreen bursts still lost events during the snapshot phase. Chose synchronous palette updates instead of preserving the full-page radial reveal. Sun/moon icon motion remains; global hover-color motion is suppressed only for the synchronous palette style flush.

## Assumptions
- New experimental branch from clean main, approved by user; no work carried between branches.
- Initial popup change is landing-scoped; theme control is shared across pages.

## New TODOs / limitations
- Browser diagnostics use Chromium; Safari and physical-device checks not performed.
- No canonical documentation changes.

## Verification
- Theme follow-up: typecheck, 656 tests, final static build passed. Eight rapid-tap cases (390/1280, light/dark, reduced/normal motion) plus no-View-Transition-API tool-page fallback passed. Direct input events all reached the selector; parity, label, localStorage, immediate control color and cleanup assertions passed. Initial attempt to retain snapshot reveal failed direct tap delivery and was replaced as documented above.
- All 12 popup pixel/navigation cases and 14 landing/map interaction cases passed again. Inspected mobile light screenshot. `git diff --check` passed. Physical Safari/device testing remains unperformed.
- Reproduced overlap in 390px dark screenshot and inspected ancestor colors/opacity/z-index.
- New pixel regression failed against original output, confirming test detects the issue.
- Final results below.
- `npm run typecheck`: passed. `npm test`: 656 tests in 105 files passed.
- Static build passed, 2,386 pages / 16,695 exported files. Preview guide artifact adapter remains local-only.
- `node scripts/check-mobile-search-popup.mjs`: all 12 width/theme cases passed (320/390/600/768/1024/1280, light/dark): exact interior pixel invariance, popup axe, actual result selection/navigation.
- `node scripts/check-search-first.mjs`: all 14 width/theme cases passed, including map/search motion, reduced motion, icon alignment, zoom/reset, suggestion hit testing, axe and overflow.
- Inspected before/after 390px dark screenshots. `git diff --check` passed. Backend tests not run (no backend changes).
