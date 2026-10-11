# Tool colour and reader clarity

## What changed
- Home tool cards use quiet off-centre radial washes: slate for affordability, rose for buyer’s guide, teal for tax lookup. Icons, arrows, scope chips and hover borders follow those palettes.
- Income panel leads with programme income limits and their purpose, clearer column labels and an expandable explanation of adjusted percentage bands versus housing spending percentages.
- Reader-specific income sentences no longer describe adjusted limits as exact percentages of median income.
- Tax results explain assessed value, class-specific assessment comparisons, the town-wide Director’s Ratio and the different bases/purposes of general and effective rates.

## Files/modules affected
- `web/app/page.tsx`, `web/app/home-refresh.css`, `web/app/ui-refinement.css`
- `web/components/ForYourHousehold.tsx`, `web/components/TaxLookup.tsx`
- `web/lib/household.ts`, `web/lib/household.test.ts`
- `web/scripts/check-reader-clarity.mjs`

## Architectural or implementation decisions
- Presentation only: calculations, thresholds, percentile population, source records and eligibility logic are unchanged.
- Retained official terms alongside practical explanations, including no automatic eligibility claim and no parcel appraisal claim.
- Added detail through one native disclosure rather than a large always-visible paragraph; respected reduced motion.
- Browser tax checks use explicitly synthetic intercepted records, never published as real property data.

## Assumptions
- HUD bands are adjusted published income limits, not direct arithmetic on a town’s median income.
- Tool colour washes echo destination backgrounds rather than copying all page theme tokens.

## New TODOs / limitations
- Tool card palettes are local CSS tokens; keep them coordinated if destination themes change.
- Canonical docs remain untouched. Claude may wish to reconcile the earlier income-band presentation guidance with this plain-language correction.
- No new data, deployment, or general redesign of unrelated sections.

## Source verification
- HUD income limits: https://www.huduser.gov/portal/datasets/il.html/
- HUD explains family-size and other adjustments: https://www.huduser.gov/portal/pdredge/pdr-edge-featd-article-060525.html
- NJ general property-tax information: https://www.nj.gov/treasury/taxation/lpt/genlpt.shtml
- NJ statistical information / effective versus general rates: https://www.nj.gov/treasury/taxation/lpt/statdata.shtml

## Verification
- `npm run typecheck`: passed.
- `npm test`: 599 tests across 89 files passed, including regression coverage against exact-percentage wording.
- Initial production build could not reach the stopped local API; started the API and reran. Final production build passed: 2,384 pages, 2,366 compatibility aliases and 16,685 files.
- `node scripts/check-reader-clarity.mjs`: six width/theme combinations passed (320/390/1280px, light/dark), checking distinct card gradients, title/icon colour agreement, income disclosure, synthetic tax result and no horizontal overflow.
- Inspected mobile screenshots of cards, expanded income explanation and tax result. First browser diagnostic ran before export completed; a subsequent diagnostic used textbox instead of combobox for the town input. Corrected the test selector and reran successfully.
- No separate lint command is configured in the frontend package.
- `git diff --check`: passed.
