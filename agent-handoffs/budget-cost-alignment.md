# Budget search and profile cost alignment

## What changed

- Budget search now uses the same full monthly cash-paid calculation as profile cost cards: mortgage principal and interest, property tax, insurance, utilities, upkeep and applicable mortgage insurance. It no longer calls mortgage plus tax the whole ownership estimate.
- Household income, available buying cash and personal cost assumptions synchronize between budget search, cost cards and the existing household section. Saved inputs follow the reader; home-specific price, tax, HOA, flood and moving/repair fields do not.
- County and municipality cost cards have a compact budget-fit disclosure and a comparison link retaining the selected place and income. Buying cash is checked separately against the upfront range, never treated as a mortgage-approval decision.
- Missing required cost inputs yield visibly incomplete estimates, excluded from the within-budget count and painted neutrally on the map. Rental results explicitly cover rent alone, not utilities, insurance or move-in cash.
- Towns without indexed home values or published rent remain selectable. They show missing-data explanations rather than losing the selected place. Transaction-price scenarios remain profile-only and never enter Zillow-based cross-place ownership comparisons.
- Printed reports continue to use published defaults, not saved personal inputs. No model readings were regenerated.

## Files/modules affected

- `web/lib/budgetScenario.ts`: shared ownership defaults, utility conversion and upfront-cash result wording.
- `web/components/useBudgetScenario.ts`, `web/lib/costScenario.ts`, `web/lib/household.ts`: SSR-safe hydration, saved cash, same-page and cross-tab input synchronization.
- `web/lib/afford.ts`, `web/lib/affordData.ts`, `web/lib/api.ts`: full ownership calculation, incomplete result state and batched observation loading.
- `web/components/AffordExplorer.tsx`, `web/components/CostToOwn.tsx`, `web/components/ForYourHousehold.tsx`, `web/app/regions/[id]/page.tsx`: connected controls, budget-fit disclosure and contextual handoff.
- `web/lib/costInputs.ts`, `web/app/globals.css`: shared utility aggregation and compact responsive controls.
- `web/lib/afford.test.ts`, `web/lib/affordData.test.ts`, `web/lib/household.test.ts`: calculation parity, missing data, observation batching and cash persistence tests.

## Architectural or implementation decisions

- Reused `eachMonth` and `upFront` rather than introducing a second ownership formula. Budget fit compares total cash paid, not the lower non-equity “money gone” number.
- ACS insurance and utility measures are deliberately unranked. Fetching them through rankings returned empty inputs and caused a real parity failure. The implementation instead reads the existing `/compare` observation API in batches of at most 90 regions, for four measures, at build time. No new backend endpoint or ranked measure was introduced.
- Annual ACS series have fixed five-year spans; their last observation by start date is also the latest by end date. Insurance and electricity are required where the existing profile calculator requires them; gas and water join electricity when supplied. The shared helper preserves the profile's existing treatment of missing components.
- Existing API error handling remains intact: persistent API failures fail the build. A missing/404 observation leaves that input unavailable and produces an incomplete estimate rather than silently inventing zero.
- Browser custom events synchronize mounted consumers; storage events synchronize tabs. Existing guarded localStorage reads/writes are retained.
- Personal rate and insurance quotes override published values, consistently across both views. Published source dates still describe the underlying published inputs, not the reader's quote.

## Assumptions

- The 30% of gross income line remains a comparison convention, not approval, eligibility or financial advice.
- Buying cash means the reader's available cash; the check covers the existing down-payment plus closing-cost range. Profile-specific moving and repair inputs can add to that range on the profile only.
- Cross-place comparisons continue to require Zillow home values and matched area tax bills. A transaction median is not an interchangeable home-value index.

## New TODOs / limitations

- Full ownership costs will put fewer places within the same income comparison than the former mortgage-plus-tax estimate. Claude should reconcile any canonical explanation of affordability inputs separately.
- Build-time observation loading requires the existing full analytics API, including `/compare`; the published static artifact is not a substitute for that endpoint. Roughly 28 additional bounded read requests cover all NJ counties and towns.
- HOA, flood insurance and individual-home costs remain unknown in cross-place search. Missing electricity makes utilities incomplete; missing gas/water preserves existing profile behavior rather than asserting all utility components are known.
- Rental deposits, moving fees, renters insurance and utilities are not estimated in budget search. Reader-entered rent remains part of the separate household section rather than replacing each area's comparison rent.
- Missing home values/tax bills still suppress cross-place ownership results. Transaction-only places keep their profile scenario, not a comparable ownership rank.
- If browser storage is blocked, changes synchronize within the current page but do not persist across navigation.
- No backend/source-method changes, model regeneration, canonical-document edits, merge or deployment.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 424 tests passed across 47 files, including three observation-loader regression tests.
- Headless Chromium: Somerset profile and budget search both showed $5,399/month at published defaults on 390px and 320px screens, with no horizontal overflow. Desktop shared custom assumptions gave $4,753 in both views; changing the mortgage quote from 5.5% to 6% changed the profile to $4,923.
- Same-page cost-card income entry updated the existing household income control to 120000. Comparison navigation preserved income and down payment.
- Montgomery, a town without Zillow value/rent for this comparison, remained selected and showed explicit missing-data messages; no transaction median substituted.
- At 3.5% down with a reader-entered PMI assumption, profile and comparison both showed $5,737/month and comparison retained 3.5% down. With those personal inputs still stored, `/regions/12/report` returned HTTP 200, had zero personal budget-fit widgets, omitted the saved 5.50% quote and retained its published $5,399/month cost.
- Inspected 320px cost-card/budget-fit screenshot. Initial browser scripts had an ambiguous select locator and a transaction-only fixture mistaken for an indexed-price fixture; corrected checks passed.
- `npm run build`: passed; 2,379 static outputs, with static generation taking 23.7 seconds. The existing `NEXT_PUBLIC_ARTIFACT_URL` warning remains: report Markdown links point to localhost in this local build; deploy configuration must supply the published origin.
- `git diff --check`: passed.
