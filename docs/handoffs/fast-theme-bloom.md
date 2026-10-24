# Fast theme bloom

## What changed
- Restored a short 180ms radial palette bloom originating at the theme selector, alongside the existing icon animation.
- Every tap immediately applies its palette and replaces the previous bloom. No full-page snapshots, queued callbacks or input lockout.

## Files/modules affected
- ThemeToggle.tsx, redesign.css, check-theme-interruptions.mjs

## Architectural or implementation decisions
- Decorative pointer-transparent layer over the live page avoids the prior View Transition snapshot input and named-element issues.
- Reduced-motion preference skips the bloom; synchronous palette updates, preference persistence and system following unchanged.

## Assumptions
- User requests theme implementation and recommendations only for reducing comparison height. County table untouched pending that decision.

## New TODOs / limitations
- Proposed a 320px scrollable county table with sticky header and optional full-table expansion; not implemented.
- Physical Safari/mobile testing unavailable. Uses native Web Animations in current browsers.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 656 tests / 105 files passed.
- Final build and rapid-input results below.
- Static build passed: 2,386 pages / 16,695 exported files.
- `node scripts/check-theme-interruptions.mjs`: eight viewport/theme/motion combinations plus tool-page no-View-Transition fallback passed. Every raw rapid tap delivered; correct palette/storage/label, immediate control colors, at most one pointer-transparent bloom, no reduced-motion bloom, eventual layer cleanup, no app errors.
- `git diff --check`: passed. No backend tests (frontend-only).
