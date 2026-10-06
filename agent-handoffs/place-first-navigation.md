# Place-first navigation

## What changed

- New Jersey leads with a town/county/ZIP search and direct links to all available county pages. County comparison is a secondary, collapsed table with measure/window selectors, definitions, dates, margins and plausible rank ranges.
- Removed the state and budget maps from those interfaces. Their geometry downloads no longer run there; reusable map components and data routes remain available for future work. National coverage navigation remains.
- Budget results are list-first with explicit coverage messaging and a count of municipalities excluded for missing comparable home-value/tax or rent inputs. Existing calculation, scope, saved assumptions and incomplete-cost suppression are unchanged.
- ZIP profiles now share the county/municipality presentation, without manufacturing missing measurements or enabling unsupported budget comparisons.
- Municipalities use teal, ZIPs violet, counties retain green and states blue. Utility pages use separate accents: tax cyan/graphite, freshness slate, revisions muted amber. National budget breadcrumbs are neutral ivory in dark mode.
- Household/buying tools are neutral gray, housing assistance route cards neutral slate, evidence footnotes neutral, and the landing-page free-use check green.
- Combined the landing taglines, added “The Garden State,” transferred ocean/grain styling to the national map and tightened its initial frame slightly.
- Section navigation now includes place discovery, county comparison and housing help, and reflects the current section without another toolbar.

## Files/modules affected

- State and local route pages, landing, changes and root style imports.
- StateModeWorkspace, new CountyComparison, AffordExplorer, NationalCoverageMap, SectionJump.
- New place-first.css, CountyComparison component tests and check-place-first.mjs.

## Architectural or implementation decisions

- Place discovery does not depend on county rankings existing. County destinations also no longer use the has_data filter.
- Comparison retains the published change-ranking basis; latest values are not presented as value ranks. Margins and rank ranges are preserved, not recalculated.
- Town and municipality are one level. ZIP/ZCTA pages have a distinct accent, not an implied administrative parent-child relationship.
- No ingestion, ranking methods, AI reading generation or source permissions changed. No new dependencies.
- National fullscreen exploration is deferred. Retiring a UI map does not delete reusable map infrastructure.

## Assumptions

- This is an experimental NJ design, not a generic implementation of additional states.
- Existing ZIP caveats, including unavailable ZIP tax bills, remain applicable.
- Accent colors are provisional design choices, and text labels remain the primary geographic identifiers.

## New TODOs / limitations

- Municipal coverage measured from the local API on this task: 564 municipalities; 176 lack a Zillow home-value comparison figure, 330 lack a Zillow rent comparison figure, and one lacks a MOD-IV tax comparison figure. The union missing a home value or tax bill is 176. These are warehouse comparison-input counts, not a claim about all publisher data worldwide.
- The budget finder deliberately uses comparable Zillow values. A locally available SR1A transaction-price scenario is not an interchangeable typical-home index. Preserve that methodology boundary until separately approved.
- Owning rows without home value or tax are excluded; rental rows without rent are excluded. Other required missing costs can produce an explicitly incomplete listed estimate. The new coverage note distinguishes these cases.
- This UI does not fix upstream coverage. Investigation of additional comparable sources and commercial rights remains separate work.
- Static artifacts and reusable map code remain; removing obsolete map routes/components is not part of this reversible experiment.
- The older county explorer may still be imported by other screens; those interfaces were not broadly rewritten.
- Canonical documents and DIRECTOR_NOTES.md were not edited.

## Verification

- npm test: 482 tests passed across 63 files, including 3 new county-comparison tests.
- npm run typecheck: passed.
- npm run build: passed, 2,379 static pages. Existing warning: NEXT_PUBLIC_ARTIFACT_URL is unset for this local build; Markdown links use localhost. Not a deploy-ready artifact origin.
- git diff --check: passed.
- PLACE_ORIGIN=http://localhost:3002 node scripts/check-place-first.mjs: passed 54 route/width/theme combinations (9 routes, 1280/390/320px, light/dark). No document overflow or runtime errors. Expanded mobile axe checks passed. Verified all 21 county destinations/comparison rows, lazy-loaded place search, no state/budget map, ZIP profile treatment and section navigation opening the comparison.
- Inspected desktop NJ and mobile ZIP screenshots in dark mode. National map retains zoom/pan/navigation controls.
- The first browser run exposed a test race: the assertion counted search options before the lazy search index loaded. Changed the check to wait for the first result, then reran successfully.
- No npm lint script is configured. No backend tests run: backend code and methodology unchanged.
