# Scale safety

## What changed

### Part 1 — analytics tests off the served tables

- `tests/test_analytics.py` rebuilds a disposable `hip_test_<uuid>` schema with six region identities and synthetic 2010–2025 observations. No served observations, releases or analytics are rebuilt. Registry definitions and six geometry/identity rows are copied read-only.
- Scratch connections exclude `public` from their search path; missing scratch tables fail rather than resolving to served tables. Serial defaults become scratch-owned identity sequences; triggers and foreign keys are not copied. The local region enum and parent check removal allow copied identities without their full geographic hierarchy (not under test here).
- The unknown-margin test now always has a fixture case instead of depending on current source data. Idempotence still compares two complete rebuilds and packet hashes.
- `scripts/verify_analytics_isolation.py` runs a command with a serving API, polling real rankings and comparing row counts plus order-independent row-content checksums of `public.fact_metric_change` and `public.region_rankings` before/after.

### Part 2 — explicit completeness

- Both list responses add required `total`, counting the entire filtered result before `LIMIT` in the same SQL statement. Empty responses report zero. Existing caps are unchanged.
- Publisher validates the total before writing the list file (and before replacing an existing complete file). Unknown, malformed or partial totals fail loudly, rather than publishing a clipped ranking/series. This implements the explicitly permitted refusal option, not automatic pagination. Refusal aborts the clean `make publish` build; no completed manifest is produced for the failed run.
- `make check-dist` now checks every ranking/metrics manifest artifact for completeness. Payload bytes are written directly; validation does not reserialize successful responses.
- Readers inventoried: `web/lib/api.ts` (`Ranking`, `api.rankings`, `api.values`, `api.observations`, `nationalObservationSeries`); `DecisionGuide.tsx` reads full metrics artifacts. Downstream consumers are `web/lib/affordData.ts`, `web/app/atlas/page.tsx`, `web/app/[state]/[place]/page.tsx`, `web/app/[state]/[place]/report/page.tsx`, and `web/app/states/new-jersey/page.tsx`. These consume existing item/observation arrays without shape changes. `Makefile check-dist` previously checked file/page presence only; it now validates the metadata. `check-live.mjs` checks manifest/content and has no independent list-response schema to update. API tests consume these same response models.

### Part 3 — exact faster rank ranges

- Read `_rank_ranges`'s docstring and Decisions #239, #241, #247 and #382 first. The rule is NOT interval overlap. It is a strict Census significance test with both stored 90% margins, oriented by the metric's direction.
- `significance_counts` constructs balanced sorted trees for each direction, excluding NULL-margin rivals. Conservative branch bounds count/exclude whole branches only when the exact result is proved; unresolved leaves use the original `sqrt(m1**2 + m2**2)` comparison. Ties/self comparisons cannot count. A NULL own margin gets `(better,worse)=(0,0)`; its full cohort remains the rank range. Margin-free/singleton groups remain untouched, exactly like the old joins.
- PostgreSQL still computes ratios/changes/ranks. `_rank_ranges` reads the rankings, computes exact counts in Python and COPYs them to a temporary table before one joined update. It uses rebuild's existing transaction; no dependency, data or schema migration added.
- Retained the original SQL as a test/benchmark oracle, rather than replacing the test's expected answers with the new method's answers.

## Files/modules affected

- Part 1: `tests/test_analytics.py`, `tests/warehouse_scratch.py`, `scripts/verify_analytics_isolation.py`; narrowly corrects the brittle fixture/key lookup in `tests/test_correctness_pass.py`.
- Part 2: API analytics/metrics response models and queries; `src/hip/publish.py`; `web/lib/api.ts`; `web/components/DecisionGuide.tsx`; `scripts/check_list_completeness.py`; `Makefile`; `tests/test_list_completeness.py`; ARCHITECTURE Decision #402 (new row only).
- Part 3: `src/hip/analytics/{compute,rank_ranges}.py`; `tests/test_rank_range_counts.py`, `tests/test_rank_ranges_sql.py`, `tests/fixtures/rank_ranges_reference.sql`; `scripts/benchmark_rank_ranges.py`, `scripts/benchmark_rank_scaling.py`; ARCHITECTURE Decision #403 (new row only).

## Architectural or implementation decisions

- A scratch schema is sufficient; no new PostgreSQL database, role, account or hosting change. Its DDL follows the installed migrated warehouse and uses fixture-only data. PostgreSQL must be reachable/migrated; this remains an integration test, not a SQLite approximation.
- Decision #402 adds completeness metadata and fail-closed publication, not automatic pagination. Decision #403 changes the counting method only, not survey/ranking semantics. Old Decisions Log rows are unchanged. Other canonical documents were not edited.

## Assumptions

- Local warehouse has catalog definitions plus at least three county and three ZIP identities. The fixture does not ingest or fabricate a new state's data.
- No deployment, hosting/account change or new-state ingestion is authorized.

