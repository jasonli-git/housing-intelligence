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
- [x] Point the dashboard at `/regions` instead of `/health` — done at Milestone 5. The
      overview reads `/rankings` and `/geo`, and no page renders `/health` any more.

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

- [x] `hip.sources.zillow` — `ZhviAdapter` and `ZoriAdapter` over county, city, and ZIP
      layers (6 files, ~245MB)
- [x] `hip.landing.tabular` — CSV → Parquet, wide format preserved verbatim
- [x] dbt staging models — unpivot ~318 date columns to long
      `(region_key, period, value)`. dbt's first real job (ARCHITECTURE #4)
- [x] `hip.geography.matching` — resolve Zillow keys to `(level, geoid)`: county by
      `StateCodeFIPS || MunicipalCodeFIPS`, ZIP by code, municipality by normalized
      name + county with **ambiguous matches rejected, not guessed**
- [x] `hip.validate` — the gate: unresolved keys, out-of-range values, duplicate
      `(region, metric, period)`, coverage drop vs the previous release
- [x] Migration `0003` — `metrics`, `fact_metric_observation`, and the match audit
      table. Named `source_match_reject` in the end, not `region_source_match`: it
      records what failed to resolve and why, which is the useful half.
- [x] `hip load` extended to facts, one transaction per release
- [x] `GET /regions/{id}/metrics`, `GET /metrics`, coverage exposed per level
- [x] `hip stage` and `hip validate` implemented, removing them from `_STAGE_MILESTONE`
- [x] Tests: all three matchers and ambiguity rejection on both sides
      (`tests/test_matching.py`, 10 tests)
- [ ] Tests: **unpivot shape and gate behavior — never written.** Corrected 2026-08-13
      after this line was briefly ticked in full. `test_matching.py` builds
      `stg_zillow_zhvi` as a hand-made fixture, so the dbt UNPIVOT of ~318 date columns
      is exercised by pipeline runs only. `hip.validate.gate` (216 lines) has no test
      importing it at all — the thing whose whole job is to block a bad load is the
      least-tested module in the pipeline.

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
  then be matched through the NJ code instead of by string. **Milestone 7 update:**
  MOD-IV landed and `region_identifiers` now holds 554 NJ codes, so the crosswalk exists
  — but routing Zillow through it still needs a Zillow-name-to-CD_CODE mapping, which
  MOD-IV does not supply. Zillow's 403 stands.
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
- [x] `hip.sources.census_acs` — keys supplied 2026-08-12; county and MCD are loaded.
      **ZCTA level dropped**, not deferred: since 2020 ACS no longer nests ZCTAs within
      states, so a ZIP pull means all ~33,000 nationally per vintage for the 598 that
      matter. See the note below.
- [x] `hip.sources.fred` — MORTGAGE30US, national, 664 observations loaded
- [x] Migration `0004` — `nation` level, nullable `regions.geom`, US region row
- [x] dbt staging models for all six sources
- [x] Keyed matching path — sources with an exact identifier bypass the fuzzy matcher
- [x] Gate bounds for all 12 metrics, with an out-of-range tolerance
- [x] `test_api_metrics` updated: municipal `match_method` now differs by source
- [ ] Unit tests for the source adapters. Still open and **wider than first written**:
      as of Milestone 7, 2 of 11 adapters have direct tests — `TigerAdapter`
      (`tests/test_sources.py`) and `ModivAdapter` (`tests/test_nj_modiv.py`). The nine
      metric adapters — Zillow ZHVI and ZORI, ACS, FRED, BLS, FHFA, permits, IRS, HUD —
      have none. They are exercised end to end by pipeline runs, but nothing drives
      their `refs()` or `to_records()` against a stubbed response, so a publisher
      changing a response shape would surface as a pipeline failure rather than a test.
      `test_nj_modiv.py` is the pattern to copy — a `MockTransport` subclass, no
      network.

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
  years of history instead of 3. ~~The adapter does not use v2 yet.~~ **Corrected
  2026-08-13: it does** — `bls.py` picks `BASE_V2` whenever the key is present, and the
  key has been in `.env` since 2026-08-12.
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
- [x] HUD AMI bands — `price_to_ami` shipped in Milestone 9
- [x] Rankings — rank, percentile, and cohort size per (metric, level, window)
- [x] `hip.sources.hud` — USPS crosswalk (types 2 and 11) and income limits, shipped in
      Milestone 9
