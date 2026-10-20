# Scale safety

## What changed

### Part 1 — analytics tests off the served tables

- `tests/test_analytics.py` rebuilds a disposable `hip_test_<uuid>` schema with six region identities and synthetic 2010–2025 observations. No served observations, releases or analytics are rebuilt. Registry definitions and six geometry/identity rows are copied read-only.
- Scratch connections exclude `public` from their search path; missing scratch tables fail rather than resolving to served tables. Serial defaults become scratch-owned identity sequences; triggers and foreign keys are not copied. The local region enum and parent check removal allow copied identities without their full geographic hierarchy (not under test here).
- The unknown-margin test now always has a fixture case instead of depending on current source data. Idempotence still compares two complete rebuilds and packet hashes.
- `scripts/verify_analytics_isolation.py` runs a command with a serving API, polling real rankings and comparing row counts plus order-independent row-content checksums of `public.fact_metric_change` and `public.region_rankings` before/after.

## Files/modules affected

- Part 1: `tests/test_analytics.py`, `tests/warehouse_scratch.py`, `scripts/verify_analytics_isolation.py`.
- Part 2: API analytics/metrics response models and queries; `src/hip/publish.py`; `web/lib/api.ts`; `web/components/DecisionGuide.tsx`; `scripts/check_list_completeness.py`; `Makefile`; `tests/test_list_completeness.py`; ARCHITECTURE Decision #402 (new row only).

### Part 2 — explicit completeness

- Both list responses add required `total`, counting the entire filtered result before `LIMIT` in the same SQL statement. Empty responses report zero. Existing caps are unchanged.
- Publisher validates the total before writing the list file (and before replacing an existing complete file). Unknown, malformed or partial totals fail loudly, rather than publishing a clipped ranking/series. This implements the explicitly permitted refusal option, not automatic pagination. Failure aborts the build; a partially built output tree is never deployable.
- `make check-dist` now checks every ranking/metrics manifest artifact for completeness. Payload bytes are written directly; validation does not reserialize successful responses.
- Readers inventoried: `web/lib/api.ts` (`Ranking`, `api.rankings`, `api.values`, `api.observations`, `nationalObservationSeries`); `DecisionGuide.tsx` reads full metrics artifacts. Downstream consumers are `web/lib/affordData.ts`, `web/app/atlas/page.tsx`, `web/app/[state]/[place]/page.tsx`, `web/app/[state]/[place]/report/page.tsx`, and `web/app/states/new-jersey/page.tsx`. These consume existing item/observation arrays without shape changes. `Makefile check-dist` previously checked file/page presence only; it now validates the metadata. `check-live.mjs` checks manifest/content and has no independent list-response schema to update. API tests consume these same response models.

## Architectural or implementation decisions

- A scratch schema is sufficient; no new PostgreSQL database, role, account or hosting change. Its DDL follows the installed migrated warehouse and uses fixture-only data. PostgreSQL must be reachable/migrated; this remains an integration test, not a SQLite approximation.

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

## Verification

- Part 1 targeted: `uv run pytest tests/test_analytics.py -q --tb=short` — 10 passed, no skipped margin case. Initial fixture enum resolution/ZIP-year errors were corrected before this run.
- First full isolation run: 1,251 passed, one existing brittle trigger-fixture failure in 201.90 s. A tiny ratio update was suppressed by the intended revision gate; the test then read an unrelated latest revision. Fixed its fixture to ACS income and scoped its revision lookup to the changed key. No production revision behavior changed.
- Despite that fixture failure, both served analytics tables were unchanged: `fact_metric_change` 125,474 rows / checksum `b4d41f2bb9c1bbd498031099c035b6c1`; `region_rankings` 178,880 / `2d697902018ebebf18ccb1650b2b0ef8`. 398 successful real API rankings polls, zero failures. Evidence: `/private/tmp/hip-scale-isolation-part1.json`; test log `/private/tmp/hip-scale-tests-part1.log`.
- Full-suite/API checksum evidence and subsequent parts: recorded below as completed.
- Part 2 targeted: `uv run pytest tests/test_list_completeness.py tests/test_api_analytics.py tests/test_api_metrics.py -q --tb=short` — 32 passed, including a 1,001-region ranking refused at a 1,000-row page, explicit metrics truncation, empty/filtered series, malformed metadata, check-dist rejection, and unchanged bytes on successful writes. `npm test` — 700 passed / 114 files; `npx tsc --noEmit` — passed.