## New TODOs / limitations

### Other test uses of the real database URL (audit)

`rg -n 'get_engine\(|rebuild\(' tests --glob '*.py'` was inspected, including imported helpers and API dependency use. The only actual analytics `rebuild(engine)` calls were in `test_analytics.py` and are now scratch-only. `test_refresh.py::test_unreadable_state_forces_a_rebuild` is a refresh-planning test, not an analytics call.

| Tests | Remaining behavior |
|---|---|
| `test_nj_sr1a.py`, `test_nj_municipal_codes.py`, `test_persistence.py`, `test_relationships.py`, `test_revision_noise.py`, `test_packets.py`, `test_completeness.py`, `test_nj_tax_rates.py`, `test_nj_modiv.py`, `test_packet_uncertainty.py` | Read-only queries/sessions against the served warehouse. |
| `test_property_tax.py`, `test_statewide_search.py` | Read-only real-engine input to parcel/street export; files go to temporary paths. |
| `test_infrastructure_load.py`, `test_housing_pressure_load.py`, `test_affordable_housing_load.py`, `test_community_load.py` | Real connection, temporary shadow tables and scoped transactions; not an analytics rebuild. |
| `test_api_revisions.py`, `test_revisions.py`, `test_correctness_pass.py` | Real rows mutated inside transactions rolled back afterwards; can still take live row locks and advance revision sequences. |
| `test_publish.py` | Full API publication reads the warehouse; licence-guard test updates a metric then rolls back. |
| `test_api_explanations.py` | Commits test explanations to real tables, with autouse snapshot/restore cleanup; not analytics but not fully isolated. |
| `test_freshness.py` | Commits discovery fixtures under `test_freshness_source`, then deletes them; real tables and possible sequence advancement. |

Tests using the FastAPI `TestClient` also use its normal real database dependency unless explicitly overridden. This task removes the analytics rebuild hazard; converting every existing integration test to scratch databases is deferred. Do not interpret the checksum proof as proof that every table/sequence is untouched.

- A cohort above the current endpoint cap is now refused, not automatically published whole. Snapshot-consistent pagination remains future work; raising caps alone is not a solution.
- Sorted-tree pruning performs well for the measured cohorts but has no unconditional subquadratic guarantee for adversarial values/margins. Input transport and stored update counts grow linearly. No entire seven-state pipeline was ingested or timed; projection below is explicitly for one cohort's counting cost.
- Retain this handoff until the owner reviews the PR, as requested.

## Verification

- Part 1 targeted: `uv run pytest tests/test_analytics.py -q --tb=short` — 10 passed, no skipped margin case. Initial fixture enum resolution/ZIP-year errors were corrected before this run.
- First full isolation run: 1,251 passed, one existing brittle trigger-fixture failure in 201.90 s. A tiny ratio update was suppressed by the intended revision gate; the test then read an unrelated latest revision. Fixed its fixture to ACS income and scoped its revision lookup to the changed key. No production revision behavior changed.
- Despite that fixture failure, both served analytics tables were unchanged: `fact_metric_change` 125,474 rows / checksum `b4d41f2bb9c1bbd498031099c035b6c1`; `region_rankings` 178,880 / `2d697902018ebebf18ccb1650b2b0ef8`. 398 successful real API rankings polls, zero failures. Evidence: `/private/tmp/hip-scale-isolation-part1.json`; test log `/private/tmp/hip-scale-tests-part1.log`.
- Full-suite/API checksum evidence and subsequent parts: recorded below as completed.
- Part 2 targeted: `uv run pytest tests/test_list_completeness.py tests/test_api_analytics.py tests/test_api_metrics.py -q --tb=short` — 32 passed, including a 1,001-region ranking refused at a 1,000-row page, explicit metrics truncation, empty/filtered series, malformed metadata, check-dist rejection, and unchanged bytes on successful writes. `npm test` — 700 passed / 114 files; `npx tsc --noEmit` — passed.
- Part 3 targeted: `uv run pytest tests/test_rank_range_counts.py tests/test_rank_ranges_sql.py tests/test_analytics.py -q --tb=short` — 22 passed. Ties, NULL margins, nested intervals, exact equality, overlap-but-significant cases, lower/higher/neutral directions and randomized groups through 598 rows are compared with independent pairwise formulas or the original PostgreSQL SQL.

### Final combined verification (covers all three parts)

