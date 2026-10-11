# Place / guide content focus

## What changed
- Experimental division of responsibility: local profiles explain the place; the buyer's guide hosts personal purchase planning.
- County, municipality (including towns/boroughs) and ZIP profiles retain published monthly costs, the difference bridge, breakdown, caveats, local readings, ranks and evidence. Their cost card now uses published/default assumptions rather than silently applying remembered personal scenarios.
- Removed the rendered personal-input, monthly-budget, upfront/long-term and household-tool group from local cost cards. Replaced the lengthy property-action checklist with a visible place-aware buyer's-guide entry.
- Prices/paychecks, local market and migration no longer require outer disclosures. Property/community context and lending no longer add another outer disclosure within the main evidence expansion. Similar places remain visible near county/place exploration. Housing help remains available independently of buying.
- Guide has a visible three-destination navigator. Before selection it points to the place picker; after selection it points directly to the answers. Empty result blocks are hidden until a place is chosen.
- Guide supports home price, annual tax, HOA, flood insurance, moving/repairs, cash available, insurance, PMI, upkeep, closing costs, rent growth and selling commission. Upfront cash and cash-fit text use the existing shared ownership model. Existing years, rate, down payment, rent and appreciation controls remain.
- Pre-offer actions are visible in Costs & financing, Property & environment and Everyday life. One supporting checklist appendix holds figures, limits, evidence labels and extra links; it is not required to discover the primary actions. Programme thresholds/rents by size are optional supporting material, not a large always-visible panel.

## Files/modules affected
- `web/app/[state]/[place]/page.tsx`
- `web/components/CostToOwn.tsx` and regression tests
- `web/components/DecisionGuide.tsx` and regression tests
- `web/lib/guide.ts` and arithmetic tests
- `web/components/SectionJump.tsx`
- `web/app/guide.css`
- `web/scripts/check-place-guide-focus.mjs`

## Architectural or implementation decisions
- `planning` defaults to true on the shared cost component, preserving existing report/other consumers. Only local profiles disable it and interactive controls; report routes were not edited.
- Guide overrides are passed to `ownershipInputs`, `eachMonth`, `upFront` and `overYears`; no replacement financial model or forecast was introduced.
- Reader prices have a distinct `reader` basis and do not masquerade as Zillow/SR1A values. Reader tax/insurance do not receive publisher citations. Evidence labels cover remaining published inputs, not verification of quotes.
- Home-specific inputs and entered rent reset when changing place; remembered personal assumptions retain existing browser storage behavior.
- Retained inner source/definition/calculation disclosures where genuinely supporting. This is not an attempt to delete every native details element or all metadata from profiles.

## Assumptions
- A fixed published/default place-level cost is the introductory comparison; individualized assumptions belong in the guide.
- Readers seeking assistance still need housing-help routes without entering a buyer's guide.
- Primary pre-offer actions can be discovered without reading the full area evidence. The visible warning distinguishes an area's figures from a property's risk, school assignment and service.

## New TODOs / limitations
- Remaining disclosure counts in tested profiles are 35 (Somerset County), 27 (Princeton) and 20 (ZIP 2842's legacy route), including definitions, notices and evidence detail. These are absolute post-change counts, not a measured before/after reduction. No quantitative scroll reduction is claimed.
- Some factual subcomponents retain their own long-detail disclosures. A future pass can assess those separately without hiding the first useful answer.
- Programme/rent context in the guide retains its existing household component and underlying official limits; this branch does not change eligibility methodology.
- Static localhost preview cannot directly read production artifacts because production CORS does not allow localhost:3002. Browser diagnostic bridges artifact requests to real local API endpoints only in Playwright; production configuration is untouched. Local guide walkthrough needs an approved artifact preview/proxy or suitable environment configuration.
- Canonical documentation and underlying datasets are untouched. Claude should review the intentional distinction between published/default profile costs and personal guide scenarios before reconciling project documents.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 602 tests across 90 files passed, including no planning-panel rendering, published defaults despite remembered personal inputs, guide navigator and quote/upfront parity with the shared model.
- Initial build failed because the local API was stopped. Restarted the API; production export passed with 2,384 pages, 2,366 compatibility aliases and 16,685 files. A final presentation rebuild and browser rerun are recorded below when completed.
- Chromium diagnostic on 320/390/1280px, light/dark passed before the last supporting-detail compactness adjustment. County/town/ZIP profiles have no duplicate personal/checklist panels or horizontal overflow; guide quote inputs, upfront answer, three checklist groups and ten visible check actions passed with real API data.
- Inspected the mobile dark guide screenshot; reduced excessive always-visible programme tables and supplementary school-report links afterwards.
- First browser runs timed out because their artifact requests hit production CORS; corrected the test's hostname matching and mapped its `.json` requests to the real local API routes. No synthetic records used.
- No frontend lint command is configured. No merge or deployment authorized.
- Final presentation export passed with the same 2,384 pages / 2,366 aliases / 16,685 files. Final six width/theme browser combinations passed: real API quote inputs and upfront calculation, three visible checklist groups, ten actions with no primary-action accordions, one checklist supporting appendix, and no horizontal overflow. `git diff --check` passed.