- [x] Replace area-weighted ZIP allocation with HUD `res_ratio` — 2,456 of 2,491 rows,
      shipped in Milestone 9. `method` records which produced each row, though it does
      **not** let both coexist for one pair; see the Milestone 9 note on #37.
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

## Milestone 9 — HUD affordability inputs

Taken before Milestone 5 deliberately: both changes improve numbers the dashboard will
display, and fixing them after it ships means re-checking every chart.

- [x] `hip.sources.hud` — crosswalk types 2 and 11, income limits 2020-2024
- [x] dbt staging models for both
- [x] HUD weights supersede area: 2,456 of 2,491 rows, 35 area fallbacks
- [x] `hud_area_median_income`, `hud_income_limit_80`, and derived `price_to_ami`
- [x] Tests (88 passing) and docs

- Note: HUD income limits are published per county per year, so a full pull is 21
  counties x 5 vintages = 105 small requests. Slower than one bulk file but the API is
  the only public route.
- Note: the 4-person household figure is used for `hud_income_limit_80`. HUD publishes
  limits for 1-8 person households; 4-person is the conventional reference and the one
  policy documents quote.

- Note: **ARCHITECTURE #26 was wrong about coexistence.** It claimed `method` would let
  area and HUD weights sit side by side and be compared; the primary key on
  `(from_region_id, to_region_id)` allows one method per pair. #37 supersedes it. Truly
  comparing methods would need `method` in the key.
- Note: `price_to_ami` has 105 observations against `price_to_income`'s 2,026 because
  HUD publishes income limits per county only. A municipal AMI would mean pushing a
  county limit downward, which HUD does not sanction.
- Note: HUD Fair Market Rents and CHAS are approved in SPEC but not fetched. FMR would
  fill ZORI's sparsity at county level; CHAS would replace the cost-burden ratio
  computed from raw ACS columns.

## Milestone 5 — Dashboard and maps

Deliverable: Next.js region explorer, trend charts, county comparison, choropleth maps,
ranking tables.

- [x] `web/lib/api.ts` (fetchers, server-only) and `web/lib/format.ts` (pure, shared)
- [x] Palette as CSS custom properties, light and dark both selected
- [x] `Choropleth` — inline SVG, ramp selected from the data, quintile breaks
- [x] `TrendChart` — hand-rolled SVG with crosshair and tooltip, a client island
- [x] Ranking table and metric tiles
- [x] `/` overview and `/regions/[id]` detail pages
- [x] Table view under every chart, with source and match method per observation
- [x] Docs; 88 Python tests still green and `tsc --noEmit` clean
- [x] Frontend tests — Vitest added at Milestone 6; 26 tests over `lib/format.ts` and
      `lib/scale.ts`. Still arithmetic only: no test renders a component.

- Note: palette validated with the dataviz skill's script before any chart code was
  written. The three categorical slots pass all-pairs CVD and normal-vision floors in
  both modes; aqua measures 2.74:1 on the light surface, which triggers the relief rule
  — direct labels and a table view are required, not optional.
- Note: **the first map was a single flat colour.** Diverging around zero is only right
  when values straddle zero; all 21 NJ counties rose over five years, so every one
  landed in the top class. The ramp is now chosen from the data and the breaks are
  quintiles. Caught by looking at the rendered page — the palette validator checks
  colour, not whether the encoding suits the distribution.
- Note: `web/` has **no test runner**. The Python suite covers the API the dashboard
  reads, and `tsc --noEmit` covers types, but no test asserts the choropleth classes a
  value correctly or that the trend chart projects points where it should. Worth adding
  before the UI grows.
