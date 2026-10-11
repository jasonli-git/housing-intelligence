# Place / guide content focus

## What changed
- Approved Housing help tool at `/help`: official application routes and the existing sourced New Jersey programme/property explorer, accessible from Tools and compact place-page help. Reuses the current overview and lazy inventory; no new data or eligibility claims. Coverage is explicitly New Jersey-only, not a misleading multi-state selector. Buyer’s guide help remains available.
- Migration-table internal links now explicitly use the county destination class. Their records are county-to-county flows; external IRS citations remain external-source blue.
- Recommendations only, not implemented: expose essential Make it yours inputs before its optional fine tuning; turn factual context into individually approachable learning exhibits. Await design approval before altering those sections.
- Desktop follow-up: remove the rate table's inherited 34rem minimum width, which clipped its third column inside a desktop cost card despite no document overflow. Add a regression assertion against the disclosure's actual bounds.
- Restore shared 16–22px horizontal insets to visible history, market, migration, similar-town and county-directory sections across place levels. Similar-town links now use the municipality destination colour; local anchor links use the place accent, while existing guide/tax/budget and external-source colours remain intact.
- Housing help as a separate, state-aware tool is recommended but not implemented or authorized in this follow-up. Initial coverage would be New Jersey only; do not imply nationwide programme coverage.
- Approved discoverability follow-up supersedes the initial retirement of profile cost tools: interactive inputs, monthly budget and upfront/long-term views are restored. The buyer's guide retains all of its corresponding capabilities. Similar places stay in the visible exploration area rather than appearing twice, and the cost tools have one Continue link.
- Mortgage-rate ReaderDetails now participates in the narrow-screen full-width card layout; its body has accessible horizontal overflow and wrapping table headers. This fixes the old selector targeting only QuietDisclosure after that expansion was changed to ReaderDetails.
- Place pages retain the three housing-help application links but not the long programme/property directory. The guide adds a Housing help navigation destination and the full shared programme/property component, with sources/limits unchanged.
- Explicit Continue copies only entered home-specific figures and rent into session storage, keyed to the selected place. The guide validates these fields and reads them only for that place; personal assumptions continue using existing browser storage. No source figures or rankings change.
- The guide reads the publisher's small `affordable-housing/overview.json` first; the existing shared component loads full inventory only when its programme/property detail is opened.
- Experimental division of responsibility: local profiles explain the place; the buyer's guide hosts personal purchase planning.
- County, municipality (including towns/boroughs) and ZIP profiles retain published monthly costs, the difference bridge, breakdown, caveats, local readings, ranks and evidence. Their cost card now uses published/default assumptions rather than silently applying remembered personal scenarios.
- Removed the rendered personal-input, monthly-budget, upfront/long-term and household-tool group from local cost cards. Replaced the lengthy property-action checklist with a visible place-aware buyer's-guide entry.
- Prices/paychecks, local market and migration no longer require outer disclosures. Property/community context and lending no longer add another outer disclosure within the main evidence expansion. Similar places remain visible near county/place exploration. Housing help remains available independently of buying.
- Guide has a visible three-destination navigator. Before selection it points to the place picker; after selection it points directly to the answers. Empty result blocks are hidden until a place is chosen.
- Guide supports home price, annual tax, HOA, flood insurance, moving/repairs, cash available, insurance, PMI, upkeep, closing costs, rent growth and selling commission. Upfront cash and cash-fit text use the existing shared ownership model. Existing years, rate, down payment, rent and appreciation controls remain.
- Pre-offer actions are visible in Costs & financing, Property & environment and Everyday life. One supporting checklist appendix holds figures, limits, evidence labels and extra links; it is not required to discover the primary actions. Programme thresholds/rents by size are optional supporting material, not a large always-visible panel.

