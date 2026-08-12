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

## Milestone 2 — Home values and rents

Deliverable: Zillow ZHVI + ZORI from `hip acquire` to `hip load`; NJ county, municipal,
and ZIP series queryable at `/regions/{id}/metrics` with source provenance on every
value.

- [ ] `hip.sources.zillow` — `ZhviAdapter` and `ZoriAdapter` over county, city, and ZIP
      layers (6 files, ~245MB)
- [ ] `hip.landing.tabular` — CSV → Parquet, wide format preserved verbatim
- [ ] dbt staging models — unpivot ~318 date columns to long
      `(region_key, period, value)`. dbt's first real job (ARCHITECTURE #4)
- [ ] `hip.geography.matching` — resolve Zillow keys to `(level, geoid)`: county by
      `StateCodeFIPS || MunicipalCodeFIPS`, ZIP by code, municipality by normalized
      name + county with **ambiguous matches rejected, not guessed**
- [ ] `hip.validate` — the gate: unresolved keys, out-of-range values, duplicate
      `(region, metric, period)`, coverage drop vs the previous release
- [ ] Migration `0003` — `metrics`, `fact_metric_observation`, and a
      `region_source_match` audit table recording how each key was resolved
- [ ] `hip load` extended to facts, one transaction per release
- [ ] `GET /regions/{id}/metrics`, `GET /metrics`, coverage exposed per level
- [ ] `hip stage` and `hip validate` implemented, removing them from `_STAGE_MILESTONE`
- [ ] Tests: unpivot shape, all three matchers, ambiguity rejection, gate behavior

- Note: **decided 2026-08-11 with measured numbers.** Zillow's city-level files carry no
  FIPS, only a name and county. Of 496 NJ "cities": 422 rows match 406 municipalities
  (72%) after normalizing `Township|Borough|City|Town|Village` suffixes and joining on
  county; 90 rows are census-designated places inside townships (Iselin, Colonia,
  Whiting) with no municipal counterpart; and 16 are genuinely ambiguous because NJ has
  co-located pairs like Chatham Borough and Chatham Township in one county. Ambiguous
  rows are rejected rather than guessed, so expect ~69% municipal coverage. County and
  ZIP joins are exact and unaffected.
- Note: Zillow publishes by USPS ZIP; `regions` holds Census ZCTAs. The codes mostly
  correspond but are different objects — ZIPs are delivery routes with no area. Recorded
  as a metric caveat so it travels into analysis packets rather than living only here.
- Note: using the headline ZHVI cut (`uc_sfrcondo_tier_0.33_0.67_sm_sa`, smoothed and
  seasonally adjusted) and the all-homes ZORI (`uc_sfrcondomfr_sm`). Zillow publishes
  bottom/top tier and SFR-only variants; adding one later is a `sources.yml` entry plus
  a `metric_id`, not a schema change.

