# Build the monthly bill

## What changed
- Added an interactive cost-layer stack inside existing Fine-tune the costs, without another calculator or disclosure. Existing fields drive the stack and current cost card together.
- Kept the starting estimate separate at the published inputs/default 20% down; included published insurance/utilities and the existing upkeep allowance rather than artificially reducing the baseline to mortgage/tax.
- Each selectable layer explains its basis. Missing amounts are not zero; optional HOA/flood expenses remain conditional. First-month principal is separated from money spent.

## Files/modules affected
- `web/components/MonthlyBill.tsx`: labelled interactive monthly shares and basis explanations.
- `web/components/CostToOwn.tsx`, its tests: existing engine inputs, baseline and integration.
- `web/app/learning-exhibits.css`: responsive, theme-aware stack and reduced-motion styling.
- `web/scripts/check-monthly-bill.mjs`: reproducible local browser diagnostic.

## Architectural or implementation decisions
- Reuses `ownershipInputs` and `eachMonth`; no new arithmetic model, assumptions, data or storage mechanism.
- Widths show actual shares of included monthly cash; labels show dollar estimates, missing and conditional states. Includes zero-valued rows so entering zero remains distinct from leaving blank.
- Uses existing personalisation persistence: personal assumptions follow the reader in this browser; property inputs stay on the page.
- No automatic animation of numbers or announcements on every keystroke. Native buttons provide keyboard access.
- Noninteractive reports do not render the personalisation area; existing print styles hide it.

## Assumptions
- Approved first experience is Build the monthly bill, not One home, two paths. The latter remains unimplemented.
- Source figures are area estimates, not property quotes. Starting estimate can be incomplete and is labelled accordingly.

## New TODOs / limitations
- Lives inside the existing Fine-tune disclosure; this does not reorganise the entire personalisation form.
- Does not add investment-return scenarios or change upkeep's existing percentage input into a new dollar input.
- Rounded dollar labels are estimates; layer widths use unrounded engine values.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 631 tests passed across 95 files, including input updates, stable baseline, source explanations and principal/missing labels.
- `npm run build`: passed; 2,386 static outputs, 2,366 aliases and 16,694 exported files.
- `node scripts/check-monthly-bill.mjs`: passed at 320/390/1280px in both themes. Verified HOA and annual flood inputs, stable baseline, keyboard layer selection, no horizontal overflow, scoped axe accessibility and print omission. Initial axe run found a skipped heading level; corrected and the full diagnostic rerun passed.
- Mobile screenshot inspected; `git diff --check` passed.
- No backend changes; no backend tests run. No configured frontend lint command.
