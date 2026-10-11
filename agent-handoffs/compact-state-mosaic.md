# Compact statewide mosaic

## What changed
- Reduced embedded mosaic vertical margins, padding and grid spacing.
- Shortened the artwork by about 14% through its aspect ratio, with a mobile width cap.
- Slightly reduced the desktop selected percentage and reserved reading height; mobile text remains unchanged.

## Files/modules affected
- `web/app/housing-mosaic.css`

## Architectural or implementation decisions
- Scope to `.mosaic-embedded`; preserve data, 100 tiles, controls, animation and 44px button targets.
- Keep standalone mosaics and print suppression unchanged.

## Assumptions
- “A little smaller” means a modest height reduction, not removing detail or hiding the exhibit.

## New TODOs / limitations
- No data or calculation changes. No configured frontend lint command.

## Verification
- `npm run typecheck`: passed.
- `npm test -- HousingMosaic`: 16 tests passed in two files.
- Local preview static build passed (2,386 pages); guide preview override remains local-only, not for deployment.
- Browser checks passed at 320, 390 and 1280px in light/dark: 100 tiles, view switching, 44px button targets and no page horizontal overflow.
- `git diff --check`: passed. Backend tests not run (CSS-only).
