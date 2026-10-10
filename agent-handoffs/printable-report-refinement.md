# Printable report refinement

## What changed
- Fixed desktop action overlap by placing jump/print/Markdown/CSV controls in normal flow below the introduction.
- Report titles and headings use restrained editorial typography, related to the local-page theme without paper-note decoration.
- Shortened explanatory dates/rank/footer copy; computed reading details are bullet points. Numerical reading helpers unchanged.
- Current-value source references use source IDs; Sources lists the full name alongside each ID, preserving the cross-reference and licences.
- Report-only print styles tighten headings, table padding and label fonts; preserve repeated table headers and unbroken rows; constrain cost tables to their columns.
- Flattened footer framing for print while retaining publisher notices, full institutional source directory, licence terms and build date. Web-only navigation is omitted on paper.
- Existing Open full report shortcut remains visually unchanged.

## Files/modules affected
- web/app/regions/[id]/report/page.tsx
- web/app/report-refinement.css and layout.tsx
- web/scripts/check-reports.mjs

## Architectural or implementation decisions
- CSS is report-scoped; other page layouts and print behavior are unaffected.
- No figures, source records, margins, rank ranges or caveats removed. No generated interpretation added.
- Print density is obtained through layout, not hiding evidence. Table text targets 9pt, body 10pt, secondary labels 8pt.
- The print-margin licence/address footer remains unchanged. No PDF renderer dependency added; browser print remains the export path.

## Assumptions
- Continue the current experimental branch and PR, no merge or deployment.

## New TODOs / limitations
- Printed page count varies with geography, paper, browser and print settings; do not generalize a single sample to every report.
- The PDF baseline is Chromium Letter with backgrounds enabled. Initial density pass increased length due to inherited fonts and narrowed content width; corrected before final measurement.
- Local artifact URL is for preview only and must not be deployed.

## Verification
- npm run typecheck: passed.
- npm test: 575 tests across 85 files passed.
- git diff --check: passed.
- Production static build passed: 2,386 exported pages (local artifact URL).
- node scripts/check-reports.mjs: 12 desktop/mobile and light/dark report states passed, including WCAG A/AA checks, non-overlapping actions, no page overflow or runtime errors, retained table rows and visible publisher notices in print.
- Chromium PDF samples: Somerset County 23 Letter pages (baseline 24), 22 A4 pages; Princeton 20 Letter pages; ZIP sample 14 Letter pages. Page counts are not a promise for other reports.
- Rendered PDF opening, evidence-table and final source/notice pages inspected. Fixed print masthead clipping and cost-column overflow; full licence text and repeated margin attribution retained.
- Markdown/CSV links remain present and unchanged; downloaded artifact contents were not reverified.

## Follow-up: bottom-edge page breaks
- An exhaustive follow-up found cost figures crossing the reserved bottom content boundary on Letter and a mortgage ledger line crossing it on A4. The earlier selected-page inspection did not catch these; the original verification above should not be read as exhaustive.
- Print-only cost ledgers now use normal-flow table-cell pairs instead of fragmented grid/flex rows. Each row stays together; cost-view headings and headline figures stay together. Whole long cards may still span pages.
- Added a Poppler `pdftotext -bbox` regression check to `check-reports.mjs`; it fails if a word straddles the content/footer boundary. Poppler must be installed to run this diagnostic script. This supplements, not replaces, visual review.
- Reran typecheck, 575 tests, static build (2,386 pages), and all 12 responsive/theme report checks: passed.
- Regenerated four PDFs and checked all 79 page bottoms visually and by text bounding boxes: zero boundary-crossing words. Somerset remains 23 Letter / 22 A4 pages, Princeton 20 Letter, ZIP sample 14 Letter. Inspected the corrected ten-year cost section at full-page size as well.
- Chromium samples only; Safari/Firefox print engines, other geographies, custom scale and printer margins remain unverified. Screen design and calculations unchanged.
