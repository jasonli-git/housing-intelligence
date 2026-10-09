# National home-price benchmark

Branch: `experiment/ui-density-discoverability`; follow-up in PR #141. User-approved bounded addition, not a milestone. No merge or deployment.

## What changed

- Add “Home prices over the past year” beside the existing national borrowing benchmark on the Housing Intelligence landing page. The local snapshot shows **+2.6%, July 2025 → July 2026**. Values and dates come from the warehouse, not hardcoded copy.
- Stage the national monthly purchase-only, seasonally adjusted FHFA index already present in the downloaded master file. Preserve the existing state quarterly series and separate county annual source.
- Add a definition, direct FHFA source link, unavailable-data state and the mandatory FHFA non-endorsement notice. Both FHFA source entries carry the notice; the shared footer deduplicates identical notices.
- Correct the master source's refresh cadence to monthly and add monthly dates to its publisher release calendar. State metrics themselves remain quarterly.

## Files/modules affected

- `config/metrics.yml`, `config/sources.yml`: metric registration, cadence/calendar and verified publisher terms.
- `dbt/models/staging/stg_fhfa_hpi.sql`: explicit national selectors and monthly period boundaries.
- `src/hip/sources/fhfa.py`: adapter documentation only; existing download route unchanged.
- `src/hip/validate/gate.py`: index range validation.
- `web/lib/nationalBenchmarks.ts`, its tests and `web/lib/api.ts`: exact year-ago calculation and existing per-metric national-series cache.
- `web/lib/periods.ts`, its tests, `groups.ts`, `kinds.ts`, `definitions.ts`: monthly dates and exhaustive metric catalog integration.
- `web/app/page.tsx`, `ui-refinement.css`: compact responsive benchmark pair.
- `tests/test_national_fhfa.py`, `web/scripts/check-ui-refinement.mjs`: selection, metadata and rendered-card/notice regressions.

## Architectural or implementation decisions

- Select only `USA or Census Division` / `USA` / `monthly` / `purchase-only` / non-null `index_sa`. Never mix Census divisions, quarterly periods, unadjusted values or refinance-inclusive indexes.
- Calculate `(latest / same month one year earlier - 1) × 100`. Do not substitute a nearby month or retreat to an older latest period when the comparison is missing. Suppress nonfinite/nonpositive indexes and preserve decreases.
- This is historical nominal price change, not a typical dollar home value, forecast or individual-home estimate. The definition explains seasonal adjustment, limited mortgage coverage and historical revisions.
- Reuse the existing FHFA master acquisition, national geography and static build-time API pattern. No new dependency, account, API contract or paid source.
- FHFA's [HPI FAQ](https://www.fhfa.gov/faqs/hpi) permits reuse with credit. Its [website policy](https://www.fhfa.gov/about/fhfa-policies/website-privacy-policy), sections 10–11, distinguishes public-domain agency data from protected marks and requires: “This product uses FHFA data but is neither endorsed nor certified by FHFA.” Direct published files are used, not the separately conditioned API.
- The existing Friday 08:00 local launchd job is installed. It refreshes and republishes automatically on clean `main`; the feature branch is deliberately skipped. The Mac/job must be available and downloads/build/deploy must succeed. Monthly publisher releases mean weekly checks may produce no new values. No scheduler change or invocation was needed.
- Production `make publish` already removes Next's incremental cache before building. A warm local build reused old footer data after the source metadata changed; the local preview was therefore rebuilt with a fresh `.next` directory. Do not relax the existing production clean-build rule.

## Assumptions

- Approval covers the national card and the FHFA source-use metadata correction on the current branch, not another milestone or redesign.
- No canonical documents or Director Notes changed. No AI readings regenerated, new acquisition run, full analytical regeneration, scheduled refresh triggered or production deploy performed.
- The cached master file is the current local input; displayed dates disclose its coverage. The latest period is not assumed to be the current calendar month.

## New TODOs / limitations

- Automatic production appearance requires merging this branch and publishing it. A browser refresh does not fetch live FHFA data; the site is a static snapshot.
- FHFA's publication lag and revisions are intentional characteristics of this source. Continue using publication dates, not interpolating an estimate for today. Maintain the release calendar beyond its current horizon.
- Selected dbt model has no directly selected dbt tests (`hip stage --select stg_fhfa_hpi` reported “Nothing to do” for that test selection). The new Python fixture executes the real staging SQL and checks geography/frequency/flavor separation, seasonal adjustment, December boundaries and existing state output.
- Automated accessibility results do not cover all screen readers or replace manual review. Full Python suite and model-generated readings are outside this bounded change.

## Verification

- Targeted Python: `PYTHONPATH=src .venv/bin/python -m pytest tests/test_national_fhfa.py tests/test_config.py tests/test_notice.py tests/test_licences.py tests/test_scheduled_scripts.py tests/test_refresh.py -q` — 96 passed.
- `ruff check src/hip/sources/fhfa.py src/hip/validate/gate.py tests/test_national_fhfa.py` — passed; `mypy src/hip/sources/fhfa.py src/hip/validate/gate.py` — passed, two sources.
- `hip stage --select stg_fhfa_hpi`, `hip geocode`, `hip validate`, `hip load` — completed locally using cached data. Gate validated 951,717 observations; 427 monthly national observations were loaded. No source acquisition. Revalidation after adding the new index range passed.
- Local API verified latest index 443.52 (July 2026) against 432.4 (July 2025): 2.5717%, displayed +2.6%. `/sources` contains the required notice and monthly master cadence.
- `npm run typecheck`, `npm test` — passed; 556 tests in 78 files.
- Fresh `npm run build` — passed; 2,386 static pages. Stopped the owned development server before moving the generated `.next` directory to `/tmp/hip-national-build.IR61mJ/next-build` and rebuilding; the user's static preview on port 3002 remains available. No raw data removed.
- `A11Y_ORIGIN=http://localhost:3002 npm run check:ui-refinement` — passed, including the new percentage/date/source-link assertions and exactly one rendered FHFA notice. Desktop/mobile benchmark screenshots reviewed at `/tmp/housing-ui-refinement/us-benchmarks-1280.png` and `us-benchmarks-390.png`.
- `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/,/freshness,/regions/12' A11Y_OUTPUT=/tmp/national-home-prices-a11y.json npm run check:a11y` — passed, 24 states across three routes, two widths, two themes and closed/expanded content. No automated axe violations, application errors or horizontal page overflow. Incomplete/manual checks are not claimed as automated passes.
- `git diff --check` — passed. No separate frontend linter configured.