- Note: `web/AGENTS.md` and `web/CLAUDE.md` are generated by `next dev` and re-created
  on every run. Decided at Milestone 5 to keep them — they carry a real warning that
  this Next version differs from older conventions, which is how the async-`params`
  change was caught.

## Milestone 6 — Analysis packets and reports

Deliverable: a versioned packet schema with a published JSON Schema file, `hip pack`
writing packets to disk, `GET /regions/{id}/packet`, and an exportable county report in
Markdown and as a print-ready page.

- [x] `hip.packets.schema` — Pydantic models for packet `1.0`, `extra="forbid"`
- [x] `schemas/packet-v1.json` — the published contract, generated from the models, with
      a drift test so the file and the code cannot disagree
- [x] `hip.packets.caveats` — pure caveat derivation, shared with `/regions/{id}/summary`
      instead of the router keeping its own copy
- [x] `hip.packets.assemble` — `build_packet(session, region_id, window)` reading every
      number from the warehouse
- [x] `hip.packets.report` — `render_markdown(packet)`, pure
- [x] `hip pack` — packets to `data/packets/<window>/`, `--report` also writes Markdown
      to `reports/regions/<window>/`; removed from `_STAGE_MILESTONE`, which is now empty
- [x] `hip schema` — print or `--write` the published JSON Schema
- [x] `GET /regions/{id}/packet` and `GET /regions/{id}/report` (text/markdown)
- [x] Web `/regions/[id]/report` — print-ready page laid out from the packet
- [x] Vitest in `web/`, closing the Milestone 5 gap: `lib/format.ts` and the extracted
      `lib/scale.ts` (choropleth ramp, quintile breaks, chart projection) — 24 tests
- [x] Tests (131 Python, 24 dashboard) and docs
- [x] **Fix release-vintage provenance** — done in Milestone 7, see that section.

