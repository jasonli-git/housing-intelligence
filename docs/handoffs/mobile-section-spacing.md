# Mobile section spacing

## What changed
- Added 16px horizontal padding to the expanded Local market body on mobile.
- Reduced mobile landing header spacing and the search backdrop height. Hidden map region, footer and directional controls no longer reserve space in Search mode.
- Preserved the full map layout in Explore mode and desktop spacing.
- Review follow-up: on mobile pages without a menu search, placed Tools on the branding/theme row instead of reserving an otherwise empty second row. Search-bearing menus retain their search row; Tools retains its 44px target.
- Responsive follow-up: extended that single-row layout through 1000px (tablet/intermediate sizes). Desktop above 1000px retains its inline tool links. Regression checks now cover both sides of layout breakpoints and large desktop widths.

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
- Responsive follow-up verification: typecheck and production build passed; browser script passed all 20 combinations at 320/390/600/601/760/768/1000/1001/1280/1440px in light/dark, including single-row home menu and functioning Tools disclosure or desktop tool links.
