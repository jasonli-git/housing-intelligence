# Changelog

All notable changes to the Housing Intelligence Platform. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [0.4.0] — 2026-08-12

The warehouse starts answering questions instead of only storing answers. Change over
time, affordability, and rankings are computed and served.

### Added
- **Milestone 4 — change metrics.** Percentage change and CAGR over 1y, 3y, 5y, 10y, and
  since-2019, for every region and metric where both ends exist: 19,338 rows in
  `fact_metric_change`.
- **Affordability as computed metrics.** `price_to_income` (2,026 observations) and
  `rent_to_income` (293) are written to `fact_metric_observation` like any measured
  metric, under a synthetic `hip_derived` source with one release per `analyze` run — so
  a computed figure names the run that produced it, exactly as a measured one names its
  file.
- **Rankings.** 19,328 rows of rank, percentile, and cohort size per metric, level, and
  window. Rank 1 is the better end as the metric's own `direction` defines it.
- **`GET /rankings`, `GET /compare`, `GET /regions/{id}/summary`.** The summary attaches
  caveats to the numbers they qualify — ACS vintage overlap, area-allocated ZIP values,
  name-matched municipal values — rather than leaving them in the docs.
- `hip analyze`, the seventh of eight pipeline stages.
- HUD added to `SPEC.md`'s Version 1 source list (USPS crosswalk, income limits, Fair
  Market Rents, CHAS) — proposed and approved, the first SPEC change of the project.

### Fixed
- Change windows were anchored on `period_start`. An ACS 5-year estimate begins four
  years before it ends, so a comparison of the 2019 and 2023 vintages was labelled
  "2015 to 2019" — an eight-year span reported as four. Anchoring on `period_end` makes
  the window match its label and recovered 3,333 change rows that frequency mismatches
  had been dropping.

### Known gaps
- HUD is approved in SPEC and reachable, but not wired: ZIP allocation is still
  area-weighted and affordability uses plain ratios rather than AMI bands.
- `rent_to_income` is thin because ZORI is thin.
- Rankings cover `pct_change` only, not levels.

## [0.3.0] — 2026-08-12

Context arrives. Six more sources join Zillow, taking the warehouse to 12 metrics from 8
publishers and 1971–2026 of history. Municipal coverage reaches every New Jersey
municipality.

### Added
- **Milestone 3 — six sources.** Census ACS (median household income, gross rent,
  population, home value, and renter cost burden), Census Building Permits, FHFA HPI,
  FRED, BLS Local Area Unemployment, and IRS migration. 20,625 new observations.
- **Exact municipal data.** ACS publishes county-subdivision GEOIDs, so its municipal
  rows join on the same key TIGER uses. Municipal coverage went from **403/564 (71%) to
  564/564 (100%)** — the gap Zillow's name matching could not close.
- **A `nation` region level** and a synthetic US region, so national series such as the
  30-year mortgage rate live in the same fact table as everything else instead of a
  parallel one (migration `0004`).
- **JSON API landing.** `land_json` plus a `to_records` hook per adapter, so Census,
  FRED, and BLS each own their own response shape while sharing one lander.
- Per-adapter `csv_read_options` and a default User-Agent, for publishers whose files
  are not plain CSV or who reject unidentified clients.

### Changed
- Range checks now tolerate a small share of out-of-range values rather than failing on
  the first. ACS really does publish a $99 median gross rent for Alexandria Township;
  blocking a 330,000-row load over two such rows made the gate an obstacle.
- `hip geocode` matches whatever has been staged instead of requiring a staging model
  for every metric source, so a source whose adapter lands before its model no longer
  silently stops the sources that are ready.

### Fixed
- BLS series ids were one character short — the LAUS area code is 13 characters, so a
  county is its FIPS plus eight zeros. A wrong pad returns HTTP 200,
  `REQUEST_SUCCEEDED`, an empty array, and the real reason in a `message` field.
- IRS SOI files are latin-1; a UTF-8 read aborted at line 2333 of `countyinflow2122.csv`.
- Census Building Permits has two header rows *and* a blank line; skipping only the
  headers left DuckDB sniffing one unusable column.
- ACS municipal facts were dropped at load: they stage as `municipality` but arrive in
  the `cousub` release, so an exact `(source, layer)` provenance match found nothing.

