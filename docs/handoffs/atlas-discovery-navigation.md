# Atlas discovery navigation

## What changed
- Geography controls now read United States → New Jersey → Counties. United States opens the state view, New Jersey focuses/selects the state, and Counties opens the NJ county view. A separate quiet globe control restores the world view.
- Added Clear selection and kept the selected-place readout anchored while the comparison table scrolls. Source-note overflow can scroll without losing the anchored selection.
- Added a county finder inside the comparison panel. It filters the table only, never the map, published coverage count, or shading range. Empty searches report zero matching counties.
- Legend explanations now describe the selected measure, including the renter 30%-of-income threshold and permitted-versus-completed distinction. Change views explicitly describe percentage change; one-area coverage does not imply a meaningful comparison.
- Mobile comparison buttons explicitly name what they open. The closed sheet shows a compact preview; opening the comparison list temporarily hides map legend/zoom controls, and closing it restores them above the measured sheet height.

## Files/modules affected
- `web/components/HousingAtlas.tsx`
- `web/app/atlas/atlas.css`
- `web/scripts/check-atlas-navigation.mjs`
- Existing Atlas globe, motion and county checks updated to the new control labels.

## Architectural or implementation decisions
- ResizeObserver coordinates closed-sheet map controls with actual panel height instead of hard-coded offsets.
- County search is a transient list filter; geography, metric, selected area and camera continue using the existing shared URL state. No new dataset or backend change.
- The table remains an accessible alternative to interacting with small shapes. Missing values remain distinguishable from zero.
- This updates `experiment/housing-atlas` and PR #159, not a replacement PR.

## Assumptions
- Only NJ county drill-down is supported. The hierarchy does not imply data coverage in other states or municipality-level mapping.
- Approval covers the navigation/interpretability/mobile pass and county finder, not two-place pinning.

## New TODOs / limitations
- Two-place comparison remains deferred to its own pass.
- Municipal coverage audit and physical iOS/Safari/on-screen-keyboard checks remain pending as documented in previous Atlas handoffs.
- The open mobile sheet may scroll on smaller screens; the selected-place block remains sticky. Map controls are restored by closing the list rather than competing with an expanded sheet.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 666 tests across 107 files passed.
- `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed, 2,388 pages / 16,704 files.
- `node scripts/check-atlas-navigation.mjs`: six mobile/tablet/desktop × light/dark cases passed for hierarchy, filtered list, unchanged shading, anchored selection, clear selection, sheet non-overlap, accessibility and reflow.
- `node scripts/check-housing-atlas.mjs`: six responsive/theme cases plus missing-geometry fallback passed. The mobile test now closes the comparison list before accessing map zoom controls.
- `node scripts/check-atlas-globe.mjs`: six responsive/theme cases passed.
- `node scripts/check-atlas-motion.mjs`: six responsive/theme cases passed.
- `node scripts/check-atlas-measures.mjs`: four responsive/theme cases passed.
- Visually inspected `/tmp/atlas-finder-390.png` and `/tmp/atlas-finder-1280.png`; corrected the zoom-controls offset for the taller legend.
- `git diff --check`: passed.
- No backend tests run (no backend edits).
