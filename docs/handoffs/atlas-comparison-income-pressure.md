# Atlas comparison and income-group housing pressure

## What changed
- Pin one area in the Atlas, select a second, and compare the active measure. Pin survives shared URLs/reloads; changing geography clears it. Replace/clear controls and county place links are explicit. A dashed outline and list marker distinguish the pinned place from the current selection.
- Differences are shown only for two available figures with matching latest dates, or a shared comparison window. Ratio/change differences use percentage points; no statistical-significance or best-place claim is made.
- Added Who feels housing costs most? on supported county/town pages and New Jersey, with renter/owner toggles, five HUD income bands, counts, 90% share margins and uncomputed-household counts.
- Existing HUD CHAS 2018–2022 Table 8 data supplies the chart. No new download or publisher was introduced.
- New read-only `/regions/{id}/housing-pressure` endpoint and static-publication plan entry. ZIPs do not inherit or interpolate a town/county chart.

## Files/modules affected
- `web/components/HousingAtlas.tsx`, `web/lib/housingAtlas.ts` and tests
- `web/components/IncomePressure.tsx` and tests; `web/app/income-pressure.css`
- Place/state routes; `web/lib/api.ts`; Atlas CSS import
- `dbt/models/staging/stg_housing_pressure.sql`, `dbt/tests/housing_pressure_cohorts.sql`
- `src/hip/warehouse/housing_pressure.py`, `src/hip/api/routers/housing_pressure.py`
- CLI load integration, API router registration and `src/hip/publish.py`
- Cohort/API/atomic-load tests and browser regression scripts

## Architectural or implementation decisions
- Ancillary cohorts use the existing community_records table, separate from ranked metric observations. No database migration or modification to existing ranked facts.
- Stage count/margin cells from the already reviewed Table 8 offsets; bind exact source/layer/vintage/file hash before replacing only housing_pressure records. Missing/invalid/incomplete inventories abort atomically.
- HUD rounds counts to five. Rounded numerators exceeding a denominator produce no share rather than being clamped. Zero denominators are unavailable, never a zero-percent estimate.
- Shares use all households in the income/tenure band, including uncomputed burden in the denominator; uncomputed cases are not described as unburdened. Over-30% count includes the over-50% group.
- Share margins use the existing Census subset formula with ratio fallback. State counts sum all county cohorts at one reviewed vintage; sum margins use RSS with the existing largest-zero-margin-once convention. This is labelled a county-estimate sum, not a direct state publication.
- Income bands refer to HUD area median family income, household-size adjusted. They are not median household income or current programme eligibility thresholds.
- API reads the warehouse only; pipeline performs ingestion. Normal hip stage/load and static publication include the new context. No publisher terms or software licence changes.
- All work remains on experiment/housing-atlas and PR #159.

## Assumptions
- Reviewed schema is 2018–2022 only. A newer bulk release requires reviewing its dictionary and updating the stage/validation rules, as the existing bulk adapter does.
- States require complete county coverage; partial rollups are unavailable. Each household's band is relative to its local HUD area, not one statewide dollar threshold.
- Comparison is descriptive; margins remain individual estimates, not a derived significance test.

## New TODOs / limitations
- Five historical/unmatched MCD rows (50 tenure/band records) are retained in raw files but not assigned to present municipalities. Current mapped coverage is 21 counties and 564 municipalities, 5,850 cohort records.
- Local-only stage/load was performed on the new model/context records; no full warehouse reload or deployment. API restarted locally on port 8000.
- The CHAS chart period is older than some headline ACS figures; keep the survey period visible and never present it as today's household result.
- Physical Safari/iOS, keyboard viewport behavior and low-end performance remain unverified.
- New cohort endpoint is included in the publisher plan, but a full production publish/deploy was not run.

## Verification
- CHAS model staged from local Parquet; 5,850 exact-file-cited cohorts loaded locally.
- dbt housing_pressure_cohorts completeness/provenance test passed.
- Backend targeted tests: 44 passed, 4 slow tests deselected; includes atomic rollback in temporary tables, API basis/ZIP guard, existing CHAS/ACS margins, module boundaries and publication plan.
- Ruff passed on affected Python files; mypy passed for new warehouse/API modules.
- Frontend typecheck and 671 tests / 108 files passed.
- Build passed: 2,388 pages / 16,705 exported files.
- New-feature browser suite: four viewport/theme cases passed for pin/restore/clear, county/town/state pressure, tenure controls, definitions, ZIP absence, accessibility and reflow.
- Existing browser regressions passed: twelve place-exhibit cases, six state-exhibit cases, and six Atlas-navigation cases.
- Visually inspected phone comparison and county income chart screenshots under `/tmp/atlas-two-place-*` and `/tmp/income-pressure-*`.
- HUD definitions checked against official CHAS API/background documentation. Source link: https://www.huduser.gov/portal/datasets/cp/CHAS/bg_chas.html