### Known gaps
- FHFA is state-level only; no county HPI is published at a reachable URL.
- BLS falls back to 3 years of history without `BLS_API_KEY`.
- IRS migration is stored as net returns per county, not as flows.
- ACS ZIP-level data is not fetched: since 2020 ACS no longer nests ZCTAs in states.

## [0.2.0] — 2026-08-11

Housing metrics arrive. 309,350 Zillow home-value and rent observations spanning
2000–2026 are loaded, matched to regions, and served — with the source file and the
geography-matching method recorded on every single value.

### Added
- **Milestone 2 — Zillow ZHVI and ZORI.** Two adapters over three geography levels each
  (county, city, ZIP), 245MB of CSVs, cached by content hash. `hip.sources.registry`
  now resolves any source to its adapter, so the CLI is no longer wired to one source
  and `--source` names an unimplemented source with the milestone that delivers it.
- **dbt earns its place.** `stg_zillow_zhvi` and `stg_zillow_zori` unpivot ~318 wide
  monthly columns into long observations, with 15 dbt tests. Columns are selected by the
  `YYYY-MM-DD` pattern rather than by excluding known identifiers, so a new month is
  picked up automatically and a new identifier column cannot break the model.
- **Geographic matching with recorded method.** County by FIPS, ZIP by code,
  municipality by normalized name plus county. Every fact stores `match_method`, so a
  county figure matched on FIPS is distinguishable from a municipal one matched by name.
  Coverage: 21/21 counties, 548/598 ZIPs, 403/564 municipalities.
- **`hip validate`, a gate that actually blocks.** Duplicate observations, orphaned
  regions, out-of-range values, and coverage collapse each stop the load before it
  reaches the warehouse. Every run writes a JSON report to `reports/validation/`,
  passing or failing, so a metric quietly losing coverage is visible.
- **`source_match_reject` and `GET /sources/unresolved`.** Every source geography that
  could not be matched, with the reason — a census-designated place inside a township,
  an unresolvable name collision, or a geography outside scope. A user who notices a
  missing municipality gets an answer instead of silence.
- **Migration `0003`** — `metrics`, `fact_metric_observation` (keyed
  `(region_id, metric_id, period_start)` with a `release_id` and `match_method`), and
  `source_match_reject`.
- **`GET /metrics`** with per-metric coverage and date range, optionally narrowed to one
  region level, and **`GET /regions/{id}/metrics`** with date filtering and provenance
  on every observation.
- `make pipeline` now runs all six implemented stages in order and stops on a failing
  gate.

### Fixed
- The validation gate blocked its first load: 318 duplicate `(region, metric, period)`
  rows. Normalizing away `Township` and `City` suffixes had merged Boonton with Boonton
  Township, and Egg Harbor City with Egg Harbor Township — genuinely different
  municipalities with different home values. Ambiguity is now rejected on both sides of
  the join, and both directions are tested.
- The reject-reason query compared each of 333,000 observations against a correlated
  subquery and exhausted 12.8GB of DuckDB temp space. Resolution is a property of the
  geography, not the observation, so it now runs over ~2,500 distinct geographies.
- `hip acquire` was invoked for real by a CLI stub test, downloading 635MB on every
  `make test`. Stub tests now derive from the unimplemented-stage map, so implementing a
  stage removes it from that test automatically.
- dbt failures printed several kilobytes of `RunResult` node metadata, burying the
  actual error. Only the failing node and its message are surfaced now.
- `/metrics?level=` put its filter in a `LEFT JOIN` condition, which nulled the region
  but kept the fact row, so every count still included every level.

### Known gaps
- Municipal coverage is capped at 71% by name matching; raising it needs a real
  Zillow-to-MCD crosswalk, likely via NJ municipal codes when MOD-IV lands at M7.
- ZORI is sparse: 15,836 observations against ZHVI's 293,514, starting only in 2015.
- No derived metrics yet — change, affordability, and rankings arrive at Milestone 4.
- The dashboard still renders `/health`.

## [0.1.0] — 2026-08-11

First release with a populated warehouse. New Jersey's geography is loaded end to end
from public data and queryable over HTTP; no housing metrics yet.

