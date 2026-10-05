# Milestone 42 — utilities and drinking water

## What changed

Implemented five ancillary source inventories and reader-facing utilities/water context on the shared county, municipality and ZIP pages. This is not a new household bill estimator or safety score. No analyst readings were regenerated, no canonical documents were edited, and nothing was deployed.

- Approximate electric/gas suppliers from NJDEP territories, with explicit matches to four major electric utilities. Split territories list multiple suppliers; unmatched names stay unmatched.
- Final EIA-861 residential bundled revenue/sales averages and utility-wide New Jersey outage measures, preserving method and major-event-day basis. Delivery-only and energy-only sales do not price bundled service. The signed statewide adjustment row is excluded: it is not a utility.
- Historical DOE/NREL county energy context, explicitly identified as a derived ratio of county means, not a household estimate. Raw reporting weights remain auditable. Five counties' derived estimates are withheld because the source contains signed weights or costs.
- Latest available NJDEP service-line inventories by public water system, retaining separate lead, galvanized, connector, unknown and non-lead counts and their actual update dates.
- EPA UCMR 5 entry-point PFAS measurements: sample window, counts, detections, maximum single detected result and reporting limits. Nondetects are not zero. Only PFOA/PFOS receive a 4 ng/L reference comparison; individual samples above that reference are not labelled violations.
- SDWIS reported returns to compliance, paired with the corresponding latest violation, plus county/state system lists. Missing return dates do not establish ongoing unsafe water.
- Exact staged-file release IDs, hashes and download times on ancillary API records and primary SDWIS records; atomic replacement refuses broken inventories. Raw pruning now protects files cited by water and infrastructure records.
- Static publication of `utilities.json`, observed-date freshness support, source notices and CC BY reuse classification. Mobile expanded water tables now scroll within their section instead of widening the page.
- Follow-up: imported three years of actual JCP&L CAIDI/SAIFI from a verified BPU order, separately from EIA; added two system-ID-matched outbound annual water-quality report links. See `m42-source-followups.md` for the investigated gaps and unsent agency requests.

## Files/modules affected

- `config/sources.yml`; `src/hip/sources/{infrastructure,registry}.py`.
- Five `dbt/models/staging/stg_*_records.sql` models, `stg_water_systems.sql`, and `dbt/tests/infrastructure_inventories_valid.sql`.
- Warehouse migrations `0025_water_resolution.py` and `0026_infrastructure.py`; `warehouse/{infrastructure,load,freshness}.py`.
- `api/routers/{infrastructure,water_systems}.py`, API registration, CLI load/prune integration, publication and completeness.
- Shared region page, `Utilities.tsx`, `GroundAndWater.tsx`, frontend API types/helpers and scoped CSS.
- Three Python infrastructure test modules, frontend helper tests and publication test allowance.
- `reports/completeness/2026-10-04-3.md`: generated standing check, not a canonical document. Its 33-source denominator is the check's implemented-source scope, not the 36 configured source definitions.

## Architectural or implementation decisions

Ancillary inventories live in `infrastructure_records`, not `facts`: provider identities, sample summaries and service-line counts are not comparable regional metrics. No new rankings, cost-card inputs or AI generation inputs were added. Source-specific payloads retain measurement basis; every record is joined to the exact file staged for the load, never whichever file was downloaded most recently. Empty/invalid inventories abort rather than replacing the previous good copy; absent staging models preserve their old source inventory.

Territory polygons are unioned by supplier before intersecting estimated block homes, preventing overlap from double-counting a supplier. The inclusion rule is at least 1% of a place's estimated homes or 50 homes. Territory coverage is approximate, not market share or a property guarantee. Municipal DOE context is explicitly its parent county; ZIPs receive no invented single-county fallback.

UCMR's mutable bulk URL uses `current` and conditional revalidation rather than pretending the 2023–2025 collection cycle is a frozen download vintage. Follow-up samples in 2026 are retained. Results are deduplicated using sample, facility, point, method, analyte, date and result. Maxima are never treated as running annual compliance averages or combined into a hazard index across unrelated samples.

EIA discovery accepts final annual ZIPs and excludes early-release ZIPs. Workbook header/unit guards stop silent column drift. The current acknowledgement names the 2024 final publisher update (December 3, 2025); review that notice when adopting a successor year. DOE remains pinned to the verified 2022 bulk dataset rather than guessing a successor.

## Assumptions

- Geography and block-home estimates already loaded by the project are suitable for approximate area associations, not address decisions.
- The service-line categories are independent publisher fields; no additive denominator or invented lead percentage is asserted.
- System-level measurements and violation records follow the system into each served place; counts are not allocated as local affected homes.
- The public bulk sources may lag publisher dashboards. Labels show the data actually obtained, not the year suggested by a dashboard headline.

## Source gates, terms and live findings

Reviewed on October 4, 2026:

| Source | Verified release / coverage | Reuse and attribution |
|---|---|---|
| [EIA-861](https://www.eia.gov/electricity/data/eia861/) | 2024 final; 2025 only early release. 97 NJ utility records after excluding adjustment ID 99999. Four explicit major-provider matches. | [EIA reuse policy](https://www.eia.gov/about/copyrights_reuse.php): federal data reuse permitted; EIA and publication date acknowledged; no logo/third-party reuse inferred. |
| [DOE/NREL LEAD](https://data.openei.org/submissions/6219) | 2024 release, 2018–2022 ACS calibrated to 2022 EIA; all 21 counties, 16 derived estimates. | Explicit [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), dataset [DOI](https://doi.org/10.25984/2504170), publisher credit and derived aggregation notice. Not assumed public domain. |
| [EPA UCMR 5](https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule) | Final 2026 bulk: 55,400 NJ PFAS entry-point results, 265 systems, 7,685 system/analyte summaries. Includes 2026 follow-up dates. | Federal data; [EPA disclaimers](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers); no endorsement or separately protected material assumed reusable. |
| [NJDEP lead inventory metadata](https://www.arcgis.com/home/item.html?id=54dd411b2c8449cc9efb3748143716f2) | 1,689 submission rows; latest 565 systems. Public layer reaches submission 2024, despite newer dashboard context. | NJDEP Data Distribution Agreement and required notice recorded in source configuration. Raw category dates remain distinct from submission year. |
| [NJDEP utility territory metadata](https://www.arcgis.com/home/item.html?id=d23845cc51454ee59affd226cff3fcd5) | 51 electric and 33 gas pieces; associations cover state, 21 counties, 564 municipalities and 597 ZIPs. | NJDEP agreement and required notice. Small-scale source maps do not establish exact property supply. No new raw geometry is published by this feature. |

Local warehouse after follow-up: 10,992 infrastructure records after adjustment exclusion and three BPU records; 2,495 region/system water-list rows. The existing 864,585 staged observations remain unchanged by M42's inventories. All listed water systems match a latest service-line record; lack of UCMR samples is disclosed, never treated as a clean result.

## New TODOs / limitations

The consolidated **actionability register** in `m42-source-followups.md` distinguishes (A) bounded work possible without agency replies, (B) permission/data/methodology/privacy gates, (C) limits of current data and separately scoped extensions, and resolved items. Read it alongside this summary: not every omission is an institutional blocker, and actionable does not mean approved. All outreach remains deferred by user choice.

1. **BPU coverage is partial.** The public [2025 JCP&L reliability order](https://nj.gov/bpu/pdf/boardorders/2025/20250813/2B%20ORDER%20JCP%26L%20Reliability%20Levels.pdf) now supplies actual 2022–2024 company-wide CAIDI/SAIFI records with exact-file provenance. ACE's 2024 annual filing was located but not imported; the initial direct supplier-PDF link was subsequently replaced by BPU public-document search after terms review. PSE&G/RECO annual filing coverage is unverified; automated portal access returned a challenge, though the user's browser accessed it. A complete current four-provider annual-report catalogue remains to be located or requested. CAIDI is not SAIDI; event-exclusion basis in the checked order is unspecified. This is progress on the import gap, not completion of the whole roadmap clause.
2. **Address-level work remains gated.** NJOGIS terms were inspected, but Daniel's Law/privacy clearance is unresolved (also an existing open decision). The utility polygons' coarse scale separately precludes a reliable point-level guarantee. No address points were acquired, published or used for geocoding. This is not legal clearance; obtain counsel/publisher guidance before advancing the gate.
3. **New Jersey PFAS violations remain absent from SDWIS.** UCMR fills the measured-PFAS information gap, not the separate NJDEP regulatory-violation series in TODO. Private wells and many small public systems are outside this sampling coverage. Compliance timelines and proposed federal changes need future review; no categorical safety conclusion is made.
4. **DOE data quality:** Essex, Hudson, Middlesex, Monmouth and Somerset estimates are withheld. Ask DOE/NREL to explain signed reporting weights/costs before defining a repair. Do not replace missing values with zero or add these historical estimates to current household costs.
5. **Lead currency and CCRs:** a live query and review of the official map configuration verified that its linked bulk layer still reaches submission 2024, despite 2025 statewide totals. Request a newer per-system aggregate export rather than allocating statewide totals. `SLI_ACCESS` is a service-line inventory, not a Consumer Confidence Report. Two outbound supplier reports are manually matched to printed PWSIDs; all others have an EPA-directory fallback. American Water's terms prohibit automated copying, so no scraper or republished report content was built. This is not a verified current-year catalogue. New Jersey's 2031 replacement deadline allows extensions, stated in the reader copy.
6. **Gas price not built:** territories identify suppliers, but electricity sales cannot estimate a gas bill. Unmatched municipal/cooperative suppliers receive no invented EIA statistics.
7. **Successor releases:** EIA final-year discovery is automated, but the dated acknowledgement needs review when the year changes; DOE successor discovery is not implemented. Retain exact manifest/hash provenance when updating either.
8. **Existing ZIP utility TODO:** ZIPs now have approximate supplier/company context; this does not fill the separate missing ACS household bill/insurance fields. Do not mark the whole TODO resolved.
9. No AI regeneration, raw prune `--apply`, deploy, merge, version bump or canonical-document reconciliation. Claude should reconcile milestone status with the BPU and address gates above instead of marking every roadmap clause complete.

## Verification

- Real acquisition/landing for all five sources succeeded; the DOE archive is about 193 MB, UCMR about 14 MB compressed (roughly 342 MB uncompressed). No new frontend/browser dependencies were added.
- `.venv/bin/alembic upgrade head`: migrations 0025 and 0026 applied to the local warehouse.
- `.venv/bin/hip stage --select 'stg_eia861_records stg_epa_ucmr5_records stg_doe_lead_records stg_njdep_lead_lines_records stg_water_systems'`: five models and three associated data tests passed. Territory spatial staging and its overlap regression also passed.
- `.venv/bin/hip validate`: 864,585 staged observations passed.
- `.venv/bin/hip load`: passed with 10,989 infrastructure records, 2,495 water-system rows and 864,585 observations; zero withdrawn observations. The existing fact pipeline still records 144 unresolved geographies, not repaired by this milestone.
- Final EIA adjustment exclusion was relanded/restaged against the real workbook: 97 utility records, staging model and inventory guard passed.
- `.venv/bin/pytest -o addopts='' -m 'not slow' -q`: 995 passed, 1 skipped, 9 deselected in 30.66 seconds, with local Postgres integration coverage enabled.
- `.venv/bin/hip check-config`: 36 sources, 137 metrics, config OK. `hip completeness` and the generated standing check succeeded; CC BY permissions are recognized.
- `.venv/bin/ruff check src tests`, formatting check, `.venv/bin/mypy`: passed (137 checked sources).
- `npm test`: 437 tests in 51 files passed. `npm run typecheck`: passed.
- `npm run build`: all 2,379 static pages built. Local-only warning: `NEXT_PUBLIC_ARTIFACT_URL` is unset, so report download links point to localhost; production builds must use the published artifact origin.
- Headless desktop and 390-pixel mobile checks, including expanded lead/PFAS content: no page-width overflow after grid containment fix. The table remains horizontally scrollable locally within its section.
- `git diff --check`: passed. Slow Python tests are excluded from the ordinary suite; no claim that `make test-all` was run.

### Deployment / review sequence

Review source gates and methodology first. On the deployment warehouse, migrate before loading, acquire/land/stage the five configured sources, validate and load exact files, then publish artifacts and rebuild using the production artifact origin. Inspect a split-provider county, a town, a ZIP, a withheld DOE county, and a water system with nondetect PFAS results. Run the project's live checks after any separately approved deployment. Do not regenerate readings or prune raw files as an implicit part of this review.

For the follow-up, also acquire/land/stage `nj_bpu_reliability` before loading the six ancillary inventories. The original five-source verification above describes the initial commits, not the final follow-up totals.

### Follow-up verification

- Actual BPU PDF acquired (SHA-256 prefix `fbcf9d107567`); real landing produced three rows. `.venv/bin/hip stage --select stg_nj_bpu_reliability_records`: model and inventory guard passed. Same-page table regression corrected a defect found by the real filing, not a mocked success alone.
- `.venv/bin/hip load`: 10,992 infrastructure records, 2,495 water-system rows, 864,585 observations; zero withdrawn, existing 144 unresolved geographies unchanged.
- `.venv/bin/hip check-config`: 37 sources, 137 metrics, config OK.
- `.venv/bin/ruff check src tests`, formatting check, `.venv/bin/mypy`: passed; 138 checked source files.
- `npm test`: 438 tests in 52 files passed; `npm run typecheck` passed. `npm run build`: all 2,379 static pages built, with the same local-only artifact-origin warning.
- `.venv/bin/pytest -o addopts='' -m 'not slow' -q`: 1,011 passed, 1 skipped, 9 slow tests deselected in 30.97 seconds, with local Postgres integration coverage. New checks include API source/hash/year/basis and rejection of negative, missing or Boolean BPU numeric values.
- Built HTML contains BPU performance and the matched supplier report links. `git diff --check` passed. No new dependency, AI generation, address acquisition, supplier scraping, merge or deploy.

### Pre-merge ACE link correction

- Replaced the reader-facing ACE supplier-PDF deep link with `https://publicaccess.bpu.state.nj.us/`, labelled "Search BPU public filings". Preserved the explicit disclosure that ACE annual figures are not imported; no data calculations, source acquisition or water-report links changed.
- Added `web/lib/utilityLinks.test.ts`: renders an ACE provider, asserts the agency search URL/disclosure and rejects the supplier domain and old direct-filing label.
- `npm test`: 439 tests in 53 files passed. `npm run typecheck`: passed. Initial build failed because the local API was stopped; started the development API and retried `npm run build`, which built all 2,379 static pages. The local-only artifact-origin warning remains.
- Inspected generated HTML: agency search label present; ACE 2024 supplier-PDF URL absent. `git diff --check` passed. Backend tests were not rerun for this link/copy-only correction; their earlier results above remain historical verification.
- Canonical documents untouched. Agency outreach remains deferred. No merge or deploy.