- Note: **a packet's `release_id` names the right source but the wrong vintage.** Found
  by building the first packet and reading its sources table: every ACS observation for
  Mercer County, across all five vintages, cites release 98 (vintage 2019).
  `_release_ids` in `hip.warehouse.load` returns `dict[(source_id, layer), release_id]`,
  which is not a unique key for a source publishing several vintages — ACS has 10
  releases, HUD has 107 — so all but one collapse and every year's fact points at the
  survivor. ARCHITECTURE #33 described a milder version of this as a layer-matching
  fallback; #47 records the real cause. The fix: carry each row's source file through
  staging (the ACS dbt model already extracts a vintage from `filename`), add it to
  `stg_metric_observation`, and key releases on `(source, layer, vintage)`. Five dbt
  models, `matching.py`, `load.py`, and a re-run of `stage → geocode → load`. **Fixed in
  Milestone 7** (ARCHITECTURE #53), and the approach turned out simpler than sketched:
  the Parquet path already encodes the vintage for every source, so one macro covers all
  of them.
- Note: the packet is deliberately per (region, window). Comparing two counties means two
  packets. A cross-region packet would be a different contract, not a bigger one; leave
  it until something actually needs it.
- Note: `web/` tests cover arithmetic, not rendering — no jsdom, no component tests. The
  bugs Milestone 5 shipped were arithmetic (the one-colour map), so that is where the
  coverage went. A render test needs jsdom plus a React testing library, which is a
  bigger dependency decision than this milestone wanted to make.
- Note: `make test` now runs both suites and prints a skip message when
  `web/node_modules` is absent rather than failing. `make test-py` and `make test-web`
  run one each.
- Note: both `data/` and `reports/` are gitignored, so packets and generated reports are
  machine-local and rebuildable — correct for artifacts, but it means no example report
  is visible to anyone browsing the repository. If one is wanted as a portfolio artifact,
  it needs a deliberate `git add -f` of a single file, not a change to `.gitignore`.
- Note: `web/tsconfig.tsbuildinfo` is tracked and changes on every `tsc` run, so it shows
  up dirty in unrelated diffs. It is a build artifact and belongs in `.gitignore` plus a
  `git rm --cached`. Left alone here because it is a git-history change, not a
  Milestone 6 one.
- Note: stale `.next/types/*d 2.ts` duplicates (macOS file-duplication artifacts inside
  the build directory) made `npx tsc --noEmit` report ~20 duplicate-identifier errors
  that had nothing to do with the source. `rm -rf web/.next` clears it; `make clean`
  already does. Worth remembering before debugging a phantom type error.

## Milestone 7 — Parcel and MOD-IV layer

Deliverable: NJ parcels in Parquet/DuckDB, municipality-level assessment aggregates
promoted to the warehouse and surfaced in the dashboard. Taken with two additions agreed
before starting: full support for level metrics (packet `1.1`, rank-on-value), and the
release-vintage provenance fix carried over from Milestone 6.

- [x] `hip.sources.nj_modiv` — 3.48M parcels via `OBJECTID`-window paging, 1,741
      requests, ~32 minutes, 1.16GB NDJSON
- [x] `land_ndjson` — DuckDB streams NDJSON to Parquet, 67MB, no Python in the path
- [x] `SourceAdapter.filename()` so an assembled release names its own file
- [x] `stg_nj_modiv` — six municipality aggregates for 554 of 564 municipalities
- [x] `nj_municipal_name()` macro — legal-form match, county half by arithmetic
- [x] `stg_nj_municipal_codes` + `load_region_identifiers` — 554 codes, delivering the
      `region_identifiers` column open since Milestone 1 (ARCHITECTURE #21)
- [x] Migration `0006` — `region_rankings.basis`; `_value_rankings` builds 8,302 rows
- [x] `/rankings?basis=value`, `/regions/{id}/summary` levels
- [x] Packet `1.1` — `levels` array, report section, dashboard tables
- [x] **Release-vintage fix** — `release_vintage()` macro, every staging model carries
      it, loader keys `(source, layer, vintage)`. Each ACS year now cites its own
      release; all five vintages in use (ARCHITECTURE #53)
- [x] Gate bounds for the six new metrics
- [x] Tests (146 Python, 26 dashboard) and docs

- Note: **the 943MB bulk geodatabase is unreachable to an automated client.** NJGIN
  publishes the whole composite at `geoapps.nj.gov`, which would be one download instead
  of 1,741 requests. That host is behind Imperva: `HEAD` returns 200, `GET` returns a 403
  JavaScript challenge. Defeating bot protection is out of scope, so acquisition uses the
  ArcGIS Feature Service, which is a public API meant to be queried. `_fetch_bytes` is
  the seam if the file ever becomes reachable.
- Note: **`resultOffset` paging would have taken 13 hours.** Measured 2026-08-12: a
  2000-row page costs 0.76s at offset 0 and 26.7s at offset 1,500,000, because the server
  materializes and discards every skipped row. `OBJECTID` windows are ~1.0s at any depth.
  Worth remembering for any other ArcGIS bulk extract.
- Note: **ArcGIS returns dates as epoch milliseconds**, so `PCL_PBDATE` arrives as a
  BIGINT and `::date` fails outright. `epoch_ms()` first. It failed loudly, which is
  better than the silent 1970 a looser cast would have produced.
- Note: the first fetch was restarted seven minutes in to add `PCL_PBDATE`. Without it
  the observation period would have had to be invented, and a fact with a made-up date is
  worse than no fact. Counties publish on their own cycles, so the dates genuinely range
  from 2023-10-03 to 2026-06-04.
- Note: **10 municipalities remain unmatched**, all MOD-IV truncations from a fixed-width
  field — "UPPER SADDLE RIV", "PARSIPPANY TR HLS", "SOUTH ORANGE VILLAGE TW",
  "PEAPACK GLADSTONE", "LOWER ALLOWAY CREEK", "PT PLEASANT BEACH", "ORANGE CITY",
  "CALDWELL BORO", "NORTH CALDWELL", "ESSEX FELLS". General abbreviation rules got 534 →
  554; the rest need a rule per place, which is the guessing ARCHITECTURE #27 rejects.
  Revisit only if a published CD_CODE-to-GEOID crosswalk turns up.
- Note: `modiv_median_year_built` can land on a half-year (1931.5) because a median over
  an even count interpolates. The `year` formatter rounds for display. Harmless, but it
  is why the stored value is not an integer.
- Note: value rankings cover 8,302 rows against 19,517 change rankings, because a value
  ranking exists once per (metric, level) while a change ranking exists once per
  (metric, level, window).
- Note: **`/rankings` response changed shape.** `pct_change`, `start_value`, `end_value`,
  `window_start`, and `window_end` are now nullable, and `value` always carries the
  ranked quantity. The dashboard overview reads `value`; any other consumer must handle
  the nulls under `basis=value`.
- Note: adapters now report progress through `logging`, configured once in the CLI
  callback. httpx's own INFO logging had to be silenced or a 1,741-request fetch prints
  1,741 URLs.

## Milestone 8 prep — local model environment (2026-08-13)

Not a milestone. Environment and measurement work done between Milestone 7 and
Milestone 8 so the evaluation starts from measured facts about this machine rather
than from benchmark reputation (SPEC principle 9). The only repository change is a
dependency group; the models, the two helper scripts, and every number below live
outside the repo. The design decisions are recorded here rather than in
[ARCHITECTURE.md](ARCHITECTURE.md) because nothing implements them yet — they become
Decisions Log rows when Milestone 8 lands.

### What now exists

Eight candidate models, four per cohort, **every one of them 4-bit**.

- [x] **`mlx` dependency group** in `pyproject.toml` and `uv.lock` (ARCHITECTURE #55).
      `mlx-lm` 0.31.3 on `mlx` 0.32.0, in the project's own 3.12.13 environment. An
      earlier `python3 -m pip install mlx-lm` had landed on the system Python 3.9.6 —
      EOL since October 2025, a different interpreter from the project's, console
      scripts off `PATH`. 146 Python and 26 dashboard tests still pass after the change.
- [x] **Four MLX models**, all 4-bit, read in place from `~/.lmstudio/models/` with no
      import step: Qwen3-8B, Qwen3.5-9B, gemma-4-E4B, Phi-4-mini-reasoning.
- [x] **Four GGUF models registered with Ollama**, imported from LM Studio and then
      hardlinked back to the original file, so the second registration costs near-zero
      disk on the same APFS volume. Verified 2026-08-13: every blob below has link
      count 2, so no model holds a private copy of its weights.

| Ollama name | Quant | Weights |
|---|---|---|
| `bench-qwen3-8b-q4` | Q4_K_M | 4.7G |
| `bench-gemma-4-e4b-q4` | Q4_K_M | 5.0G |
| `bench-gemma-4-12b` | Q4_0 (QAT) | 6.5G |
| `bench-nemotron-3-4b` | Q4_K_M | 2.6G |

- [x] **Two higher-precision models removed** — `bench-qwen3-8b-q6` (Q6_K, 6.3G) and
      `bench-gemma-4-e4b-q8` (Q8_0, 7.5G), deleted 2026-08-13 after their measurements
      were taken. Both had been imported and measured; deleting the LM Studio originals
      dropped each Ollama blob to link count 1, so the registrations were holding the
      only remaining copies — 13.7 GiB of real disk on a machine where memory is the
      binding constraint. `ollama rm` on both took `~/.ollama/models/blobs` from 33G to
      19G. This retires the quantization axis (below).
- [x] Telemetry paths confirmed on both runtimes (below).

### Measured on this machine (M4, 16GB unified memory)

- **Memory is the binding constraint, and context size is the lever.** gemma-4-E4B
  Q8_0 at Ollama's default `num_ctx: 16384` pushed swap from 758MB to 3,718MB. The
  same model at `num_ctx: 4096` with `keep_alive: 0` added 0 MB of swap.
- **KV-cache quantization is not the lever.** f16 → q8_0 → q4_0 on gemma-4-E4B saved
  roughly 0.1GB and cost 7–10% throughput. **Weight quantization is:** Q8_0 → Q4_K_M
  saved 2.6GB (32%) and ran 51% faster (26.3 against 17.4 tok/s) on the same prompt,
  with the same correct answer. This is the finding that made the Q8 and Q6 models
  disposable: 4-bit won decisively on memory and throughput, which are the two
  constraints that bind here, and showed no quality cost on the prompts tried. That
  last clause is the weak one — quality was spot-checked, not graded, which is exactly
  the thing Milestone 8 exists to do properly. Retiring the axis accepts that gap
  deliberately rather than pretending it was closed.
- Both bullets above were measured on models that **no longer exist locally**. The
  numbers stand as the record of why the cohort is uniformly 4-bit; re-running either
  comparison would mean re-downloading Q8_0 or Q6_K weights.
- **Packet format is a 3× token decision.** A county packet serialized as JSON is
  6,043 tokens; the same packet as Markdown is 2,096. Identical information.
- **Ollama telemetry** comes from `/api/generate` with `"stream": false` —
  `prompt_eval_count`, `eval_count`, `eval_duration`, `load_duration`,
  `total_duration`. Quantization from `ollama show`.
- **MLX telemetry** comes from `stream_generate` — `prompt_tokens`,
  `generation_tokens`, `prompt_tps`, `generation_tps`, `peak_memory`, `finish_reason`.
  TTFT is the timestamp of the first yield (measured 208ms). Quantization from
  `config.json`.
- **The two memory numbers are not comparable.** `mx.get_peak_memory()` is a true
  allocator peak; Ollama exposes only process RSS.

### Decisions taken (not yet built)

1. **Two cohorts, then a format comparison, with the anchor pairs run first.** MLX
   models go through MLX-LM, GGUF models through Ollama; a targeted JSON-vs-Markdown
   comparison follows. The original plan ran the anchors second. Corrected: choosing
   "the best model" across two cohorts *is* a cross-runtime comparison, so cohort
   separation alone does not remove the confound — the anchors are what license the
   comparison and therefore have to come first. Both anchor pairs are matched at
   4-bit: Qwen3-8B Q4_K_M against MLX 4bit, gemma-4-E4B Q4_K_M against MLX 4bit. Since
   the Q6 and Q8 models were deleted, **every model in both cohorts is 4-bit**, so
   precision is no longer a variable anywhere in the comparison — the anchors now
   isolate the runtime alone, which is all they were ever meant to test.
2. **Grade final answers only; count reasoning tokens as a separate efficiency
   metric.** Supported by the Nemotron measurement below.
3. **Two modes: deterministic for selection, temp 0.7 for stability on the winners.**
   Two additions to the original: vary the seed across stability runs (a fixed seed at
   0.7 reproduces the same sample, which tests reproducibility rather than stability),
   and verify that temp-0 actually is deterministic on Metal before relying on it.
4. **Judge model is `claude-opus-5`** ($5/$25 per MTok, verified 2026-08-13). Through
   the Batch API's flat 50% that is roughly $0.018 a judgment, about 550 judgments in
   $10. `claude-sonnet-5` carries introductory pricing of $2/$10 through 2026-08-31 if
   the budget is better spent on more scenarios than on judge quality.

### Notes

- Note: **`num_ctx: 4096` was a mistake and must not survive into Milestone 8.** A
  6,043-token JSON packet is silently truncated at that setting — no error, just a
  model answering from two-thirds of a packet. Size context to the payload; 8192 is
  the floor for JSON packets.
- Note: **reasoning models return an empty answer when `num_predict` is too small.**
  At 20 tokens Nemotron spent the entire budget on hidden reasoning and returned
  `response: ""`. A harness would record that as a zero-quality answer rather than a
  truncation. Measured: 91% of Nemotron's generated text was reasoning, and
  `eval_count` counts both.
- Note: **sampling defaults differ sharply between the runtimes.** MLX-LM defaults to
  temp 0.0 (greedy). Ollama ships no baked parameters for these models, so its own
  defaults apply — temp 0.8, top_p 0.9, top_k 40, repeat_penalty 1.1. Pin every
  parameter explicitly on both sides, or the comparison is a stochastic sampler
  against a deterministic one.
- Note: **reasoning is surfaced differently.** Ollama splits it into a `thinking`
  field; MLX leaves `<think>` inline in the text. Same model, same prompt, different
  text handed to the grader unless it is normalized — including the unterminated case,
  where the model runs out of budget mid-thought.
- Note: ~~`bench-gemma-4-e4b-q8` exists only as an Ollama blob~~ — **resolved by
  deleting it, along with `bench-qwen3-8b-q6`, on 2026-08-13.** The general lesson
  survives the specific case: deleting a model from LM Studio does **not** remove it
  from Ollama. The registration stays and its blob silently drops from link count 2 to
  1, converting a free hardlink into a private copy that is now the only surviving
  one. `ollama list` is the source of truth for what is registered; the LM Studio
  directory is not. Check link counts before assuming an import is still free.
- Note: **never run Ollama and MLX with models loaded at the same time.** That is the
  fastest route back into swap on 16GB.
- Note: **thinking tokens bill as output at $25/MTok on the judge.** Budget ~800
  output tokens a judgment, not 300. On `claude-opus-5` thinking is on by default —
  omitting the parameter runs adaptive — and `max_tokens` caps thinking plus response
  text together, so a tight cap truncates the verdict rather than the reasoning.
- Note: **the Batch API and prompt caching do not stack cleanly.** Parallel batch
  requests sharing a prefix all miss the cache. Take the flat 50% and treat any cache
  hit as a bonus.
- Note: **check `stop_reason` before reading `content` on the judge.** `claude-opus-5`
  can return `refusal` with an empty content array. Use `output_config.format` for the
  scores so there is no regex parsing and no retry loop.
- Note: the two helper scripts are at
  `/private/tmp/claude-502/-Users-jasonli-Desktop-PROJECTS-housing-intelligence/aae42b4b-a6d4-431f-a8a3-102664bf408b/scratchpad/`
  — `import_gguf.sh` (16 lines: `ollama create` from a Modelfile, then replace
  Ollama's copied blob with a hardlink to the LM Studio original) and `kvbench.sh`
  (35 lines: KV/quant measurement). **`/private/tmp` does not survive a reboot**, so
  copy them into the repo before anything else at Milestone 8.

### Open for Milestone 8

- [ ] Move `import_gguf.sh` and `kvbench.sh` into the repo (`scripts/`) before the
      scratchpad is cleared.
- [ ] Decide whether packets reach the models as JSON or as Markdown. The 3× token
      difference makes this a design decision, not a detail: JSON is the published
      contract (ARCHITECTURE #12, #43) and Markdown is already a rendering of it
      (#45), so both are available — but they are not interchangeable at 16GB.
- [ ] Add `ANTHROPIC_API_KEY` to `.env` and `.env.example`. It is the first key the
      platform needs that is not free.
- [x] ~~Confirm whether the Q8-vs-Q4 quantization axis is still in scope~~ — **it is
      not.** Resolved 2026-08-13 by deleting both higher-precision models. Milestone 8
      compares models and runtimes at a fixed 4-bit precision; quantization is a
      settled input, not a variable. Reopening it means re-downloading weights.

## Data sources worth adding

Reachability probed 2026-08-13; each line says what it would add and what it needs.

**No new key — the credential is already in `.env`**

- [ ] **HUD Fair Market Rents** — approved in SPEC, never fetched. **Verified working
      2026-08-13 with the token already in `.env`**: `/hudapi/public/fmr/data/3402199999
      ?year=2025` returns Mercer County efficiency $1,391 through four-bedroom $2,747,
      by bedroom count. Same adapter shape as income limits, five bedroom sizes per
      county per year. Would give a county rent benchmark where ZORI is sparse (293
      rent-to-income rows against price-to-income's 2,026) and let rent burden cite a
      published standard rather than a survey estimate. **The single highest-value
      gap**, and it needs nothing from the user.
- [ ] **HUD CHAS** — approved in SPEC, never fetched. Endpoint returns 200 with the
      existing token (probed 2026-08-13). Published cost-burden tables would replace
      `acs_renter_cost_burden`, which the platform currently derives from raw B25070
      columns.
- [ ] **ACS housing-stock tables** — same `CENSUS_API_KEY`, same adapter, more
      variables. **Verified 2026-08-13**: B25002 (vacancy), B25003 (tenure), B25024
      (units in structure) and B25034 (year built) all return NJ county data on the
      2023 5-year endpoint. Adding one is a `metrics.yml` entry and a column in the
      existing model, not new plumbing. Vacancy and tenure are the notable gaps — the
      warehouse has no ownership rate at all.
- [x] ~~BLS v2~~ — **already done.** `hip.sources.bls` selects `BASE_V2` whenever
      `BLS_API_KEY` is set, so the 20-year history and 500-query allowance are in use.
      The Milestone 3 note saying otherwise was stale; it is corrected in place.
- [ ] **FRED housing series** — same `FRED_API_KEY`. All four probed 200 on 2026-08-13:
      `NJSTHPI` (NJ house price index — would give the state a second, independent HPI
      against FHFA), `HOUST` (national housing starts), `RRVRUSQ156N` (rental vacancy),
      `MSPUS` (national median sale price). Each is a `sources.yml` line plus a
      `metric_id`; the adapter already handles multi-series pulls.

**No key at all**

- [ ] **Zillow's other cuts** — bottom-tier and top-tier ZHVI, SFR-only, new-construction
      sale price, days-to-pending, for-sale inventory. Same CSV host, same adapter,
      already anticipated: "adding one later is a `sources.yml` entry plus a `metric_id`,
      not a schema change."
- [ ] **Census Building Permits at place level** — currently county only, so the
      warehouse has no municipal construction signal at all. BPS publishes place-level
      annual files by region (`.../econ/bps/Place/Northeast Region/ne<yy>06y.txt`,
      confirmed 200 on 2026-08-13). Place codes are not MCD FIPS, so this needs a
      match — but MOD-IV has now supplied `region_identifiers`, which is exactly the
      kind of join that makes it tractable.
- [ ] **LEHD LODES** — jobs by workplace and residence per census block, which supports
      jobs-housing balance and commute-shed analysis. Large but static files.

**Needs a new free key**

- [ ] **NJ Parcels geometry (`njgin_parcels`)** — no key, but listed here because it is
      the one blocked item: the REST path Milestone 7 uses returns attributes only, and
      the geometry needed for a parcel map layer would be an enormous download.

- Note: **FMR and CHAS are the two SPEC-approved sources still unfetched.** Both were
  added to SPEC with explicit approval at Milestone 4 and neither has an adapter. They
  are the only gap between the Version 1 source list and what the warehouse holds.

## Parked / needs user input

- ~~Census, FRED, and BLS API keys~~ — all three supplied 2026-08-12 and in `.env`.
  They are in the chat transcript of that session, so rotate them if it is ever shared.
- ~~HUD USPS crosswalk token~~ — supplied and in use: 2,456 of 2,491 crosswalk rows are
  `hud_res_ratio`, and HUD income limits back `price_to_ami`.

- [ ] **`ANTHROPIC_API_KEY`** — needed by Milestone 8 for the Claude-graded rubric, and
  the first key the platform uses that is not free. Roughly $10 covers ~550 judgments
  on `claude-opus-5` through the Batch API. Nothing before Milestone 8 touches it.

**Nothing already built is blocked on user input.** Every key the pipeline currently
uses is present, and every source in the section above needs either no credential or one
already held. The one outstanding key is the Anthropic key above, which Milestone 8
needs and nothing else does.