- `uv run python scripts/verify_analytics_isolation.py` runs **`make test-all`** as its subprocess: **1,272 Python tests passed**, no skips, in 203.75 s; **700 frontend tests / 114 files passed**. The API was running separately and served **410 successful rankings requests, zero errors** during testing. Both public analytics tables retained the exact counts/checksums above. Evidence: `/private/tmp/hip-scale-isolation-final.json`; full test output `/private/tmp/hip-scale-tests-final.log`.
- `tests/test_analytics.py` was actually run, including its repeated rebuilds, exclusively in scratch schemas. The served warehouse was not rebuilt or paused for those tests. Other legacy integration-test mutations remain listed in the audit above; this is not a claim of whole-database or sequence identity.
- Separate `npm test` — 700 passed / 114 files; `npx tsc --noEmit` — passed; `npm run publication:test` — five passed. Frontend verification was run after both response-reader changes.
- Ruff passed for every changed Python file; mypy passed for `compute.py`, `rank_ranges.py`, both response routers and `publish.py`; `git diff --check` passed.
- Full **`make publish` passed**, including artifact replay, photo generation, TypeScript, all 2,389 static page builds, legacy alias coverage and publication-capacity diagnostics. Output: **19,229 artifact files; 14,947 site files**. Log: `/private/tmp/hip-scale-publish.log`. No deployment followed.
- **`make check-dist` passed**, validating all **1,814** ranking/observation lists as complete plus the existing file, production-origin and page-data checks.
- `check-live` was not run: this branch was not deployed. No hosted configuration/account change or new-state ingestion occurred. No deterministic HTML/RSC work was added.

| Part | Verification applied |
|---|---|
| 1: isolation | 10 scratch analytics tests; corrected trigger fixture; complete `make test-all` with API serving, checksum identity and no API failures. |
| 2: completeness | 32 targeted API/publication tests; full suite; `npm test`, `tsc`, publication tests; full `make publish` and `make check-dist`; all list payloads preserve old bytes except `total`. |
| 3: rank ranges | 22 targeted pure/SQL/rebuild tests; full suite; old/new complete row snapshots and timings; measured 1x/2x/7x scaling; final build/check-dist. |

### Publication compatibility

The API-only baseline was the first full test publication, created before the response-model changes and retained at `/private/tmp/hip-scale-before-artifacts` (19,141 files). Its ranking responses were confirmed to have no `total`. The final full `make publish` artifact half has 19,229 files; its 88 additional files are the normal `make-photos.mjs` output omitted by the API-only baseline, not new data or new feature paths. The baseline and current privacy removal sets are empty; no removal setting or account was changed.

- **17,324 common files byte-identical.**
- **629 ranking files and 1,185 region-observation files differ only by the required root `total` field.** Removing exactly that one root field from the raw response bytes (without reserializing) recovers the baseline bytes in all 1,814 cases. Each total equals its complete array length.
- `freshness.json` and `revisions.json` differ only in root `generated_at`; their parsed remaining content is exactly equal. Manifest differences are build time, total bytes and changed artifact byte lengths/hashes. Its identity, paths, sources, region spine, coverage and exclusions match after removing those metadata fields.
- No removed paths, other new paths or unexpected existing-file changes. Evidence: `/private/tmp/hip-scale-publication-diff.json`.
- This is a published-artifact comparison, not a raw HTML/RSC byte-identity claim. The site rebuild's normal IDs/timestamps are not made deterministic by this task.

### Rank-range snapshot and timings

Before modifying `_rank_ranges`, ran `uv run python -m scripts.benchmark_rank_ranges --reference-only --output /private/tmp/hip-scale-ranks-before.json` on a disposable full ranking copy. The reference updated 144,021 rows in **214.7542 s**, and every stored row remained identical to the initial snapshot. After integration: `uv run python -m scripts.benchmark_rank_ranges --baseline /private/tmp/hip-scale-ranks-before.json --output /private/tmp/hip-scale-ranks-after.json`: **4.2144 s**, same 144,021 updated rows and **all 178,880 rows / all columns identical**. Both row-array SHA256s: `3df140d0e7a76321d1d4f89096c5effb9730bdf222fe31ad1cd2d926a61ffa2a`. Approximately **50.96x faster** for this step, not a claim about the entire rebuild.

`uv run python -m scripts.benchmark_rank_scaling > /private/tmp/hip-scale-rank-scaling.json` measures five samples at each size, median below. Base is the actual ACS population ZIP `value/latest` cohort; larger sizes are in-memory similar-distribution replicas with deterministic small offsets, not new-state data.

| Group size | Median counting time |
|---|---:|
| 598 (1x) | 0.0039481 s |
| 1,196 (2x) | 0.0103852 s |
| 4,186 (7x) | 0.0657084 s |

Measured first-two-size exponent `log(t2/t1)/log(2) = 1.39529`; projection `t1 * 7^1.39529 = 0.0596415 s`, versus the measured 7x result 0.0657084 s (about 10% above projection). Database I/O is excluded from these cohort timings but included in the full-step 4.2144 s timing. Single full-step samples and five-run cohort medians on this local machine are evidence, not production SLAs or a worst-case guarantee.
