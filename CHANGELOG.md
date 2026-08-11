# Changelog

All notable changes to the Housing Intelligence Platform. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

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
