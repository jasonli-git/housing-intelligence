# New Jersey discovery refinement

## What changed

- Removed the redundant header county-count shortcut; directory now supplies the count once.
- Place discovery has concise search guidance, a distinct Find your fit link with explicit statewide scope, and cleaner county rows without repeated County labels. All 21 links stay visible; two columns on mobile.
- Snapshot has aligned figure scales, softer separators and static, decorative geometry. Dates, sale-price basis, national mortgage scope, preliminary construction labels and reporting coverage remain visible.
- Comparison and blue statewide evidence have more closely related compact disclosure treatments. Existing tables, selectors and expansions remain.
- Tightened NJ publisher-notice spacing; no attribution wording removed or hidden.

## Files/modules affected

- `web/app/states/new-jersey/page.tsx`
- `web/components/StateModeWorkspace.tsx`
- `web/components/CountyComparison.tsx`
- `web/app/ui-refinement.css`
- `web/scripts/check-state-refinement.mjs`

## Architectural or implementation decisions

- Keep place discovery primary and comparisons secondary; no map restoration or data changes.
- Decorative shapes are CSS pseudo-elements, not quantitative plots; static and omitted in print.
- SourceFooter documents publisher statements as required visible notices. Preserve that conservative contract instead of assuming an accordion meets publisher terms. No new licensing conclusions claimed.

## Assumptions

- User approved recommendations on the existing experimental branch / PR #141.

## New TODOs / limitations

- A source-by-source terms review is needed before collapsing required publisher statements; not implemented here.
- Local build uses the existing read-only artifact proxy at port 8001, not production settings. Never deploy its localhost artifact URL.
- Real-device and screen-reader review remains useful.

## Verification

- `npm run typecheck`: passed. `npm test`: 565 tests across 81 files passed.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build`: final build passed, 2,386 static pages.
- `A11Y_ORIGIN=http://localhost:3002 node scripts/check-state-refinement.mjs`: six width/theme states passed (1280, 390, 320px; light/dark). Checked all 21 county links, statewide budget scope, visible caveats/notices, keyboard disclosure opening, populated comparison table, page reflow, no JavaScript errors and WCAG-tagged axe audits with expansions open.
- Reviewed desktop light and mobile dark viewport screenshots, plus mobile full-page layout. Decorative geometry remains subtle; county labels remain readable in two columns.
- `git diff --check`: passed. No separate frontend linter configured; no backend tests for presentation-only work. No canonical documentation edits, merge or deployment.
