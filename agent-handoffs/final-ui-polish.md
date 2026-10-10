# Final UI polish

## What changed
- Printable ranked-card headings stay with their next row, using print-only inline card rows instead of poorly fragmenting grid layout. Cards can continue on subsequent pages without keeping a whole group unbreakable.
- Table category headings avoid breaks before their first data row. The final Notice heading and its short body stay together.
- Report current-value tables use readable compact source names (Census ACS, Zillow ZHVI, etc.). Sources lists the matching short label, full registry name and original ID. Unknown sources retain their full registry name; no guessed abbreviation.
- Added focused mobile consistency diagnostics for shared tools, definition bounds/Escape/focus, 404 recovery and reflow.
- Open full report shortcut unchanged. No new print-helper copy, major redesign, calculation or source-data changes.

## Files/modules affected
- web/app/report-refinement.css
- web/app/regions/[id]/report/page.tsx
- web/lib/reportSources.ts and reportSources.test.ts
- web/scripts/check-final-consistency.mjs

## Architectural or implementation decisions
- Print-only layout overrides leave the screen design unchanged.
- Short source labels are a presentation mapping; original source IDs, registry records, licences and citations remain intact.
- Existing diagnostics cover broader accessibility/contrast and destination-specific internal-link colours. The new script focuses on current menu and tooltip behavior rather than duplicating the full scanner.

## Assumptions
- Continue experiment/ui-density-discoverability and PR #141; no merge or deployment.

## New TODOs / limitations
- Automated accessibility checks are not a complete accessibility certification. Tooltip checks exercise the first available main-content definition on each sampled page, not every definition.
- Current budget tool omissions/disabled states are respected on entry and utility pages; no navigation redesign undertaken.
- Chromium print samples only; other browsers, printer settings and all geographies are not exhaustively tested.

## Verification
- npm run typecheck and npm test: passed, 577 tests / 86 files.
- Static production build passed: 2,386 exported pages; local artifact URL used for preview only.
- check-reports.mjs: all 12 desktop/mobile light/dark report states passed, including bottom-boundary checks. Final PDFs: Somerset 24 Letter / 23 A4 pages, Princeton 20 Letter, ZIP sample 14 Letter. Safer heading grouping and readable labels add one page to the county sample versus the preceding compact-code version; no general print-length reduction claimed.
- Regenerated four PDFs and checked all 81 page bottoms visually and by word bounding boxes: zero bottom-boundary crossings. Full-page ranked-card grouping and readable source-table labels inspected. Cards continue normally rather than moving an entire group to another page.
- Cross-page accessibility: check-accessibility.mjs against ten routes, 1280/390px, light/dark, default/expanded = 80 states passed with no reported WCAG A/AA violations, runtime errors or overflow; skip-link focus checked.
- check-final-consistency.mjs: 11 routes including 404 × light/dark = 22 mobile states passed for keyboard tools, definition viewport bounds/Escape/focus where present, and reflow. 404 accessibility and recovery search checked.
- check-tool-navigation.mjs: 1280/768/390/320px × light/dark = 8 states passed.
- check-place-link-colors.mjs: county/town/ZIP × light/dark = 6 destination-colour checks passed.
- Initial consistency-script assumptions about unavailable tool links failed; diagnostic corrected to respect deliberately hidden/disabled tools. No application change was needed.
- git diff --check: passed. No broad application consistency defect was found in the sampled audit; additional screen changes were not made.
