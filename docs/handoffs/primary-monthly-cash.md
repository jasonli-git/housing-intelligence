# Primary monthly cash

## What changed

Place-page compact cost cards now lead with estimated cash paid each month, including mortgage principal. The difference bridge is inside the existing shared breakdown, labeled “After principal builds equity,” with an explicit explanation that it is not the cash needed each month. Removed its standalone position below the card/context.

## Files/modules affected

- `web/components/CostToOwn.tsx`
- `web/components/CostToOwn.test.tsx`
- `web/app/place-overview.module.css`

## Architectural or implementation decisions

The two totals were not survey vs. modeled values. The headline is `month.total` (cash including principal and included utilities); the bridge uses `month.gone - utilitiesLine` (principal and utilities excluded). No arithmetic changed. Keep the bridge as supporting explanation rather than a competing headline; reuse the existing See the breakdown button, no additional disclosure level. The bridge spans both ledger columns when open. Collapse the unused explicit grid row.

## Assumptions

Applies to compact place cost cards, which share this presentation. Noncompact buyer-guide/report presentation remains unchanged. Missing costs and all existing partial-estimate caveats remain visible. This is local experimental work on the assigned branch; no push or deploy.

## New TODOs / limitations

No new data, financial assumptions, or behavior changes to calculations. The bridge still excludes utilities from both sides; opening it explains that distinction. This change does not eliminate totals inside supporting ledgers or fine-tuning tools.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 837 tests across 140 files passed. Added regression for a single primary cash figure, bridge placement/toggle, and edited-price/reset behavior.
- `git diff --check`: passed.
- Responsive browser checks: passed at 320, 390, 768 and 1440px in light/dark themes; one primary cash headline, bridge hidden initially, opens/closes with existing button, no card overflow, scoped axe passed. Visually inspected mobile light screenshot.
- Scoped Next production export: passed (1,188 place/compare/search/state routes).
- Initial custom accessibility harness needed an explicit `browser.newContext()`; corrected the harness and reran, without application changes.