- Note: **the validation gate earned its place on the first run.** It blocked a load
  carrying 318 duplicate `(region, metric, period)` rows. Cause: normalizing away
  `Township`/`City` suffixes merged Boonton with Boonton Township and Egg Harbor City
  with Egg Harbor Township — genuinely different municipalities with different home
  values. Ambiguity is now rejected on both sides of the join (ARCHITECTURE #28).
- Note: an early version of the reject query compared each of 333,000 observations
  against a correlated scalar subquery and exhausted 12.8GB of DuckDB temp space.
  Resolution is a property of the *geography*, not the observation, so collapsing to
  ~2,500 distinct geographies first made it instant. Watch for this shape in the
  analytics milestone.
- Note: municipal coverage is 403/564 (71%) and that is a ceiling under name matching,
  not a bug to fix. Raising it needs a real Zillow-to-MCD crosswalk. Worth revisiting at
  Milestone 7 when MOD-IV arrives with NJ municipal codes — a Zillow city name could
  then be matched through the NJ code instead of by string.
- Note: `hip stage` runs dbt through its Python entry point. dbt emits several
  deprecation warnings (`MissingArgumentsPropertyInGenericTestDeprecation`) from the
  custom `accepted_range` test. Harmless today; fix when dbt makes it an error.
- Note: ZORI is thin — 15,836 observations against ZHVI's 293,514, starting only in
  2015. Any rent-based analytic at Milestone 4 needs to handle sparse series rather
  than assume ZHVI-like density.

## Milestone 3 — Economic and demographic context

Deliverable: ACS, Census Building Permits, FHFA HPI, FRED, BLS, and IRS migration
loaded through the same adapter and dbt pattern.

- [x] `hip.sources.fhfa` — `hpi_master.csv` (17MB). **State level, not county** — see
      the note below
- [x] `hip.sources.census_permits` — Building Permits Survey county annual files, 10
      years, 2.1MB
- [x] `hip.sources.irs_migration` — county inflow and outflow, 5 year-pairs, 44.3MB
- [x] `hip.sources.registry` extended; all three acquire cleanly through `hip acquire`
- [x] `hip.sources.bls` — LAUS county unemployment via the keyless v1 API. Adapter
      correct; **acquisition throttled** — see the note below
- [x] `hip.sources.census_acs` — 4 direct metrics plus the 5 cost-burden parts, at
      county and county-subdivision level, 5 ACS vintages. Landed: 21 counties and 570
      subdivisions per year
- [x] `hip.sources.fred` — MORTGAGE30US, 664 monthly observations
- [x] `land_json` + `SourceAdapter.to_records` — JSON APIs land through one lander, with
      each adapter owning its own response shape
- [ ] `hip.sources.census_acs` — 5 metrics at county, MCD, and ZCTA level (needs a key)
- [ ] `hip.sources.fred` — MORTGAGE30US, national (needs a key)
- [x] Migration `0004` — `nation` level, nullable `regions.geom`, US region row
- [x] dbt staging models for all six sources
- [x] Keyed matching path — sources with an exact identifier bypass the fuzzy matcher
- [x] Gate bounds for all 12 metrics, with an out-of-range tolerance
- [x] `test_api_metrics` updated: municipal `match_method` now differs by source
- [ ] Unit tests for the six new adapters and the keyed matching path. The pipeline is
      verified end to end but the new adapters have no direct coverage

- Note: **decided 2026-08-11 after probing every endpoint.** BLS v1, Building Permits,
  and IRS migration work with no credentials. ACS returns a "Missing Key" HTML page
  (HTTP 200, which is worth knowing — a naive adapter would treat that as success), and
  FRED returns HTTP 400. ACS and FRED adapters are written and tested against fixtures
  now, and run when the keys land.
- Note: national series get a `nation` level and a US region rather than a separate
  table, so `/regions/{id}/metrics` and the fact table work unchanged. The US region has
  no geometry, which makes it the first region where `geom` cannot be NOT NULL.
- Note: IRS county-to-county pairs are reduced to net returns per county for the
  warehouse; the full origin→destination matrix stays in DuckDB for post-V1
  migration-demand work.
- Note: **FHFA publishes no county HPI at a reachable URL.** Four documented paths all
  return 404 as of 2026-08-11; `hpi_master.csv` carries only `State`, `MSA`, and
  `USA or Census Division` levels. NJ gets 487 state-level rows, which makes FHFA the
  only source landing at `state` level and the only exercise of that matching path.
  County HPI exists in FHFA's annual "developmental" datasets — find a stable URL, or
  drop the county ambition and say so in `config/metrics.yml`.
- Note: **a keyless ACS request returns HTTP 200 with an HTML "Missing Key" page.** Any
  adapter that trusts the status code will cache an error page as data. The ACS adapter
  must assert the response parses as JSON before writing it — this is exactly the shape
  of bug the content-addressed cache would then preserve forever.
- Note: **BLS v1 allows 25 queries per day and NJ needs 21.** The first run used its
  quota discovering that my series ids were malformed, so the corrected run was refused
  with `REQUEST_NOT_PROCESSED`. The adapter is right — it now reaches a quota error
  rather than "series does not exist" — but BLS cannot be acquired again until the
  quota resets. Setting `BLS_API_KEY` (free) switches to v2: 500 queries per day and 20
  years of history instead of 3. The adapter does not use v2 yet.
- Note: the LAUS series id is `LAU` + `CN` + a **13-character** area code + a
  2-character measure, so a county is its 5-digit FIPS plus **8** zeros. Getting the
  padding wrong returns HTTP 200, `status: REQUEST_SUCCEEDED`, an empty data array, and
  the real explanation buried in a `message` field. `to_records` now raises on that
  message rather than reporting "no rows".
- Note: IRS SOI files are **latin-1, not UTF-8** — `countyinflow2122.csv` aborts a
  UTF-8 read at line 2333 on a county name. Landing now decodes latin-1, which loses no
  rows. Worth assuming for any older federal flat file.
- Note: federal hosts increasingly reject clients with no User-Agent. `SourceAdapter`
  now sends one for every request. It is not enough for `download.bls.gov`, which
  returns 403 to programmatic clients regardless — hence the API route for BLS.
- Note: adding the three sources to `METRIC_SOURCES` briefly broke Zillow matching.
  `geocode` required a dbt staging model for *every* metric source before resolving
  any, so sources whose adapter landed ahead of their staging model silently stopped
  the ones that were ready. It now matches whatever is staged and names what is not.
  Caught by re-running the pipeline, not by a test — worth a test when the staging
  models land.

- Note: **ACS closed the municipal gap entirely.** Coverage went from 403/564 to
  564/564 because ACS publishes county-subdivision GEOIDs. Zillow's name-matched
  municipal values remain, labelled `name_county`, alongside ACS's `fips` values — the
  reason `match_method` is stored per fact rather than per source.
- Note: ACS ZIP-level data is not fetched. Since 2020 ACS no longer nests ZCTAs within
  states, so a ZIP pull means downloading all ~33,000 nationally per vintage for the 598
  that matter. Revisit if ZIP-level income is needed at Milestone 4.
- Note: fact provenance for keyed sources falls back from `(source, layer)` to
  `(source)` (ARCHITECTURE #33). ACS municipal rows stage as `municipality` but arrive
  in the `cousub` release, and the exact match silently dropped them. The clean fix is
  to carry the release layer through staging, which needs the globbed dbt models to
  record which file each row came from.
- Note: `hip load` re-fetches every source's refs just to rebuild provenance, which
  means `acquire`-level work inside `load`. Harmless while cached, wrong in principle —
  the loader should read the manifests instead.

## Milestone 4 — Computed housing intelligence

Deliverable: change metrics, affordability, and rankings in the warehouse;
`/rankings`, `/compare`, `/regions/{id}/summary`.

- [x] Migration `0005` — `fact_metric_change`, `region_rankings`, `hip_derived` source
- [x] `hip.analytics.compute` — pct change and CAGR over 1y/3y/5y/10y/since-2019
- [x] Affordability — `price_to_income` and `rent_to_income` as computed metrics
- [ ] HUD AMI bands — approved in SPEC, token in `.env`, not yet wired
- [x] Rankings — rank, percentile, and cohort size per (metric, level, window)
- [ ] `hip.sources.hud` — USPS crosswalk (types 2 and 11) and income limits
- [ ] Replace area-weighted ZIP allocation with HUD `res_ratio`, keeping `method` so
      both remain comparable (ARCHITECTURE #26 named this seam)
- [x] `hip analyze` implemented and removed from `_STAGE_MILESTONE`
- [x] `GET /rankings`, `GET /compare`, `GET /regions/{id}/summary` with caveats
- [x] Tests (86 passing) and docs

- Note: **SPEC.md edited 2026-08-12 with explicit approval** — HUD USPS crosswalk,
  income limits, Fair Market Rents, and CHAS added to the Version 1 source list. This is
  the only SPEC change so far; it was proposed and approved rather than made unilaterally.
- Note: HUD publishes `type=11` **zip-countysub** with residential-address ratios, so
  ZIP data can be allocated to municipalities on household share rather than land area.
  That is the correct basis for housing measures and directly supersedes the area
  weighting from Milestone 1.
- Note: derived metrics are written to `fact_metric_observation` as ordinary
  `metric_id`s under a synthetic `hip_derived` source, one release per `analyze` run.
  Keeps ARCHITECTURE #8 (one fact table, new metrics are rows) and #9 (every fact
  traces to a release) true for computed values, and makes a derivation reproducible.

- Note: **change windows were mislabelled** until anchored on `period_end`. An ACS
  5-year estimate begins four years before it ends, so a 2019-vintage vs 2023-vintage
  comparison was recorded as "2015 to 2019" — a real eight-year span reported as four.
  Found by reading actual `/rankings` output, not by a test; there is now a test
  asserting a 5y window spans 1,400–2,200 days.
- Note: `rent_to_income` has 293 observations against `price_to_income`'s 2,026, because
  ZORI is sparse. Any rent-based ranking is over a much smaller cohort than a
  value-based one, and the API does not yet surface that difference.
- Note: rankings compare `pct_change` only. Ranking on level ("most expensive county")
  is a separate question the tables do not answer yet.

## Parked / needs user input

- ~~Census, FRED, and BLS API keys~~ — all three supplied 2026-08-12 and in `.env`.
  They are in the chat transcript of that session, so rotate them if it is ever shared.
- **HUD USPS crosswalk token** — optional but wanted. Would replace the area-weighted
  ZIP allocation (ARCHITECTURE #26) with residential-address weighting, which is the
  right basis for housing metrics. Free, requires registration at
  https://www.huduser.gov/portal/dataset/uspszip-api.html
