# Cost breakdown shortcut

## What changed
- Replaced “Show the calculation” with “See the breakdown” / “Hide the breakdown”.
- Moved the shared disclosure control into a full-width footer after the owning/renting headline cards.
- Added a calculator icon, rotating chevron, subtle accent surface, hover/focus treatment and 48px minimum tap height.

## Files/modules affected
- `web/components/CostToOwn.tsx` and its tests.
- `web/app/artful-data.css`.
- `web/scripts/check-artful-data.mjs` (updated accessible button labels).

## Architectural or implementation decisions
- One shared expansion for both ledgers; no nested disclosure added.
- Uses page accent tokens and respects reduced motion.
- Existing report layout already displays ledgers directly. Print still hides the interactive control and reveals hidden calculations.
- Continued the assigned UI fix branch and existing PR; no new branch or replacement PR.

## Assumptions
- Approved treatment applies to every instance of the shared calculation shortcut, not to reports that already show the full calculation.

## New TODOs / limitations
- No calculation, methodology, data or canonical-document changes.
- Full preexisting artful-data accessibility script was not rerun; its button selectors were updated. Targeted browser checks were run instead.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 587 tests passed across 87 files, including new footer open/close, aria-controls and no-nested-expansion regression coverage.
- `npm run build`: passed; 2,384 pages, 2,366 legacy aliases, 16,682 exported files.
- Targeted Playwright checks against static preview: Somerset County, Princeton and ZIP 07030, 320/1280px, light/dark (12 combinations). Single button, 44px-or-larger target, open/close, print visibility and no horizontal overflow passed.
- Inspected dark mobile footer screenshot.
- `git diff --check`: passed.
