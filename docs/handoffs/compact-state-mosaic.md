# Compact statewide mosaic

## What changed
- Follow-up compaction: wider desktop reading column, single-line selected figure/category layout, no reserved empty reading height, shallower artwork and a single scale/source footer. Retain survey margins where applicable; records-only calculation label is redundant with the source footer and accessible legend description.
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
- Follow-up verification: type checking/build and 16 mosaic tests passed. `node scripts/check-compact-mosaic.mjs` passed both views and every category at 320/390/1280px in both themes, preserving 44px legend targets and no page overflow. Screenshot inspection passed for dark mobile/desktop. Final purchase-loan view measured approximately 503/497/246px respectively (category text affects height).
- Follow-up files also include `HousingMosaic.tsx`, its test and the compact-mosaic browser diagnostic.
