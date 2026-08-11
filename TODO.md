# Housing Intelligence Platform — TODO

Working list for the current milestone. Longer-horizon items live in
[ROADMAP.md](ROADMAP.md).

## Milestone 0 — Scaffolding

- [x] Product specification written and agreed ([SPEC.md](SPEC.md))
- [x] Architecture decided and recorded, including the storage tiers, the module
      boundary rule, the warehouse schema, and the eight pipeline stages
      ([ARCHITECTURE.md](ARCHITECTURE.md))
- [x] Milestone plan for Version 1 ([ROADMAP.md](ROADMAP.md))
- [x] Documentation set complete: TODO, [CHANGELOG.md](CHANGELOG.md),
      [README.md](README.md)
- [x] Python project scaffold — `uv`, `pyproject.toml`, `src/hip/` package layout,
      committed `uv.lock`, `py.typed`
- [x] `.gitignore` covering `data/`, `.venv/`, `node_modules/`, `.env`, `*.duckdb`
- [x] `hip` Typer entrypoint: `--version`, `check-config`, and one command per pipeline
      stage (`acquire`, `land`, `stage`, `geocode`, `validate`, `load`, `analyze`,
      `pack`), each exiting 1 with the milestone that delivers it
- [x] Config loading — `config/sources.yml` (10 sources), `config/geography.yml`,
      `config/metrics.yml` (12 metrics) parsed by `hip.config` with
      environment-variable resolution and errors that name file and key path
- [x] Cross-file config check: a metric naming an undefined source, or a source whose
      declared API key variable is unset, is reported by `hip check-config`
- [x] `docker-compose.yml` running Postgres 16 + PostGIS with a healthcheck, plus
      `.env.example` documenting the default port — **written, never run**
- [x] Migration harness with a baseline revision that enables PostGIS, verified in
      Alembic offline mode — **never applied to a live database**
- [x] dbt project with `duckdb` and `postgres` targets; `dbt debug` passes on `duckdb`
      — **`postgres` target unverified**
- [x] `GET /health` returning service status, database connectivity, whether the schema
      is migrated, and the last successful load timestamp
- [x] Next.js app in `web/` server-rendering the `/health` response, verified end to
      end against a running API
- [x] `pytest`, `ruff`, and `mypy --strict` configured and clean, with an AST test that
      fails when the module dependency rule is violated — and a companion test proving
      the checker catches known violations, so it cannot rot into a decorative pass
- [x] `Makefile` with `setup`, `db-up`, `migrate`, `api`, `web`, `test`, `lint`,
      `check-config`, `dbt-debug`, `clean`, matching the commands in
      [README.md](README.md)
- [x] **Postgres path verified** (2026-08-11, once Docker was installed): `make db-up`
      brings up PostGIS, `make migrate` applies `0001` and `0002`, and `/health` reports
      `connected: true, migrated: true` with a real `last_load_at`. Milestone 0 closed.

