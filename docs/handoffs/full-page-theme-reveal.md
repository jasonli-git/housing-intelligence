# Full-page theme reveal

## What changed
- Replaced the decorative bloom with a real full-page radial reveal of the newly themed page, 220ms from the theme button.
- New taps interrupt the active reveal; revision guards prevent skipped snapshot callbacks from restoring stale palettes.
- Temporarily remove named artwork snapshot fragments so the whole page flows together. Restore normal map/search animation after completion.

## Files/modules affected
- ThemeToggle.tsx, redesign.css, check-theme-interruptions.mjs

## Architectural or implementation decisions
- Native View Transitions capture the old/new actual page. Reduced motion and browsers without the API switch immediately.
- Browser root snapshots suppress live button hit testing. During the reveal only, primary pointer-up events in the real selector's rectangle forward to its click handler if the original event path did not include that button. This avoids double toggles and leaves other controls untouched.
- Existing preference storage/system following retained. No data or table changes.

## Assumptions
- User specifically approved restoring the page-wide flowing transition, not a decorative overlay.

## New TODOs / limitations
- Physical Safari/mobile testing unavailable; native behavior varies by browser.
- First native snapshot attempt without pointer forwarding failed rapid touchscreen testing (0/5); not shipped as successful.

## Verification
- `npm run typecheck`, `npm test` results below.
- Final build and rapid-tap/map regression results below.
- Type checking passed; all 656 tests / 105 files passed.
- Static preview build passed: 2,386 pages, 16,695 exported files.
- `node scripts/check-theme-interruptions.mjs`: eight viewport/theme/motion combinations plus tool-page API fallback passed. Raw rapid mobile/desktop inputs during snapshots all delivered, final palette/labels/storage correct, map fragments have no separate snapshot names during the reveal, flags cleared afterward.
- `node scripts/check-search-first.mjs`: all 14 responsive/theme cases passed; map/search transition and reduced-motion coverage retained.
- `git diff --check`: passed. No backend tests (frontend-only).
