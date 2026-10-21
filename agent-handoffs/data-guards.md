# Data guards

## What changed

Tests and documentation only, on `test/data-guards`, branched from latest `origin/main`
at `0bd5b07`. No production Python/SQL/configuration changes, ingestion, deploys or
served-warehouse writes. Keep this handoff until the PR has been reviewed.

### Coverage measured before writing tests

These findings were reported to the user before the first file edit.

| Area | Existing coverage | Missing at task start |
| --- | --- | --- |
| Gate | `test_affordable_housing.py::test_assistance_metrics_unranked_licensed_and_hud_income_bounded` imports `VALUE_BOUNDS` and asserts bounds for `hud_area_median_income` and `hud_income_limit_80`. | No test calls `run_checks`: zero runtime checks exercised for observations present, duplicates, region existence, metric ranges/tolerances, coverage floors or informational rejects. No saved gate-report test. The module is 278 lines, not the TODO's 216. |
| Zillow | `test_manual_sources.py`: ZHVI manual declaration, copy/hash/manifest, cached file, changed file, cached fallback, missing download. `test_zillow_reminder.py`: calendar/cache reminders. `test_landing.py`: generic landing and revised date columns. `test_matching.py`: hand-created long-form ZHVI staging and matching/ambiguity tests. | Neither actual Zillow model nor its shared unpivot macro ran in tests; ZORI manual-file integration and realistic wide-layout fixtures missing. HTTP stubs would be the wrong acquisition path. |
| FRED | `test_sources.py::test_fred_asks_for_the_weekly_benchmark_and_the_monthly_history`: series and frequency URL assertions. | No recorded response through acquisition/parsing/landing, or changed-envelope/value guard. |
| BLS | No direct adapter request/response tests found. Configuration and registry tests do not exercise the BLS response parser. | Request/key variants, normal/annual-average parsing, HTTP-200 errors, empty/changed series. |
| FHFA | `test_national_fhfa.py`: real rendered staging SQL over handmade Parquet. `test_persistence.py`: county workbook records, unestimated years, changed workbook refusal. | FHFA master CSV acquisition/landing and schema drift. County workbook coverage was already present; the TODO's blanket claim was stale. |

### Added coverage

- **133 gate cases**: all 59 configured bounds on both sides, inclusive endpoints,
  five-outlier allowance, metric-specific 0.1% allowance, all three coverage floors
  (exact floor, collapse, distinct regions versus repeated months, missing level),
  duplicates, empty staging, orphans keyed by both level and GEOID, national exemption,
  custom region table, informational rejects, failure selection and JSON report output.
  Every fixture starts by proving the complete clean input passes. A refusal is a
  failed `Report` with a named failing `Check`, not an exception from `run_checks`.
- **Historical collision**: Egg Harbor City and Egg Harbor Township normalize through
  the real matching expression to one name. Reconstruct the formerly emitted duplicate
  region/metric/month rows and prove the gate refuses them. This deliberately does not
  undo today's matching-side ambiguity rejection just to trigger the gate.
- **Five real dbt runs**: normal, added metadata, renamed unused metadata, renamed
  required metadata, renamed date. Each run copies both actual staging model files and
  their actual shared macro verbatim into a temporary dbt project. Both real manual
  adapters fetch local fixtures, the real lander produces Parquet, and dbt materializes
  the models in a disposable DuckDB file. Three regions layers, three date columns,
  multiple regions, one out-of-scope state, blanks, a genuine zero and leading-zero
  county/ZIP keys. Assert all 11 expected long-form cells per product, including exact
  date/value/layer/region tuples. Added or renamed unused metadata is safely ignored;
  renaming required `State` fails dbt with a named missing-column error.
- **16 adapter cases**: real fetch/cache/manifest and landing around a
  MockTransport-backed `httpx.Client.stream`; FRED weekly/monthly URLs and fake key,
  key absence, missing sentinel, malformed envelope/HTTP-200 error; BLS v1/no-key and
  v2/keyed URL/padding/year window, M13 omission, failed status, explanatory message,
  renamed point field and empty/renamed series; FHFA master URL/no authentication,
  exact CSV values and changed-schema/error-body cases. No publisher downloads.

## Files/modules affected

- `tests/test_validation_gate.py`
- `tests/test_zillow_unpivot.py`
- `tests/test_adapter_data_guards.py`
- `tests/fixtures/data_guards/`: three wide CSVs, two JSON responses, one FHFA CSV,
  and a README explaining that every value is synthetic.
- `TODO.md`: only the two requested test-coverage entries, now distinguishing covered
  contracts from remaining robustness gaps.
- `CHANGELOG.md`: Unreleased data-guard entry.
- This handoff. No ARCHITECTURE change: no production design decision was made.

## Architectural or implementation decisions

- All new tests are local and warehouse-independent. The gate uses memory-only DuckDB;
  dbt has its own temporary project/profile/database with no extension configuration,
  and telemetry is disabled. Zillow HTTP primitives are explicitly forbidden in its
  fixture tests. No installed/real staging project targets are used.