- Note: pinned the Python patch version in `.python-version` (ARCHITECTURE #18). uv
  resolved Python through a `cpython-3.12` symlink and wrote it into `pyvenv.cfg`, while
  CPython resolved it to `cpython-3.12.13`; the mismatch silently disabled `.pth`
  processing, breaking every editable install and surfacing only as
  `ModuleNotFoundError: No module named 'hip'` after unrelated `uv sync` runs. Revisit
  when bumping Python — and be suspicious of this failure mode, it wastes an hour.
- Note: `hip check-config` exits 1 on a clean checkout because three source API keys are
  unset. That is correct behavior, but it means `check-config` cannot be wired into
  `make lint` or CI until the keys exist. Revisit at Milestone 3.
- Note: the local LLM runtime is deliberately unchosen (ARCHITECTURE #11). Milestone 6
  produces analysis packets with no consumer; the runtime gets picked at Milestone 8
  from evaluation results rather than from reputation. Candidates now include Qwen3.5 9B
  and Gemma 4 QAT, which adds a quantization axis to the evaluation — a quantized build
  against its full-precision sibling is a different question from model-vs-model.
- Note: parcel and MOD-IV data will not be loaded into Postgres (ARCHITECTURE #16).
  Revisit at Milestone 7 — if municipality-level aggregates turn out to be too coarse
  for the dashboard, the alternative is a parcel table partitioned by county, which
  changes the backup and load story.
- Note: NJ municipal geography is now an explicit config key
  (`geography.municipality_id_system`, defaulting to `census_mcd`) rather than an
  assumption buried in code, but the decision is still open. It must be settled before
  Milestone 1 loads `regions`, because every fact row will reference the resulting
  `region_id`.
- Note: Zillow's municipality-level ZHVI coverage for NJ is partial — small boroughs are
  frequently absent. Confirm actual coverage during Milestone 2 before the dashboard
  promises municipal series; the fallback is county-level only with municipal coverage
  shown as a data-availability layer.
- Note: `web/` acquired `AGENTS.md` and `CLAUDE.md` from the Next.js scaffold. Neither
  has been reviewed; decide at Milestone 5 whether to keep, edit, or delete them.
- Note: Starlette's `TestClient` emits a deprecation warning asking for `httpx2`. It is
  suppressed in `pyproject.toml` rather than fixed, because swapping the HTTP client is
  not Milestone 0 work. Revisit before it becomes an error.

## Milestone 1 — NJ geography spine

Deliverable: `regions` loaded with NJ state, counties, municipalities, tracts, and ZIPs
with PostGIS geometry and crosswalks; `/regions` and `/geo/{level}` serving real data.

- [x] `hip.sources.base` — `SourceAdapter` protocol, content-addressed download with
      retry and caching, `Release` record carrying sha256 and vintage
- [x] `hip.sources.tiger` — Census TIGER/Line 2025 adapter for the five layers
      (`state`, `county` national; `cousub`, `tract` per state; `zcta520` national)
- [x] `hip.landing` — TIGER zip → Parquet via DuckDB `ST_Read('/vsizip/...')`, geometry
      normalized to MultiPolygon WKB
- [x] `hip.geography.regions` — region rows for all five levels, `COUSUBFP = '00000'`
      filtered out, parent chain resolved, scoped by `config/geography.yml`
- [x] `hip.geography.crosswalk` — area-weighted ZCTA → municipality and ZCTA → county
      allocation in EPSG:5070, weights summing to 1.0 per source region
- [x] `hip.warehouse.models` + migration `0002` — `regions`, `region_identifiers`,
      `region_crosswalk`, `sources`, `source_releases`
- [x] `hip load` — one-transaction upsert with `source_releases` provenance, verified
      idempotent: a second run leaves every `region_id` unchanged
- [x] `GET /regions`, `GET /regions/{region_id}`, `GET /geo/{level}`
- [x] Tests: 21 NJ counties, 564 municipalities, crosswalk weights sum to 1.0,
      parent chain integrity, endpoint shape — 64 passing
- [ ] Point the dashboard at `/regions` instead of `/health`. Deferred to Milestone 5,
      which owns the UI; the M0 health page is still what `make web` serves.

- Note: TIGER returns 569 NJ county subdivisions; 564 are municipalities and 5 are
  `CLASSFP = 'Z9'` / `COUSUBFP = '00000'` water and undefined areas. Both filters agree,
  and 564 matches the state's own municipality count. Filtering on `COUSUBFP` because it
  is the identifier the rest of the join keys on.
- Note: **corrected an error in ARCHITECTURE.md.** It claimed `parent_id` rolls up
  tract → municipality → county → state. Census tracts nest within *counties*, not
  municipalities — tract and municipality are siblings under county, and a tract can
  straddle municipal lines. Any municipality-level metric derived from tract data
  therefore needs a crosswalk, exactly like ZIP.
- Note: TIGER geometry arrives as a mix of POLYGON (556) and MULTIPOLYGON (13). Landing
  normalizes everything through `ST_Multi()` so the warehouse column can be a single
  uniform type.
- Note: the ZCTA layer is a 529MB national download — Census stopped publishing
  state-partitioned ZCTAs after 2020. It is cached content-addressed on first fetch and
  never re-downloaded, but a clean checkout pays for it once.
- Note: `region_identifiers` is created at Milestone 1 but stays empty. NJ municipal
  codes come from MOD-IV / NJ Division of Taxation, which does not arrive until
  Milestone 7 — the schema commitment lands now, the data later.
- Note: **the `.pth` diagnosis in ARCHITECTURE #18 was wrong**, corrected by #24. The
  cause is not a stale interpreter symlink: uv sets macOS's `UF_HIDDEN` flag on every
  `.pth` file it writes, and CPython's `site.py` skips hidden `.pth` files. It recurs on
  every `uv sync`, including the implicit one inside `uv run`, so no file-based fix
  survives. Make targets export `PYTHONPATH` and are immune; bare `uv run hip` needs
  `make venv-fix` after a sync. If `ModuleNotFoundError: No module named 'hip'` ever
  reappears, this is why — do not re-diagnose it from scratch.
- Note: the test suite briefly downloaded all 635MB of TIGER data on every run, because
  `runner.invoke(app, ["acquire"])` in the CLI stub test invoked the real command once
  `acquire` was implemented. Stub tests now iterate `_STAGE_MILESTONE` (unimplemented
  stages only) rather than a hard-coded list, so implementing a stage removes it from
  that test automatically.
- Note: retry and error-wrapping originally lived in `SourceAdapter._download`, which a
  subclass overriding `_download` would silently lose. Split into `_fetch_bytes` (the
  overridable I/O primitive) and `_download` (retry + error wrapping), so every future
  adapter inherits retries without opting in. Found by a test, not by review.
- Note: crosswalk weights carry ~1% area error for polygons with few vertices, because
  `ST_Transform` reprojects vertices without densifying edges. Negligible for real TIGER
  geometry, which is vertex-dense; it only shows up in synthetic test fixtures. Revisit
  if a source ever supplies coarse polygons.
- Note: `postgis/postgis:16-3.4` has no arm64 image, so Docker runs it emulated on this
  Mac. Fine at 3,365 rows; check performance when the fact tables land at Milestone 2.

## Parked / needs user input

- **Census API key** — needed at Milestone 3 for ACS pulls above the anonymous rate
  limit. Free, requires an email address.
- **FRED API key** — required at Milestone 3; there is no anonymous access.
- **BLS API key** — optional at Milestone 3, but the anonymous tier is 25 queries per
  day, which is limiting for repeated pulls.
- **HUD USPS crosswalk token** — optional but wanted. Would replace the area-weighted
  ZIP allocation (ARCHITECTURE #26) with residential-address weighting, which is the
  right basis for housing metrics. Free, requires registration at
  https://www.huduser.gov/portal/dataset/uspszip-api.html
