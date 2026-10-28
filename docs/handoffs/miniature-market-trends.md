# Miniature market trends

## What changed

Moved each market trend into the same row as its large home-value/rent figure and reduced it to a sparkline. Kept percent change and year endpoints visible. Exact dates/values appear when hovering or focusing the interactive plot; touch selects a point and focuses the same readout. Keyboard arrows and Home/End still browse the original observations. Box distributions remain below.

## Files/modules affected

- `PlaceMarketOpening.tsx`, its CSS module, and `MarketPortraitCharts.tsx`.
- `scripts/check-place-hierarchy.mjs`.

## Architectural or implementation decisions

Princeton pilot only, no new data or arithmetic. Trend viewBox is 160×48 rather than 440×68, with a minimum 44px interaction area. Pointer coordinate conversion uses the new chart width; peer plots retain their original 440-unit scale. Preserve missing-month path breaks, real values, and flat-series behavior. Removed crowded visible value-axis labels; exact values remain available by interaction and in accessible descriptions. Separate vertical scales and nominal dollars remain explicitly disclosed. Cap the combined value/chart group width so the miniature sits near its number even on desktop.

## Assumptions

The large monetary figure remains the primary reading; a small chart supplies historical shape. Year labels are compact, with complete range dates in accessible text/title and exact selected dates in the readout.

## New TODOs / limitations

No backend, source, warehouse or other place layout changes. No push/deploy. A miniature is less suitable for fine visual comparisons; exact scrubbing and full report remain available.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 842 tests in 142 files passed.
- Updated browser regression checks miniature geometry beside each value, keyboard/exact-value behavior and the existing peer/cost/accessibility checks.
- Visually reviewed 320px and 1440px captures, with additional 390/768px captures.
- Initial browser assertion read hidden tooltip text with innerText; adapted to textContent and reran. An npm invocation from root found no root package.json; reran successfully from web.
- Final browser/build outcomes appended on completion.
- Five widths × both themes passed the hierarchy browser suite, including scoped axe, peer/keyboard interactions, cost inputs/reset, nonpilot preservation, comparison navigation/back and no-JavaScript figures/four SVGs.
- Additional final-layout checks at 320, 600 and 1440px passed adjacency, miniature touch coordinate selection, visible exact readout and no overflow. Added those pointer/touch assertions to the regression script.
- Scoped production build passed (1,188 routes). `git diff --check` passed. No backend/warehouse work was needed or run.

## Follow-up: match the national metric sparklines

The user requested a substantially smaller graphic, using the home page as reference. Inspected `national-strip.css`: its national sparkline is 20px high, with a 1.4px non-scaling stroke. Local trend graphics now use that height/stroke at 80px wide, within the retained 44px interaction target. Compact percentage and year labels fit inside the same 44px row. Updated the geometry assertions; pointer mapping remains correct through preserveAspectRatio=none. No data or calculations changed.

Verification: TypeScript and 19 focused market tests passed; browser checks at 320/600/1440px in both themes passed 80×20 geometry, touch/keyboard readouts, 44px targets, overflow and scoped axe. No full suite/production rebuild repeated for this size refinement.

## Follow-up: wide trend with value overlaid

The user requested a wider chart behind the large value. The chart now spans the finding width in a 72px-high value area, with a 48px-high SVG. The monetary value overlays the muted line with a theme-aware text halo. Plot marks use 30% opacity; the percentage and year labels retain their normal contrast. The figure ignores pointer events so scrubbing works across the entire chart, including behind the text. Tooltip, keyboard and actual-data scaling remain unchanged; missing history retains an explicit message.

Updated the shared browser harness to assert overlay geometry. Typecheck, 19 focused market tests and 320/600/1440px light/dark browser checks passed for geometry, touch/keyboard readouts, overflow and scoped axe. Visually inspected desktop dark and narrow mobile light captures. No full suite/production build repeated for this CSS-only experiment.
