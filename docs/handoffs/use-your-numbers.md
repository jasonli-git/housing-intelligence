# Use your numbers

## What changed

Replaced the compact place-page “Make it yours” planning group with controls inside the monthly cost card. Income, down payment and purchase price stay visible. One live result reports the payment as a share of income before tax, naming missing costs when the estimate is partial. More assumptions holds the remaining monthly inputs; removed the duplicate MonthlyBill visualization from that compact view. Added a short highlight on the main payment when it changes, respecting reduced motion.

Upfront cash, multi-year projections and the injected income/nearby panels no longer render in compact mode. Place-aware links lead to the buyer’s guide and supported Find your fit comparisons. The guide link explicitly transfers entered home inputs using the existing mechanism; shared income/down-payment preferences remain remembered as before. Cash available and alternative rent inputs remain in the full planning experience, not in these compact controls.

## Files/modules affected

- `web/components/CostToOwn.tsx`
- `web/components/CostToOwn.test.tsx`
- `web/app/place-overview.module.css`

## Architectural or implementation decisions

Use existing `compactOverview` boundary; no new arithmetic, source data, routes or storage format. All compact place cost cards receive the same treatment. Noncompact guide/report planning remains available. Main payment updates retain their live region; the added CSS highlight replays on a changed monthly total. Explicitly label the down-payment selector so option text does not become part of its accessible name.

## Assumptions

Place pages adjust a local monthly estimate; deeper decisions belong in tools. Continue using `comparePlaceId` for supported Find your fit links (county/municipality); do not invent ZIP support. `guidePlaceId` supplies the place-aware guide link.

## New TODOs / limitations

No automatic navigation or scrolling on edits. The shared household preferences still apply in tools. Additional monthly inputs and reset remain in one More assumptions expansion. No canonical documentation edits. Local-only branch work, no push/deployment.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 838 tests in 140 files passed. Tests cover visible inputs, removal of compact planning panels/duplicate bill, edited totals/reset, partial-cost text, income link and explicit guide transfer.
- Browser checks at 320, 390, 768 and 1440px in both themes: passed for visible primary controls, live payment changes/reset, carried-income link, no horizontal overflow and scoped axe accessibility.
- Visually inspected mobile and desktop control screenshots.
- Initial browser harness used an exact label that included select option text; added an explicit accessible selector name and reran successfully. Initial unit run identified the old group-name expectation; updated for the approved new presentation. An npm invocation from repo root failed due to no root package.json; reran in web.
- Scoped production build for place, compare, search and state routes: passed (1,188 routes).
- `git diff --check`: passed.

## Follow-up: controls at the top

Moved the existing control group to the first child of the cost card, ahead of the monthly figures, in both DOM and visual order. Changed its separator to the bottom edge. No inputs, calculations or tool links changed. Typecheck and CostToOwn component tests rerun; desktop/mobile light/dark browser checks verify placement, input operation and overflow.
