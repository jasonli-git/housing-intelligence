# State county cabinet

## What changed
- Aesthetic follow-up: brushed-metal drawer frame, warm paper folder surfaces, layered edges, index marks, folder-fan illustration and bordered open action distinguish the cabinet from the statewide snapshot. Theme-aware surfaces retain county-green destinations.
- Replaced the state explorer's plain county list with a shallow folder cabinet: mouse hover/focus previews counties, explicit links open them.
- Mobile uses a horizontally swipeable folder strip; tapping selects a folder, then Explore county opens it.
- All counties toggles a direct linked directory; search and comparison remain unchanged.

## Files/modules affected
- `CountyCabinet.tsx` and tests, `StateModeWorkspace.tsx`, `county-cabinet.css`, root CSS import.
- `web/scripts/check-county-cabinet.mjs` browser diagnostic.

## Architectural or implementation decisions
- CSS perspective, not WebGL, keeps the experiment lightweight. Decorative architectural marks are not data graphics or geographic outlines.
- Arrow keys and Home/End browse county buttons; focus scrolls the selected folder into view. Reduced motion disables transitions.
- No automatic navigation on hover, no county metrics invented, no changes to compare mode or place search.

## Assumptions
- Cabinet is exploratory; all-counties fallback remains essential for direct access.
- Directory is available in print instead of interactive preview.

## New TODOs / limitations
- Mobile swipe scrolls folders; users tap to select. No inertial selection/autoplay.
- Not a literal Finder clone or 3D map. Does not add regional county groupings.
- Canonical documentation unchanged. The proposed Director Note remains unwritten; implementation is covered by the user's branch approval.

## Verification
- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 639 tests passed in 98 files.
- Initial build failed because the local API was stopped; restarted API and static preview for a retry.
- Local preview build passed: 2,386 static pages, 16,695 exported files. Explicit guide preview override is local-only, not for deployment.
- `node scripts/check-county-cabinet.mjs`: passed 320/390/1280px in light/dark, 21 folders and direct links, Home/End keyboard selection, desktop hover, no horizontal page overflow and scoped axe accessibility. Corrected an initial diagnostic browser-context setup error before successful rerun.
- Desktop/mobile dark screenshots visually inspected. `git diff --check` passed. No configured frontend lint command; backend tests skipped (presentation-only).
- Aesthetic follow-up: typecheck, three cabinet tests, static preview build and browser diagnostic passed. Both themes at 320/390/1280px passed scoped axe including contrast; dark desktop and light mobile screenshots inspected. No data or interaction changes.
