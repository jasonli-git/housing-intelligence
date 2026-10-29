# Compact market opening

## What changed

Tightened Princeton's Market at a glance section without hiding information or removing either chart type. Reduced finding padding, headline value size and supporting-copy spacing; put trend dates and exact-value readout on one row; tightened the tenure summary and section margin.

## Files/modules affected

- `web/components/PlaceMarketOpening.module.css`

## Architectural or implementation decisions

CSS-only, scoped to the existing Princeton pilot. Box distributions, trend geometry, data, accessible descriptions and 44px interactive targets remain unchanged.

## Assumptions

The goal is a denser visible summary, not another disclosure or removal of the comparisons.

## New TODOs / limitations

Measured section heights with current local data: 390px viewport 1196.39 → 1077.41px (119px / 9.9% reduction); 1440px viewport 721.73 → 644.95px (77px / 10.6%). Content-dependent heights may differ with future data. No other place-page layouts changed. Local-only work; no push or deployment.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 836 tests, 140 files passed.
- `node scripts/check-place-hierarchy.mjs`: passed after the local server correction below; all five widths in both themes, interactions, accessibility, nonpilot preservation, comparison navigation/back and no-JavaScript checks.
- Scoped Next production build for place/compare/search/state routes: passed (1,188 routes).
- Visually inspected 390px and 1440px section screenshots.
- First browser run passed all ten width/theme checks and nonpilot checks, then timed out waiting for comparison data: the restarted artifact server lacked CORS headers. Restored those headers on the local preview service and reran the browser suite. No repository server changes were needed.