## Files/modules affected
- `web/lib/guideTransfer.ts` and its tests
- `web/app/quiet-county.css`
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
- The initial statement below about profile costs using only defaults is superseded by the approved restoration. Profile costs once again honor the existing personal assumptions and entered home figures. The `planning` extension remains default-true for compatibility.
- If session storage is unavailable, Continue still navigates; home-specific transfer cannot persist. Personal assumptions retain their existing guarded storage behavior. Transfer lasts only for the browser session and does not carry into a different place.
- Remaining disclosure counts in tested profiles are 35 (Somerset County), 27 (Princeton) and 20 (ZIP 2842's legacy route), including definitions, notices and evidence detail. These are absolute post-change counts, not a measured before/after reduction. No quantitative scroll reduction is claimed.
- Some factual subcomponents retain their own long-detail disclosures. A future pass can assess those separately without hiding the first useful answer.
- Programme/rent context in the guide retains its existing household component and underlying official limits; this branch does not change eligibility methodology.
- Static localhost preview cannot directly read production artifacts because production CORS does not allow localhost:3002. Browser diagnostic bridges artifact requests to real local API endpoints only in Playwright; production configuration is untouched. Local guide walkthrough needs an approved artifact preview/proxy or suitable environment configuration.
- Canonical documentation and underlying datasets are untouched. Claude should review the intentional distinction between published/default profile costs and personal guide scenarios before reconciling project documents.

## Verification
- Housing-help follow-up: typecheck and 604 tests / 91 files passed; export passed with 2,385 pages, 2,366 aliases and 16,692 files. Responsive browser diagnostic covers the standalone help title, explicit NJ-only coverage, three official routes and no horizontal overflow, alongside existing county/town/ZIP and guide checks. Sitemap entry added after that export; its local generated sitemap will refresh at the next build.
- Desktop-spacing follow-up: `npm run typecheck` and all 604 tests / 91 files passed. `node scripts/check-place-guide-focus.mjs` passed county/town/ZIP at 320/390/1280px in light/dark, including new table-within-disclosure and minimum 16px context-inset assertions. `git diff --check` passed. Static export passed with 2,384 pages, 2,366 aliases and 16,685 files; final colour-selector export is checked before committing. No new route, dataset, merge or deployment.
- Discoverability follow-up: typecheck and 604 tests across 91 files passed, including session transfer isolation and corrupt input guards. Six width/theme browser combinations passed on county, town and ZIP profiles; restored inputs, mobile rate expansion, compact place help links, guide help, explicit home transfer and different-place isolation verified. At 320px the expanded table measured 231px within a 258px body, with no clipped horizontal content. Visual inspection prompted keeping the short Rate header on one line. Production export passed with unchanged page/file counts; final CSS re-export recorded below.
- `npm run typecheck`: passed.
- `npm test`: 602 tests across 90 files passed, including no planning-panel rendering, published defaults despite remembered personal inputs, guide navigator and quote/upfront parity with the shared model.
- Initial build failed because the local API was stopped. Restarted the API; production export passed with 2,384 pages, 2,366 compatibility aliases and 16,685 files. A final presentation rebuild and browser rerun are recorded below when completed.
- Chromium diagnostic on 320/390/1280px, light/dark passed before the last supporting-detail compactness adjustment. County/town/ZIP profiles have no duplicate personal/checklist panels or horizontal overflow; guide quote inputs, upfront answer, three checklist groups and ten visible check actions passed with real API data.
- Inspected the mobile dark guide screenshot; reduced excessive always-visible programme tables and supplementary school-report links afterwards.
- First browser runs timed out because their artifact requests hit production CORS; corrected the test's hostname matching and mapped its `.json` requests to the real local API routes. No synthetic records used.
- No frontend lint command is configured. No merge or deployment authorized.
- Follow-up final export passed (2,384 pages, 2,366 aliases, 16,685 files). Final six responsive/theme combinations passed after the overview-path change, including opening guide programme detail. The short Rate header is nowrap at 320px. Restored disclosure totals are 39/31/27 for the sampled county/town/ZIP; this approved middle ground restores planning interactions while retaining the flatter contextual/evidence structure.
- Final presentation export passed with the same 2,384 pages / 2,366 aliases / 16,685 files. Final six width/theme browser combinations passed: real API quote inputs and upfront calculation, three visible checklist groups, ten actions with no primary-action accordions, one checklist supporting appendix, and no horizontal overflow. `git diff --check` passed.