### Added
- **Milestone 0 — Scaffolding.** `uv`-managed Python package under `src/hip` with one
  module per pipeline stage, Docker Compose Postgres 16 + PostGIS, Alembic, a dbt
  project with DuckDB and Postgres targets, a Next.js 16 dashboard shell, and a
  `Makefile` covering setup, database, API, web, test, and lint.
- **Milestone 0 — Config layer.** `config/sources.yml` (11 public sources),
  `config/geography.yml`, and `config/metrics.yml` (12 metrics), with
  `${VAR:-default}` environment resolution and validation errors naming file and key
  path. `hip check-config` cross-checks the files against each other, catching a metric
  that names an undefined source, or a source whose API key is unset, before any fetch.
- **Milestone 0 — `GET /health`.** Distinguishes unreachable, reachable-but-unmigrated,
  and migrated-but-empty — three states with three different fixes — and returns 200
  with `status: degraded` rather than 5xx when the warehouse is down, because the API
  being up and its data source being down are different failures.
- **Milestone 0 — Enforced module boundaries.** `tests/test_module_boundaries.py`
  parses every module's imports and fails on a backward pipeline import, on `api`
  reaching past `warehouse` and `packets`, or on anything importing `api`. A companion
  test asserts the checker catches known violations, so it cannot rot into a
  decorative pass.
- **Milestone 1 — NJ geography spine.** 3,365 regions loaded from Census TIGER/Line
  2025: 1 state, 21 counties, 564 municipalities, 2,181 tracts, and 598 ZCTAs, each
  with PostGIS `MULTIPOLYGON` geometry. County and municipality counts match New
  Jersey's real ones. Parent chains run `state → county → {municipality, tract}`, with
  a check constraint rejecting an orphan at insert time.
- **Milestone 1 — Source acquisition.** `SourceAdapter` with content-addressed
  immutable storage under `data/raw/<source>/<sha256>/`, an on-disk cache index so a
  re-run touches no network, retries around the one overridable I/O primitive, and a
  manifest per release. `hip acquire` fetches 635MB of TIGER data; `hip land`
  transcodes it to Parquet by reading shapefiles in place inside their zips.
- **Milestone 1 — ZIP allocation crosswalk.** 1,902 area-weighted ZIP → municipality
  and ZIP → county weights computed in EPSG:5070, validated to sum to 1.0 per source
  region and target level. Every ZIP in the warehouse is reachable by at least one
  weight.
- **Milestone 1 — Region endpoints.** `GET /regions` (paged, filtered by level, state,
  parent, and name search), `GET /regions/{region_id}` (with the full ancestor chain),
  and `GET /geo/{level}` (GeoJSON, simplified by default — 239KB instead of 3.1MB for
  NJ counties).
- **Milestone 1 — Provenance tables.** `sources` and `source_releases` record the
  exact file behind every load, keyed on content hash so unchanged bytes cannot create
  a second release.

### Fixed
- Editable installs broke after every `uv sync` with a bare
  `ModuleNotFoundError: No module named 'hip'`. `uv` sets macOS's `UF_HIDDEN` flag on
  the `.pth` files it writes, and CPython's `site.py` silently skips hidden `.pth`
  files. Make targets now export `PYTHONPATH`, which does not depend on `.pth` at all.
- Retry logic lived inside `SourceAdapter._download`, so any adapter overriding that
  method would have silently lost retries. Split into an overridable `_fetch_bytes`
  primitive and a `_download` wrapper that every adapter inherits.
- `ARCHITECTURE.md` claimed `parent_id` rolls up tract → municipality → county. Census
  tracts nest within counties; municipality and tract are siblings. The consequence is
  real — municipality-level figures derived from tract data need a crosswalk.
- 57 ZCTAs that merely touch New Jersey's border across the Delaware and Hudson were
  being recorded as NJ ZIPs. Overlap now requires positive area, so ZIP membership and
  crosswalk coverage agree at 598.

### Known gaps
- No housing metrics. `metrics` and the fact tables arrive at Milestone 2.
- ZIP allocation is area-weighted, not population-weighted; HUD's USPS crosswalk is the
  intended upgrade and needs an API key.
- `region_identifiers` exists but is empty until MOD-IV lands at Milestone 7.
- The dashboard still renders `/health`; it moves to real data at Milestone 5.