- FRED/BLS/FHFA use the base adapter's `httpx.stream`, not MOD-IV's overridable
  `_client`. Patching that primitive to a MockTransport-backed client preserves the
  actual download/landing implementation instead of reimplementing it in a subclass.
  Credentials are always the fake literal `synthetic-not-a-credential`; manifests and
  filenames are checked for redaction where credentials are used.
- Four known defects are `xfail(strict=True)`. Unexpected passes fail the suite. The
  expected exception classes are constrained so unrelated setup errors do not count
  as reproductions of the known bugs. No fixes in production code.
- The two TODOs are completed as **test-writing tasks**, not declarations that every
  upstream schema is now safe. Their text and this handoff retain the discovered gaps.

## Assumptions

- Tests guard small representative publisher contracts, not downloaded national files,
  every possible field variation, live HTTP behavior or complete pipeline integration.
- ZHVI and ZORI use the same invented numeric cells to isolate their common reshape
  behavior. Fixture values are not asserted to be plausible rents/home values.
- Published data and exports need no rebuilding: nothing changes outside tests/docs.

## New TODOs / limitations

Separate production fixes for review; none implemented here:

| Location | Reproduction / consequence | Strict expected failure |
| --- | --- | --- |
| `src/hip/sources/fred.py:74` | A valid observation followed by one with `value` renamed loads only the first. `.get('value')` treats the absent field like a genuine missing-value sentinel. Partial data can successfully land. Distinguish a missing field from a publisher-declared missing value. | `test_fred_renamed_value_is_not_silently_lost` |
| `src/hip/sources/fhfa.py:21`, `src/hip/landing/tabular.py:88` (`land_csv`) | The master CSV has no adapter-level required-column/error-body check. Renamed `index_sa` or an HTTP-200 CSV error body lands successfully. A later staging binder error may refuse the load, but acquisition/landing does not identify the bad publisher shape. | `test_fhfa_changed_shape_must_be_refused_at_landing[renamed_field]` and `[http_200_error]` |
| `dbt/macros/zillow_observations.sql:36` | Renaming March's `2025-03-31` to `2025/03/31` silently excludes it in both models; dbt still succeeds. Consider a separate date/header contract check without rejecting legitimate extra metadata. | `test_renamed_month_must_not_silently_disappear` |

**BLS is not an outstanding empty-series loading bug:** its parser returns `[]` for an
empty/renamed series without a message, but the actual lander already raises
`ValueError: bls/<ref>: no rows`. These two tests pass normally, not as expected failures.
The initial exploratory parser-only expected failures were removed after verifying
the real boundary. Publisher messages and renamed per-point values are also refused.

No comprehensive inventory or tests of every other source adapter, full-width publisher
file, complete discovery/retry combination, or live-warehouse load. Existing
warehouse-writing tests remain unchanged and were deliberately unavailable in this run.

## Verification

### Commands run

All suite/lint invocations used installed dependencies, with dependency downloads
disabled (`UV_OFFLINE=1 UV_NO_SYNC=1 UV_CACHE_DIR=/private/tmp/hip-data-guards-uv`).
For `make test-all`, set:

```sh
HIP_DATABASE_URL='postgresql+psycopg://nobody:nothing@/no_warehouse?host=/private/tmp/hip-data-guards-no-postgres'
```

This explicitly nonexistent Unix-socket directory prevents connecting to the served
warehouse, even when the local API/database is running. It is not a disposable schema
inside the live database. Inspection found no hardcoded alternate warehouse URL in the
test suite. External networking was restricted by the execution sandbox. Git fetch /
push are repository workflow operations, not data-source requests.

- `make test-all`: **1,194 Python passed, 228 skipped, four strict expected failures**;
  **700 frontend tests passed across 114 files**. Python portion about 50 seconds.
  The skips include warehouse-dependent tests because the database is deliberately
  unavailable. This is not a claim that warehouse integration tests ran successfully.
- `make lint`: **passed** — Ruff check, Ruff format check and mypy (174 source files).
- Targeted fixture runs and collection: **154 new cases** (133 gate, 16 adapter,
  five dbt); 150 pass and four are strict expected failures.
- `git diff --check`: passed.

Initial targeted tests revealed an incorrect string-date expectation in the new FRED
test: real landing correctly infers `date` objects. The test was corrected; production
code was not changed. Preliminary full run had six expected failures before the BLS
landing guard was confirmed; the final figures above supersede that run.

### Not run / not changed

- No external publisher HTTP requests or publisher files committed.
- No served-warehouse reads/writes required by the new tests; no live writes by the
  full suite because its connection is unavailable. `tests/test_analytics.py` was
  included in collection but its warehouse-dependent cases were skipped.
- No deploy, hosting/account changes, production fixes, ingestion or export rebuild.
