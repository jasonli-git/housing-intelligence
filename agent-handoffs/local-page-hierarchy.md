# Local page hierarchy

## What changed
- County, municipality and ZIP pages share a tighter opening with normal-flow section/report actions; retained population definition, orientation details and abstract housing profile.
- Moved the computed paycheck comparison from the opening into a Prices & paychecks over time disclosure alongside existing historical context.
- Personal cost tools are labelled Make it yours with a neutral grey panel. Income/nearby-place detail remains available, with a scoped buyer-guide action.
- Moved property checks and housing help out of the cost-tools group. Official help routes are three neutral cards, followed by programme/source details. Existing inventory behaviour remains.
- Property topic previews now include schools, internet and commuting. Local-market summaries show actual dated sales/building figures where supplied.
- Shortened the evidence subtitle, retaining all tables, trends, downloads and automated summary content.

## Files/modules affected
- web/app/regions/[id]/page.tsx
- web/app/ui-refinement.css
- web/components/QuietCounty.tsx
- web/components/AffordableHousing.tsx
- web/components/SectionJump.tsx
- web/scripts/check-local-refinement.mjs

## Architectural or implementation decisions
- Presentation and placement only; no acquisitions, numerical-method changes or model regeneration.
- Reuse existing programme links, metric formatting and dates. Missing cost estimates still explain missing data, with household/help/property resources available independently.
- Section jump includes the historical wrapper once, avoiding a second nested historical destination.
- Kept the cost bridge, omitted-cost warnings, source/price-basis distinctions and existing model badge untouched.

## Assumptions
- County, municipality and ZIP pages remain a shared design family; data determines available sections.
- Full report pages are reserved for the later pass. Canonical documents are untouched.

## New TODOs / limitations
- Property detail retains existing internal components and disclosures; this pass improves placement/previews rather than rebuilding each source-specific display.
- No new migration preview, extra historical chart or animated graphic; existing evidence is retained rather than manufacturing missing coverage.
- Local preview uses localhost artifact URL; never deploy that local build configuration.

## Verification
- npm run typecheck and npm test: passed, 570 tests across 83 files.
- NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386-page static export.
- node scripts/check-local-refinement.mjs: all 36 states passed; county, Princeton, transaction-fallback town, sparse town, ZIP and sparse ZIP at 1280/390/320px in both themes; checks help placement, tools, topic previews, section navigation, expanded reflow, runtime errors and automated WCAG rules.
- Desktop Princeton opening visually reviewed; computed neutral panel background checked.
- git diff --check: passed.
- Full reports, backend tests and exhaustive manual accessibility review not part of this UI pass.
