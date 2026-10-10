# Local actions, context and evidence

## What changed
- Reorganised local reading into action-first Your next step, Understand this place, county town exploration, then evidence.
- Address checks lead with tax, schools, flood, water, internet and contaminated-site lookups. Commute/provider/public-safety actions open supporting evidence and transfer focus, without implying nearest equals assigned/serving.
- Moved flood/water records, utilities, commuting, schools, broadband, crime completeness and population-health estimates into property/community evidence. Existing explanations, source links and limitations remain.
- The local picture leads the contextual group; historical affordability, market activity and migration follow. One static architectural field connects the group; repeated disclosure artwork is suppressed there.
- Historical lending is evidence, not a personal calculator input.
- County town directory has locally filtered search, six initial links and expandable remaining towns, using explicit parent_id relationships.
- Added paired construction bars and county resident-job destination shares inside evidence. Existing tables remain; missing values stay missing and incomplete work-share sets suppress the chart.
- Sales preview discloses both endpoints of the qualifying transaction window. Construction chart explains that county bars cover separate reporters while net includes towns reporting both.

## Files/modules affected
- web/app/regions/[id]/page.tsx
- web/components/LocalNextSteps.tsx
- web/components/CountyPlaces.tsx
- web/components/LocalEvidenceCharts.tsx and its tests
- web/components/CommunityContext.tsx
- web/app/ui-refinement.css
- web/scripts/check-local-refinement.mjs

## Architectural or implementation decisions
- Frontend presentation only. No acquisition, numerical-method changes, model regeneration or new dependency.
- Reuse existing official URLs; police service must be confirmed with the town. No verified police jurisdiction/address lookup was available, so no nearest-station claim or invented directory link.
- Shared CommunityContext defaults remain unchanged for full reports; supporting presentation is opt-in on local pages.
- Construction uses existing complete-year/preliminary rules, separate from permits. Work shares require all five finite shares in [0,1] summing to approximately one; missing shares are not zero.
- Personal cost scenarios remain integrated with their calculator state; property actions/help now form their own coordinated group beneath it.

## Assumptions
- All local tiers retain the shared design and existing cohort/source distinctions.
- Town directory membership comes from the API's explicit county-parent filter, not names or nearest geography.

## New TODOs / limitations
- No county–ZIP overlap directory: no verified relationship feed established in this pass. Global ZIP search remains, with boundary-crossing explanation.
- Income-band burden chart deferred: loaded CHAS metrics are aggregate renter/owner burden shares, not band-specific values. Additional source modelling would be needed, not fabricated frontend disaggregation.
- Migration retains existing component; no new speculative takeaway calculation.
- An address-specific police jurisdiction/supplier/school assignment tool is not built. Official lookups and confirmation guidance are distinct from area associations.
- Evidence contains existing source-specific disclosures; their technical detail is retained rather than flattened into misleading headline figures.
- Existing stale-model warnings remain visible; no model text was regenerated to hide them.
- Full reports/canonical documents untouched. Never deploy the local localhost artifact build configuration.

## Verification
- npm run typecheck and npm test: 573 tests across 84 files passed.
- NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386-page static export.
- node scripts/check-local-refinement.mjs: all 36 states passed across Somerset County, Princeton, Parsippany, Walpack, ZIP 07001 and sparse ZIP 07004 at 1280/390/320px, light/dark. Includes county-filtering, action-to-evidence focus/open behaviour, section jumps, expanded reflow, runtime errors and automated WCAG rules.
- Desktop actions/context/charts visually inspected. Final help-card background verified as neutral rgb(37,38,41) in dark mode.
- git diff --check: passed. No separate frontend lint command is configured.
- Added regression coverage for complete job shares, missing shares and ZIP non-substitution.
- Full backend tests and manual exhaustive accessibility audit are outside this presentation-only pass.
