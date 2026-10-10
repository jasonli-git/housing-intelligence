# Mobile section spacing

## What changed
- Added 16px horizontal padding to the expanded Local market body on mobile.
- Reduced mobile landing header spacing and the search backdrop height. Hidden map region, footer and directional controls no longer reserve space in Search mode.
- Preserved the full map layout in Explore mode and desktop spacing.

## Files/modules affected
- `web/app/ui-refinement.css`
- `web/scripts/check-mobile-section-spacing.mjs`

## Architectural or implementation decisions
- Scoped CSS to screen widths up to 600px; no content, calculations, routing or print changes.
- Added a repeatable browser check against the static export, covering theme, inset, overflow and map-mode switching.

## Assumptions
- The requested spacing changes are mobile-only.

## New TODOs / limitations
- ZIP pages without Local market data are skipped for that assertion.
- Browser checks use reduced motion; animation timing was not assessed.
- No deployment or canonical-document changes.

## Verification
- `npm run typecheck`: passed.
- `npm test`: passed, 586 tests across 87 files.
- `npm run build`: passed, 2,384 pages and 2,366 compatibility aliases; 16,682 exported files.
- `node scripts/check-mobile-section-spacing.mjs`: passed all eight width/theme combinations (320, 390, 600 and 1280px; light/dark), including Somerset County, Princeton and ZIP 07030 where market data exists.
- Inspected 390px dark-mode screenshots of home and expanded Local market.
- Initial browser assertion exposed the hidden directional-control row; corrected before final passing run. Dev map check could not load generated states.json, so final checks used the production export. Sandboxed build could not reach the local API; rerun with local access passed.
- `git diff --check`: passed.
