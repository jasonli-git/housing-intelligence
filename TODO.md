# Housing Intelligence Platform — TODO

Working list for the current milestone. Longer-horizon items live in
[ROADMAP.md](ROADMAP.md).

## Resume here — state as of 2026-09-10

Nothing in this section is in progress. It is the order agreed on 2026-09-10 for picking
the work back up, and what has to be true before starting. Detail lives in the items it
points to; this section only sequences them.

**Where things stand.** Milestones 12, 19, 20 and 22 are done. 12 and 19 are deployed and
verified live; 20 and 22 changed no published byte, so neither needs a deploy. The live
site carries data through July 2026 and five models' explanations of every county. The
preference list in `config/evaluation.yml` is `gemini-3.7-flash` →
`gemini-3.1-flash-lite` → `mistral-small-4` → `deepseek-v4-pro` → `gemma-4-e4b-q4`.

**The agreed sequence** — settled with the user on 2026-09-10; step 1 finished the same
day:

1. ✅ **Milestone 20 — reasoning effort as a measured variable.** Done 2026-09-10; see
   its section below. It configured `deepseek-flash-nothink` and `gemini-3.7-flash-low`
   for step 4.
2. **Milestone 21 — New Jersey depth.** The five sources in [ROADMAP.md](ROADMAP.md) row
   21, each sized under "Data sources worth adding". Before 13 because it adds metrics to
   every packet.
3. **Milestone 13 — citation binding.** Built and tested against the packet shape 21
   produces rather than retrofitted to it. Rework-avoidance, not a hard dependency: a
   binding generic over packet fields would mostly survive going first. Going first would
   not get it onto the live site any sooner either, because 21 marks all 105 published
   explanations stale and nothing new ships until step 5.
4. **A fresh benchmark, run `v3`.** Checklist below under "Run `v3`".
5. **Act on `v3`:** reorder the preference list, retire the old rows, regenerate every
   explanation, deploy. Checklist below under "After `v3`".
6. Then **18 → 16 → 17**, per [ROADMAP.md](ROADMAP.md).

**Before starting any of it:**

- **Docker has to be running for Postgres.** Start Docker Desktop, then `make db-up`. It
  was stopped at the start of the 2026-09-10 session, which is what a "connection
  refused" from `hip` means.
- **`make setup-eval`, never plain `make setup`, whenever the evaluation harness is
  needed.** `uv sync` makes the environment match exactly the groups named, so `make
  setup` silently uninstalls the `anthropic` SDK and the judge fails at submission
  ([Makefile:33](Makefile:33)). It happened on 2026-09-06 and cost nothing only because it
  fails before a batch is created.
- **Top up the Anthropic credit before step 4** — see "Parked / needs user input".

**Dates.** `deepseek-v4-pro` is routed to V4.1 Flash from 04:00 UTC on 2026-09-14. Nothing
needs doing: Milestone 22's probe makes it fall through on its own, and its 21 published
explanations were written by the real V4 Pro and stay correctly attributed until step 5.

### Run `v3` — the re-benchmark

- [ ] **A new run, not an extension of `v2`.** 21 changes every packet and `v2`'s scenarios
      are frozen from the old ones, so extending it would measure models against data
      the site no longer shows. `hip eval scenarios --run v3`, then
      `hip eval run --run v3 --model ...` once per candidate below
- [ ] **Candidates, seven or eight:** `gemini-3.7-flash`, `gemini-3.1-flash-lite`,
      `mistral-small-4`, `deepseek-flash`, `gemma-4-e4b-q4`, and Milestone 20's two
      lower-effort variants, `deepseek-flash-nothink` and `gemini-3.7-flash-low`.
      **Exclude**
      `deepseek-v4-flash` (already routed; the guard fails it) and `deepseek-v4-pro`
      (routed from 2026-09-14). **Consider dropping** `mistral-large-3`: last in `v2` at
      2.68, not on the preference list, and 15 fewer judgments
- [ ] **Decide how `v3` treats sampling for thinking models, before running it.**
      DeepSeek ignores temperature in thinking mode, so `deepseek-flash` against
      `deepseek-flash-nothink` varies sampling as well as thinking; and Google recommends
      temperature 1.0 for Gemini 3 where the harness pins 0.0. Either accept both and say
      so in the report, or change the design first — see the Milestone 20 notes
- [ ] **Quote before spending**: `hip eval cost --run v3` prices the run from its own
      prompts — a constant-based estimate was wrong twice. Expect roughly $5–6 for
      105–120 judgments, since 21's larger packets make every judge prompt larger
- [ ] `hip eval judge --run v3`, then `hip eval report --run v3`. Judge every candidate in
      one run: the judge prompt is shared, which is what keeps scores comparable

### After `v3`

- [ ] **Reorder `generation.preference` from the `v3` result**, still ending at the local
      model. DeepSeek's slot: if `deepseek-flash` passes, it replaces `deepseek-v4-pro`.
      If it scores *below* `gemma-4-e4b-q4`, decide whether DeepSeek stays on the list at
      all — its case has been jurisdictional diversity, and a hosted tier ranked above a
      better local one is backwards on quality. Precedent from `v2`: V4 Flash scored 2.76
      against Gemma's 2.90
- [ ] **Retire the rows of models that left the list.** `hip explain` never deletes
      explanations for a model that is no longer on the preference list, and
      `/regions/{id}/explanations` returns every stored row — so without this step the
      comparison would show V4 Pro *and* its replacement. There is no command for it yet:
      either a one-off `DELETE FROM region_explanations WHERE model_id =
      'deepseek-v4-pro'`, or, better, a `--prune` on `hip explain` that removes rows whose
      model has left the list. Found 2026-09-10 while planning this step; decide which
      when it comes up
- [ ] **Decide whether `hip explain --all` must require the benchmark** before the
      regeneration below runs it. Since Milestone 20 it checks each model's
      configuration against the latest run, but a model the run never measured still
      passes, as it always has — see the Milestone 20 note
- [ ] **Regenerate every explanation**: `hip explain --level county --all --force`. This
      rewrites all 21 counties for every model on the new list and refreshes their
      ranks. Well under $1 for the hosted models with `deepseek-flash` in V4 Pro's place,
      plus a ~10-minute local Gemma pass
- [ ] **`make publish`, then `make deploy`.** Verify in a browser, not with `curl`: both
      origins answer scripts with Cloudflare's bot challenge by design (ARCHITECTURE #94)

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

## Milestone 8 — Model evaluation and optional explanations

Deliverable: standardized housing scenarios built from real packets, a runner that puts
the same scenario through every candidate model, deterministic numeric checks, a
Claude-graded rubric, a published evaluation report naming the selected model and why,
and an explanation panel that is labeled as interpretation rather than measurement.

- [x] `config/evaluation.yml` — 8 candidates, 5 scenarios, 6 rubric criteria, pinned
      sampling for both runtimes, judge settings. Validated by `hip check-config`
- [x] `hip.eval.scenarios` — questions x an evenly-spaced packet sample; deterministic,
      so two runs grade the same questions without a recorded seed
- [x] `hip.eval.prompts` — packet → JSON or Markdown payload, prompt assembly, and a
      context check that refuses to let a runtime truncate a packet silently
- [x] `hip.eval.runners` — `ModelRunner` protocol (ARCHITECTURE #57) over Ollama and
      MLX-LM, each normalizing its own telemetry and declaring what it cannot report
- [x] `hip.eval.normalize` — reasoning/answer split across both runtimes, including the
      unterminated `<think>` case
- [x] `hip.eval.checks` — deterministic numeric verification (#58)
- [x] `hip.eval.judge` — rubric grading via the Batch API, structured output, cost
      estimate before spending
- [x] `hip.eval.store` — JSONL per stage; a run is resumable and a partial run reports
- [x] `hip.eval.report` — anchors first, deterministic table, then rubric scores
- [x] `hip.eval.explain` — explanations from the selected model, written by CLI
- [x] Migration `0007` — `region_explanations`, applied
- [x] `GET /regions/{id}/explanation` and the dashboard panel (#60)
- [x] `hip eval scenarios | run | check | judge | report | models | show | cost` and
      `hip explain`; `make setup-eval` and `make eval`
- [x] Tests — 68 harness tests, 7 endpoint tests, 3 for `.env` loading, module
      boundary extended to `eval`
- [x] **The full generation run** — 120 generations, 105 usable. Completed
      2026-08-14 after three harness bugs were found and fixed mid-run (below)
- [x] `.env` is loaded into the process environment (ARCHITECTURE #63)
- [x] **The judged report** — batch `msgbatch_01G2u9KT2weSd1vnG5ZXfApH`, 105 of 105
      graded, `reports/evaluation/v1.md`. **Gemma 4 E4B selected**: 3.21/4.00 weighted,
      0.0% unsupported figures, 3/3 correct refusals, 28.6 tok/s
- [x] `hip explain` over the 21 counties, written by the selected model and served at
      `/regions/{id}/explanation`
- [ ] Move `import_gguf.sh` and `kvbench.sh` into the repo — still outstanding from the
      prep work, and `import_gguf.sh` is now known to produce passthrough templates
      (ARCHITECTURE #62), so it needs the template fix before it is committed

- Note: **the numeric checker had a false-positive bug that would have published a wrong
  headline number.** `2019-12-31` was decomposed by the number regex into 2019, -12, and
  -31, so every correctly-cited window counted as three fabricated figures. Measured on
  a real run: it reported 33/148 figures unsupported for gemma-4-E4B; the true figure
  after fixing dates, packet-verbatim matches, and question echoes is 0/74. Two related
  false positives went with it — a number inside a metric *name* ("Renters paying over
  30% of income") and a year echoed from the question while correctly declining.
  Regression tests hold all four cases.
- Note: **checks are computed as each generation lands, not in a pass at the end.** The
  first design batched them after the run loop, so the 10-minute timeout that surfaced
  the bug above also lost every check for 13 expensive generations. `hip eval check`
  backfills idempotently for runs recorded before a checker change, and `--restart` now
  clears `checks.jsonl` alongside `generations.jsonl` — leaving it behind would mix two
  configs' results in one file, which is usually the thing a restart is correcting.
- Note: **the output budget truncated reasoning models specifically, and the first full
  run had to be discarded because of it.** At `max_output_tokens: 1600` Qwen3-8B wrote
  5,747 characters of reasoning, hit the cap, and returned an empty answer with
  `finish_reason: length`. Non-reasoning models were unaffected, so grading the empty
  answer as a zero would have biased the comparison against exactly the models the
  reasoning-normalization work exists to handle fairly. Raised to 3000 — about twice the
  largest observed trace — and the run restarted so every model faces one budget.
- Note: **`uv sync` removes packages from groups it is not told about.** `make setup`
  (dev + dbt) silently uninstalls `mlx-lm` and `anthropic`; `make setup-eval` installs
  all four groups. Found by running the two in sequence.
- Note: **generation is far slower than the prep measurements suggested.** Those were
  short prompts; a real scenario carries a ~1,500-token packet and asks for a paragraph.
  gemma-4-E4B averages 42s, Qwen3-8B about 2.5 minutes. A 120-generation run is hours,
  which is why the store appends and the runner resumes.
- Note: **Markdown payloads are ~1,500 tokens against JSON's ~6,000 for the same
  county.** The evaluation now measures whether that costs quality; `hip explain`
  defaults to Markdown on the assumption it does not, which the run can overturn.
- Note: the judge is the only paid dependency, and `ANTHROPIC_API_KEY` was supplied in
  chat on 2026-08-13. **It is in that transcript — rotate it if the conversation is
  shared.** Same caveat as the Census/FRED/BLS keys.
- Note: **neither runtime was applying the models' instruct formatting, and neither
  said so** (ARCHITECTURE #62). MLX-LM's `stream_generate` takes a raw string and does
  not template it; Ollama models imported with a bare `FROM` get
  `TEMPLATE {{ .Prompt }}`. Untemplated, a model never emits its end-of-turn token.
  Caught by the Qwen3-8B anchor pair, which is the entire reason the anchors exist: the
  same model at the same precision reported 89 stated figures on one runtime and 1,461
  on the other, with 3/3 correct refusals against 0/3. Without the pair this would have
  been published as "Ollama beats MLX".
- Note: **`/api/chat` is not cosmetic for thinking models.** `gemma-4-12b` returned an
  empty string from `/api/generate` for *every* prompt including "Reply with exactly:
  OK", while consuming the whole token budget — its output goes to a reasoning channel
  the raw path never populates. On `/api/chat` the same call returns 17,458 characters
  of reasoning. Verified byte-identical on a non-thinking model (gemma-4-E4B: same 819
  tokens, same text) before switching, so the change is safe for the whole cohort.
- Note: **the first judging batch failed 105 for 105** on
  `output_config.format.schema: For 'number' type, properties maximum, minimum are not
  supported`. Structured outputs reject numeric range constraints, and the rejection is
  per-request at submission, not at schema build. Scores are an enum now. Nothing was
  billed — validation failures never reach inference — but the harness recorded only
  the result *type*, so diagnosing it needed a separate script against the batch
  endpoint. `collect_batch` now carries the API's message through.
- Note: **the measured "natural peak" of a model can be an artifact of a broken read
  path.** gemma-4-12b appeared to peak at 2,785 tokens, which is what justified raising
  the budget to 6,000. That figure was the visible fragment of a thinking model whose
  reasoning was being discarded; its real requirement exceeds 6,000. The raise was still
  correct — 9 of 15 scenarios now stop cleanly against 7 before — but the reasoning
  behind it was wrong, and a number measured through an unverified path is not evidence.
- Note: three candidates are **not viable on this machine** and the report says so
  rather than scoring them as merely poor: `gemma-4-e4b-mlx` cannot be loaded by
  mlx-lm 0.31.3 at all, and `phi-4-mini-mlx` and `qwen35-9b-mlx` fail to terminate at
  twice the token budget.
- Note: **the anchor gap came out small, which is the result that licenses the
  leaderboard.** Qwen3-8B scored 3.05 on Ollama against 2.91 on MLX — 0.14 on a 4-point
  scale, against a 3.21-to-1.34 spread across the field. Runtime is therefore not what
  separates the models, and the cross-cohort ranking can be read as a model comparison.
  Had the gap been large the report would have had to stop at two separate tables.
- Note: **the deterministic gate never had to fire.** Every model that was judged came
  in under the 5% fabrication bar, so the winner was decided on rubric score alone. The
  gate is still what makes the ordering safe to state — it just did not bind this time,
  and that is worth knowing before anyone concludes it is decorative.
- Note: **the API tests were deleting real explanations.**
  `tests/test_api_explanations.py` picks the top-ranked county and deletes its row to
  exercise the 404 path, against the developer's actual warehouse. Running `make test`
  after `hip explain` destroyed Atlantic County's explanation, and it surfaced only
  because a count came back 20 against an expected 21 — nothing failed. An autouse
  fixture now snapshots and restores the row, `generated_at` included. Any test that
  writes to a real warehouse needs this treatment; the other API suites are read-only,
  which is why the problem had not appeared before.
- Note: **`completeness` and `caveat_handling` are the weakest criteria across every
  model** (2.1 and 2.5 even for the winner, against 3.8 for factual accuracy). Local
  models quote the packet accurately and then omit half of what it supports. That is the
  finding most likely to shape the explanation prompt, and it is why `hip explain` asks
  for a narrative rather than answers to questions.

## Milestone 10 — Build cost and data placement

Next up; not started. Decomposed here because it is the current milestone. Milestones 11
through 18 stay in [ROADMAP.md](ROADMAP.md) at deliverable granularity until each one
starts — two half-decomposed plans in two files is how they drift apart.

Measurement first; the tasks are ordered the way they should be built.

Revised 2026-09-01, after reading the repository: `mac-sitrep` already measures wall
clock, CPU, peak RAM, disk I/O, and swap for `make pipeline` and `make test`, and
generates the README's Resource Requirements block. This milestone reuses it rather than
building a second timing harness, and adds only the two things it cannot answer.

- [x] Seven per-stage scenarios in `.sitrep/project.json`, so the existing tool reports
      which stage dominates instead of only the eight together. `acquire` excluded: it
      returns cached releases without touching the network, so profiling it measures a
      hash check rather than a download
- [x] `hip footprint` — bytes per storage tier, per warehouse table, and per state, plus
      the Postgres size, with `--json`. Degrades to the filesystem half when Postgres is
      unreachable
- [x] `hip footprint` captured for New Jersey and published in the README as a Storage
      Footprint section beside the sitrep block, not inside it
- [x] `reports_dir` promoted to its own setting (`HIP_REPORTS_DIR`), defaulting to the
      repo root. A test asserts the default equals the expression it replaced
- [x] `HIP_DATA_DIR` honored end to end, with `~` expanded on all three path settings
- [x] Postgres relocatable through `HIP_PGDATA`, defaulting to the existing `pgdata`
      named volume so nothing already loaded is disturbed. Both branches verified with
      `docker compose config`
- [x] `.env.example` documents all three paths; `make setup` delegates to a new
      `make data-dirs` that asks the config rather than hardcoding `data/`

- Note: **The README's 22-second pipeline figure is a warm run.** `hip acquire` returns
  cached releases without touching the network unless `--force`
  ([src/hip/sources/base.py:170](src/hip/sources/base.py:170)), so the measured run
  re-processes 2GB that was already on disk and downloads nothing. The number is correct
  and answers a different question than Milestone 14 needs: adding a state means
  actually fetching its TIGER layers. Cold-run cost has never been measured, and the
  README should say which of the two it is reporting.
- Note: **The trigger is measurement, not disk pressure.** An earlier version of this
  section said disk was the driver. That was overstated and is corrected here. `data/`
  is 2.9GB against 32GB free, and the two largest items in it do not grow when states
  are added: `data/raw/nj_modiv` is 1.1GB and is NJ-only, and 529MB of the TIGER
  download is the national ZCTA layer. Docker's disk image holds another 2.2GB for
  Postgres and does grow. The Northeast adds roughly 3 to 6GB all in. **No Version 2
  milestone as scoped needs an external volume** — Milestone 15 stops at county level,
  which is where large national geometry would have been.
- Note: **What actually justifies doing this before Milestone 14** is that nobody knows
  what one state costs in time or bytes, because only RAM was ever recorded. Measuring
  one state is cheap. Measuring it after committing to eight is too late for the number
  to change any decision.
- Note: **If an external volume is used later, format it APFS, not exFAT.** DuckDB and
  Postgres on exFAT get no sparse files, poor metadata performance, and unreliable
  locking. Thunderbolt or USB4 rather than USB 3.0 — `hip stage` does out-of-core work
  against the Parquet tier and is the stage that would feel a slow bus. Losing the
  volume costs a re-download and nothing else: `data/` is rebuildable by design
  (ARCHITECTURE #10), so it never needs to be backed up.

- Note: **The milestone was re-scoped on 2026-09-01 after reading the repository.** It
  was planned as per-stage timing plus disk relocation. Both premises were wrong:
  `mac-sitrep` already measures time, CPU, RAM, and I/O, so a second harness would have
  put rival numbers in one README; and the disk argument did not survive measurement,
  since NJ MOD-IV (1.1GB) and the national ZCTA layer (529MB) do not grow when states
  are added. What survived was a real path defect and a real measurement gap. The
  roadmap row now describes what shipped rather than what was planned.
- Note: **`make pipeline` dirties 21 tracked files on every run.** `analyze` writes a
  new `hip_derived` source release stamped with the run time, so each region report's
  provenance table changes even when no number moves. Correct but noisy; making the
  derived vintage stable would be a behaviour change and was out of scope here.
- Note: **Cold-run cost is still unmeasured**, and it is the number Milestone 14
  actually needs for the download half. `hip acquire --force` against one state would
  produce it. Not done here because forcing a re-download of all 2GB to measure it is a
  poor trade while the answer only matters at expansion time.

## Milestone 11 — Static publication

Started 2026-09-02. Scope settled with the user before any code: **all 1,135 regions
that carry observations, at the 5y window only.** That is 21 counties, 564
municipalities, 548 ZIPs, the state, and the nation row; the 2,181 tracts are in the
spine but have no observations at all, so pages for them would be empty.

- [x] `hip publish` renders the enumerable API surface to a directory tree whose paths
      match the API's own, so `/regions/11/packet` is a file at the same path it is an
      endpoint
- [x] Window becomes a path segment (`/regions/11/summary/5y.json`) rather than a query
      string, because a static file cannot vary on `?window=`. Chosen over implying 5y
      in the path so that publishing a second window later adds files instead of moving
      every existing URL
- [x] A manifest listing every published artifact with its sha256, for drift detection
- [x] Dashboard built as a static export, with `generateStaticParams` over the same
      1,135 regions
- [ ] `make publish` assembling both halves into one directory
- [x] Tests: path mapping, manifest integrity, and that a published artifact is
      byte-identical to the live API response for the same path

- Note: **The publish gate earned itself on the first run.** `/rankings` returned 422
  for every value ranking, because `region_rankings` stores those under the sentinel
  window `latest` while the endpoint's `Window` literal has no such member and
  `basis=value` ignores the parameter outright. Feeding storage vocabulary back as API
  vocabulary is the kind of thing that would have shipped as 47 missing files. The
  request now omits the window for value rankings while the path keeps it, and
  `test_value_rankings_omit_the_window_from_the_request_but_keep_it_in_the_path` pins it.
- Note: **Measured output, 2026-09-02:** 5,844 artifacts, 83.7MB, 1,114 skipped 404s —
  exactly the 1,135 regions minus the 21 that have an explanation. Comfortably inside
  Cloudflare Pages' ~20,000-file cap, which leaves room for the static export's own
  output.
- Note: **Open design question for the dashboard half.** `generateStaticParams` has to
  learn which 1,135 regions to render. Reading `manifest.json` would guarantee the HTML
  pages and the JSON artifacts describe the same regions, but it couples the web build
  to a filesystem artifact where today the dashboard only ever talks HTTP. Fetching from
  the API instead keeps that boundary but has no "regions with data" query to ask —
  `/regions` includes the 2,181 empty tracts. Not yet decided.

- [x] `has_data` on `/regions`, so the build can ask over HTTP which regions carry an
      observation instead of reading `hip publish`'s output or rendering 2,181 blank
      tract pages. Partitions the spine exactly: 1,135 with data, 2,231 without
- Note: **The static export found a real API defect on its first run** (#69). Six
  parallel workers exhausted a connection pool nobody had ever sized — SQLAlchemy's
  default 5 plus 10 overflow — and the API stopped answering `/health` entirely. The
  build failed at 1,641 of 2,273 pages with 60-second render timeouts. Sized to 20 plus
  20; the rebuild completed with zero failures. Worth recording because the cause was
  not the export: the API had simply never had a concurrent client, and a public
  deployment would have been the alternative discoverer.
- Note: **Measured export output: 11,375 files, 261MB, for 1,135 regions.** One HTML
  plus four RSC payload files per page, and every page embeds its own data. That is
  roughly triple the artifact tree it displays (5,844 files, 84MB), and it is the half
  that hits a host's file-count cap first — at Northeast scale, not national.
  **Superseded 2026-09-06: 13,647 files, 316MB, against 5,846 artifacts at 96MB.** The
  footer added in 0.11.1 put a fifth RSC payload on every route. The conclusion is
  unchanged and the margin is smaller: nine states project to roughly 123,000 export
  files against a 100,000-file paid ceiling, where the original figures projected
  102,000.
- Note: **An unset `NEXT_PUBLIC_ARTIFACT_URL` bakes `localhost` into 1,135 download
  links.** A static export has no runtime to correct it. The build now warns rather than
  throwing, because building locally against `make api` is how the export gets checked
  at all — but a deploy without that variable ships dead links silently.

- Note: **Two claims in the roadmap's Milestone 11 row were wrong and are corrected
  here.** "Every API response" is not achievable — `/compare?region_ids=` is
  combinatorial and `/regions?q=` is free-text search, so neither enumerates. Both are
  omitted, recorded as a limitation, with DuckDB-WASM over published Parquet named as
  the seam where they would return. And "content-addressed manifest" was the wrong
  instinct: content-addressing the artifact URLs would break the property that makes
  this worth doing, which is that the API's paths keep working as static files. The
  manifest carries hashes; the URLs stay stable.
- Note: **The published artifacts are produced by replaying the API's own ASGI app**
  rather than by re-querying the warehouse. It is the only way the bytes on disk are
  the same bytes the API serves — response models, serialisation, and rounding all
  included — instead of a second implementation that drifts. This required a narrow
  exception to `tests/test_module_boundaries.py`, which enforced that *nothing* imports
  `api`. The exception is bounded and itself enforced: exactly one module may do it,
  and the test fails if a second one appears.
- Note: **`make publish` cannot be finished in this milestone.** Its done criterion is a
  reachable public URL, and the domain and hosting account are still parked. Everything
  up to and including a complete local artifact tree is in scope; the deploy step is
  written but unverified until those exist.

## Pre-Milestone-12 review — 2026-09-06

A full read of the codebase before Milestone 12 opens. Five defects were found and
fixed the same day; they are recorded in [CHANGELOG.md](CHANGELOG.md) 0.11.2 and as
ARCHITECTURE #73 through #77. What follows is everything else the review turned up and
deliberately did not act on, so that none of it has to be found twice.

### Things Milestone 12 will collide with

Not defects today. Each becomes one the moment a hosted runner exists, and each is
cheaper to handle while the milestone is being designed than after.

- [ ] **A single transient error disqualifies a candidate model.**
      `select_winner` requires `summary.errors == 0`
      ([src/hip/eval/report.py:193](src/hip/eval/report.py:193)). That was right for
      local runtimes, where an error means the model genuinely could not run — it is
      how `gemma-4-e4b-mlx` was excluded. One HTTP 429 from a hosted provider would
      disqualify an otherwise winning model on the same rule. The hosted runner needs
      retry with backoff, and this gate should become a *rate* with a stated threshold,
      the way the 5% fabrication bar already is (#59).
- [ ] **Cohort names are hardcoded inside the runners.** `cohort="gguf"` in
      [ollama.py](src/hip/eval/runners/ollama.py) and `cohort="mlx"` in
      [mlx_runner.py](src/hip/eval/runners/mlx_runner.py), in both the success and the
      failure paths. Three hosted providers behind one `HostedRunner` cannot each be
      their own cohort under that scheme. The cohort should be passed in from config,
      and `Cohort.runner`'s `Literal` has to gain the new value.
- [ ] **Two strings say the explanation layer is local.** The judge's system prompt
      ([judge.py:47](src/hip/eval/judge.py:47)) and the API disclaimer
      ([explanations.py:31](src/hip/api/routers/explanations.py:31)). The disclaimer is
      a straight edit. The judge prompt is not: changing it changes scores, so hosted
      candidates cannot be compared against the stored `v1` judgments. Re-judge Gemma
      4 E4B in the same batch as the hosted candidates and compare within that batch.
- [ ] **`hip explain` has no staleness gate.** `is_stale`
      ([explain.py:192](src/hip/eval/explain.py:192)) exists and is used only by the
      API; `explain_command` regenerates every region unconditionally. Harmless at 21
      counties and three local minutes, and the whole cost argument for hosted
      inference at national scale. #73 had to land first — before it, the gate would
      have answered "stale" for every region on every run.
- [ ] **"The most recent evaluation run" is chosen lexically.** `runs()` sorts directory
      names ([store.py:102](src/hip/eval/store.py:102)), so `v10` sorts before `v2` and
      `hip explain` would silently pick the older run's winner. Either name the
      Milestone 12 run so it sorts after `v1`, or sort by modification time.

### Lower-priority findings, not acted on

- [ ] **A missing Census permits year aborts the whole `hip acquire`.** The adapter
      docstring says a year whose file does not exist yet "fails its own fetch and
      leaves the others alone" ([census_permits.py:38](src/hip/sources/census_permits.py:38)),
      but `fetch_all` is a plain generator with no per-ref exception handling, so the
      `SourceError` propagates and takes every remaining source with it. Dormant until
      `default_vintage` is bumped ahead of publication. Either make the docstring true
      by catching per ref, or correct the docstring — the current pairing is the worst
      of the two, because it invites someone to rely on behaviour that is not there.
- [ ] **New Jersey is hardcoded in three places**, despite `config/geography.yml`
      stating that no state code is hard-coded anywhere in `src/hip`. NJ's odd-numbered
      county FIPS in [registry.py:73](src/hip/sources/registry.py:73), which is a real
      arithmetic assumption about one state and not a constant; and `?state=NJ` in both
      [publish.py:197](src/hip/publish.py:197) and
      [web/lib/api.ts:245](web/lib/api.ts:245). Blocks Milestone 14, not 12.
- [ ] **The validation gate has no range bounds for the two HUD metrics.**
      `hud_area_median_income` and `hud_income_limit_80` are absent from `VALUE_BOUNDS`
      ([gate.py](src/hip/validate/gate.py)), so the one metric family that feeds
      `price_to_ami` passes the gate unchecked. Every other loaded metric has bounds.
- [ ] **Two published limits have no headroom for Milestone 15.**
      `/regions/{id}/metrics` is published at its default `limit=5000` with nothing in
      the response saying whether it truncated; the largest region carries 760
      observations today, so this is a watch item rather than a fault. `/rankings` caps
      at 1,000, which is below the 3,144 counties Milestone 15 adds — a national
      ranking would be silently cut off at rank 1,000.
- [ ] **`python-dotenv` is imported but not declared.** `load_env_file`
      ([config.py](src/hip/config.py)) imports it directly and it reaches the
      environment only as a transitive dependency of `pydantic-settings`. It has been
      load-bearing since #63; a resolver change that drops it breaks `hip` at startup.
      One line in `pyproject.toml`.
- [ ] **`GET /regions?q=` passes `%` and `_` through to `ILIKE`.** A caller searching
      for `%` matches every region. Cosmetic today and worth settling before Milestone
      17 builds a real search over this endpoint.
- [x] **Both public origins answer a programmatic client with an HTTP 403 challenge**
      — investigated and **settled as intended behaviour** on 2026-09-06, not fixed.
      See ARCHITECTURE #94. The short version: the JSON tree is a build artifact rather
      than a product, so the challenge costs nothing that is currently wanted and the
      friction is aligned with Zillow's non-commercial licence. Reopen this only by
      changing that premise, not by treating the 403 as a defect.

### Cleanup the fixes do not perform

- [ ] **32 manifests and their files under `data/raw/` still contain live API keys.**
      #76 stops new ones being written; it deliberately does not rewrite the immutable
      content-addressed tree that already exists. `data/` is gitignored and nothing
      published ever carried a key, so this is local hygiene rather than exposure — but
      the keys are also in an August chat transcript, which is the stronger reason to
      rotate. To clear the tree, delete the three sources and re-acquire:

      ```
      rm -rf data/raw/census_acs data/raw/fred data/raw/bls
      uv run hip acquire -s census_acs && uv run hip acquire -s fred && uv run hip acquire -s bls
      ```

      `--force` alone is not enough: identical bytes hash to the same directory, so the
      old key-named file would be left beside the new one.
- [ ] **The 21 stored explanations are stale and stay stale until regenerated.** They
      were written on 2026-08-14 and the numbers have genuinely moved since, so the
      flag is now correct rather than spurious. Regenerating needs Ollama and Gemma 4
      E4B resident, which is a Milestone 12 decision — a hosted runner would do it
      concurrently and is the reason that milestone exists.
- [x] **`dist/` rebuilt** (2026-09-06). `make publish` and `make check-dist` both pass,
      and the fixes are present in the tree: `sources.json` reports real row counts,
      packets carry the content-addressed derived vintage, and a grep over the whole
      tree finds no credential. Not deployed. The 21 explanations are still flagged
      stale, which is now correct rather than spurious — they were written on
      2026-08-14 and the numbers have genuinely moved since.

## Milestone 12 — Hosted inference

Started 2026-09-06. Two scope decisions settled with the user before any code was
written:

- **Concurrent submission now; vendor batch deferred to Milestone 15.** Roadmap row 12
  says "batch submission", but the milestone's own argument is wall-clock concurrency,
  and the two point at different architectures. Bounded parallel requests against the
  normal synchronous endpoints finish 21 counties in seconds and behave identically at
  every tier of the preference list. Vendor batch APIs are roughly half price and
  asynchronous, and DeepSeek has no equivalent — so adopting them now would make tier 1
  behave differently from tiers 2 and 3 while discarding the concurrency that justifies
  the milestone. The 50% discount starts mattering at Milestone 15's 3,144 counties;
  the seam is recorded in [ARCHITECTURE.md](ARCHITECTURE.md), not built.
- **Both a cheap and a mid tier per provider.** Six hosted candidates rather than three.
  Milestone 8's central finding was that capability does not predict quality on this
  task — Gemma 4 E4B scored 3.21 against Gemma 4 12B's 2.10 — so picking a tier by
  assumption is exactly the reasoning that finding disproved. Six candidates is also
  the only slate that produces a real quality-per-dollar column rather than a
  price column beside a single measurement.

### Candidate slate

Chosen on price and jurisdiction, ranked by the benchmark, never the reverse
([SPEC.md](SPEC.md) principle 9). Gemini rates are from Google's own pricing page and
are firm; DeepSeek and Mistral rates come from secondary sources and are provisional
until verified against each provider's live pricing — see the first task below.

| Provider | Tier | Model ID | $/MTok in | $/MTok out |
|---|---|---|---|---|
| DeepSeek | cheap | `deepseek-v4-flash` | 0.22 off-peak / 0.44 peak | 0.66 / 1.32 |
| DeepSeek | mid | `deepseek-v4-pro` | 0.66 / 1.32 | 1.98 / 3.96 |
| Gemini | cheap | `gemini-2.5-flash-lite` | 0.10 | 0.40 |
| Gemini | mid | `gemini-3.7-flash` | 0.75 | 3.75 |
| Mistral | cheap | Mistral Small 4, dated snapshot | 0.15 | 0.60 |
| Mistral | mid | Mistral Large 3, dated snapshot | 0.50 | 1.50 |

Gemma 4 E4B is re-judged in the same batch. Its stored `v1` scores stop being
comparable the moment the judge's system prompt loses the word "local" (see the
pre-milestone review above), so the baseline is re-measured rather than carried over.
Seven models × 15 scenarios = 105 judgments, ~$3.31–4.62 at the measured prompt size.

**Rejected candidates, recorded so they are not re-proposed:**

- **`gemini-3.8-flash`** — same list price as 3.7 Flash, but it generates roughly 30%
  more output tokens and takes more agentic turns, so the same task costs about 40%
  more. Google's own guidance points efficiency-first workloads at 3.7. This workload is
  single-turn, short-prose, and the rubric's clarity criterion states that length is not
  a virtue, so 3.8's extra deliberation is a liability here rather than a feature.
- **`gemini-3-flash-preview` and `gemini-3.1-pro-preview`** — a `-preview` identifier is
  a moving target, which is the one thing [SPEC.md](SPEC.md) forbids for a hosted pin
  (principle: pinned versions, never aliases, because a repointed alias changes
  published prose silently). Benchmarking them would spend judge dollars producing a
  score for a model that can never enter the preference list.
- **`gemini-3.1-flash-lite` and `gemini-3.5-flash-lite`** — they sit between the two
  Gemini candidates chosen. Testing three Lite variants measures Google's version
  increments rather than the price-versus-quality question the slate exists to answer.
  2.5 Flash-Lite is the price floor across all three providers and 3.7 Flash is the
  efficiency-first Flash, which is the widest spread Gemini offers: 7.5× on input,
  9.4× on output.
- **Gemma 4 26B A4B / 31B on the Gemini API** — free tier only, with no paid path.
  That means Google's training terms apply to the prompts, the free tier's rate limits
  apply to the requests, and neither is compatible with a preference-list tier whose
  whole purpose is concurrency. Genuinely interesting as a benchmark — it would extend
  Milestone 8's within-family curve past E4B and 12B — but it cannot ship, so it does
  not earn judge dollars from a balance that has room for roughly one re-run. Worth
  running on its own if the budget is topped up.

### Version pinning is not equally achievable across the three

[SPEC.md](SPEC.md) requires hosted identifiers pinned to explicit versions rather than
moving aliases. The three providers support that to different degrees, and the
difference is worth recording because it weakens the roadmap's DeepSeek-first ordering:

- **Mistral pins cleanly.** Dated snapshots (`<model>-<YYMM>`) are addressable, and a
  retired snapshot returns an error — a loud failure that falls through, which is
  exactly the behaviour the SPEC asks for.
- **Gemini's IDs are stable but undated.** `gemini-2.5-flash-lite` is not a `-latest`
  alias, but neither is it a checkpoint.
- **DeepSeek rolls checkpoints behind its ID.** `deepseek-v4-flash` moved to a
  V4-Flash-0731 checkpoint on 2026-07-31 and `deepseek-v4-pro` to V4-Pro-0813 on
  2026-08-13, without the ID changing. Whether an addressable pinned checkpoint exists
  needs checking against the live API. If it does not, tier 1 of the preference list is
  the one tier that can change its output silently, and that is an argument for
  reordering rather than a detail.

DeepSeek also prices by time of day (off-peak roughly 16:30–00:30 UTC), so a published
cost column has to state which rate it used or it is not reproducible.

### Tasks

- [x] Verify every model ID and token rate against each provider's live API and
      pricing page. Done 2026-09-06: all six refs confirmed served and callable, all
      six rates confirmed from the providers' own pricing pages. Nothing in the table above was measured here, and a
      published quality-per-dollar column must not carry a number taken from a blog.
      `hip eval models` now does this for a hosted cohort: it asks the provider what it
      serves and marks a ref `-` when the pin is withdrawn or misspelled. It needs a
      key to answer, which is the only reason this row is not checked off
- [x] `Cohort.runner` gains `hosted`; `Cohort` gains the provider dialect, the API key
      environment variable, and the endpoint. `CandidateModel` gains input and output
      token rates, so cost is per candidate rather than per provider
- [x] Cohort name passed in from config rather than hardcoded in each runner
      (`cohort="gguf"` in [ollama.py](src/hip/eval/runners/ollama.py), `cohort="mlx"` in
      [mlx_runner.py](src/hip/eval/runners/mlx_runner.py), in both the success and
      failure paths). Three providers cannot each be their own cohort until this moves
- [x] `HostedRunner` implementing `ModelRunner`, over `httpx` with a per-provider
      adapter for auth, endpoint, and response shape — no vendor SDKs, matching how
      `OllamaRunner` already talks to its runtime. Normalizes each provider's usage
      counters into `Telemetry`, and is honest about what a hosted API cannot report:
      `peak_memory_mb` and `load_ms` stay null, and `memory_basis` gains no third value
- [x] Retry with exponential backoff on 429 and 5xx, because without it a single
      transient error disqualifies a candidate under the next item
- [x] `select_winner`'s `summary.errors == 0` gate becomes an error *rate* with a
      stated threshold, the way the 5% fabrication bar already is
      ([report.py:193](src/hip/eval/report.py:193)). The absolute gate was right for
      local runtimes, where an error means the model genuinely could not run; one HTTP
      429 must not disqualify an otherwise winning hosted model
- [x] Bounded-concurrency submission for the evaluation run and the regeneration pass.
      [runner.py](src/hip/eval/runner.py) is strictly sequential for a memory reason
      that does not apply to a hosted cohort, so the sequential path stays for local
      cohorts and concurrency is a property of the runner rather than of the loop
- [x] The two strings that say the explanation layer is local: the judge's system prompt
      ([judge.py:47](src/hip/eval/judge.py:47)) and the API disclaimer
      ([explanations.py:31](src/hip/api/routers/explanations.py:31))
- [x] Ordered preference list resolved at generation time — DeepSeek, then Gemini, then
      Mistral, then local Gemma 4 E4B last — with eligibility enforced against the
      benchmark: a model that has not passed the evaluation cannot enter the list. The
      resolved model is already recorded per row by `region_explanations.model_id`
- [x] `runs()` orders lexically ([store.py:102](src/hip/eval/store.py:102)), so `v10`
      would sort before `v2` and `hip explain` would silently pick the older run's
      winner. Sort by modification time
- [x] `hip explain` gains the staleness gate it never had. `is_stale`
      ([explain.py:192](src/hip/eval/explain.py:192)) exists and is used only by the
      API; `explain_command` regenerates every region unconditionally. Harmless at 21
      counties and three local minutes, and the whole cost argument at national scale
- [x] Measure how many regions a real monthly refresh actually marks stale **before**
      deciding how much precision to discard. [ROADMAP.md](ROADMAP.md) is explicit that
      display-precision hashing is now an optimisation with a baseline rather than a
      workaround for the defect that #73 and #77 fixed, so the measurement comes first
      and the rounding rule follows from it
- [x] Quality-per-dollar column in the evaluation report, from the per-candidate rates
      and the recorded token counts
- [x] Regenerate the 21 stale NJ explanations with the selected model
- [x] Tests: the hosted runner against a mocked transport, retry and backoff behaviour,
      preference-list fallthrough including exhaustion to the local tier, eligibility
      rejection of an unbenchmarked model, cohort-from-config for all three runners, the
      error-rate gate, and run ordering past `v9`

- [ ] **`hip acquire` never re-checks a `@current` ref, found 2026-09-06.** `fetch`
      ([base.py:200](src/hip/sources/base.py:200)) short-circuits on a local index keyed
      by `ref.key` and returns "without touching the network", so once a ref is cached
      it is never re-fetched. That is correct for a dated vintage, which is immutable by
      definition, and wrong for the refs whose vintage is literally `current` — Zillow
      replaces those files monthly at a stable URL. Measured: a full `make pipeline` on
      2026-09-06 reported 172 cached and 0 downloaded, ran all eight stages, and
      recomputed from bytes fetched on 2026-08-11, while a `HEAD` against Zillow's own
      URL reported `Last-Modified: Sun, 16 Aug 2026`. The pipeline is silently a no-op
      for new data, which is most of what someone running it expects it to do.
      `--force` is the documented refresh path meanwhile, and it re-downloads all 172
      releases rather than the seven that moved — which is not merely wasteful. On
      2026-09-06 it earned a `429 Too Many Requests` from HUD partway through, because
      HUD's income limits are one API call per county per year and re-fetching all of
      them in a burst is exactly the shape of request a public API throttles. That
      aborted the whole run under `set -e` after Zillow and FHFA had already succeeded,
      which is the **"a missing Census permits year aborts the whole `hip acquire`"**
      finding above, demonstrated: `fetch_all` is a plain generator with no per-ref
      exception handling, so one source's transient failure takes every remaining
      source with it. Recovery was a plain `hip acquire`, which skipped the 125 already
      cached and completed — the per-release index write makes the stage resumable even
      though the command is not fault-tolerant. Both halves argue for the conditional
      request: it would have re-fetched seven files instead of 172 and never
      approached a rate limit. The fix is a conditional request —
      `If-Modified-Since` / `If-None-Match` on refs whose vintage is `current`, with a
      304 treated as a cache hit — which keeps content-addressing intact. Deferred out
      of Milestone 12 deliberately: it belongs with **scheduled refresh with retry and
      alerting**, already queued under Post-Version 2, and that milestone is where a
      monthly cadence stops being manual.

- Note: **Float non-associativity was moving the derived vintage on every run, found
      and fixed 2026-09-06.** ARCHITECTURE #73 made the `hip_derived` release
      content-addressed so a rebuild over an unchanged warehouse would reuse it. It did
      not hold: four consecutive runs produced four different digests
      (`cbd6876d4ab875c1`, `b26957cc626951a6`, `9f6ca06e6f47f26c`, `441a37df7a1c43cf`)
      over an identical 335,927-row warehouse. `analyze` alone was stable; `load` then
      `analyze` was not, which located it in the arithmetic rather than in the release
      logic. `_affordability` averaged the Zillow numerator with `avg(value)` over
      `double precision`, and floating-point addition is not associative, so the result
      depends on the order the executor aggregates rows — an order that changes when
      `load` rewrites the heap. 19,027 of 24,956 `(region, year)` groups differ between
      `avg(value)` and `avg(value::numeric)`, in the last one or two significant digits.
      Fixed by averaging in `numeric`, which is exact decimal and order-independent, and
      rounding the ratio to 6 decimal places — four more than an annual denominator
      supports, so no published figure moves. Verified: three consecutive `load` +
      `analyze` cycles now yield `801c8504f749494d`, and two consecutive
      `pack --report` runs are byte-identical. Recorded as ARCHITECTURE #88.

- Note: **This is the answer the display-precision task was looking for, and it changes
      that task.** [ROADMAP.md](ROADMAP.md) scheduled display-precision hashing on the
      assumption that Zillow's retroactive monthly revisions would move raw floats and
      mark regions stale spuriously. Measured on an unchanged warehouse, the staleness
      was 21 of 21 on every run and none of it came from upstream revisions — it was
      this defect. Discarding precision in the hash would have masked it rather than
      fixed it, and would have masked the next one too. The remaining question the task
      was meant to answer — how many regions a *real* refresh marks stale — can only be
      measured now that the spurious churn is gone, which is what the forced re-acquire
      on 2026-09-06 is for.

- Note: **The refresh was measured on 2026-09-06 and the answer changes the task.**
      A forced re-acquire pulled genuinely new bytes — all six Zillow files and FHFA
      returned new sha256s, and the ZHVI city file grew from 93.2MB to 93.6MB. For New
      Jersey nothing moved: the newest date column in the fresh file is `2026-06-30`,
      exactly what the warehouse already held, so Zillow's 2026-08-16 release added
      coverage elsewhere and neither added a month nor revised an NJ value.
      `fact_metric_observation` stayed at 335,927 rows, `fact_metric_change` at 19,531,
      `region_rankings` at 27,823, and the derived vintage stayed `801c8504f749494d`.
      **Not one published figure changed, and all 21 explanations were still marked
      stale.** The entire report diff is `Retrieved` dates moving to 2026-09-06 and the
      one-time derived-vintage correction.

      So the staleness is real but it is provenance, not data: `fetched_at` is quoted in
      every packet's `sources[]` block, and a re-acquire that returns different bytes
      legitimately mints a new release with a new `fetched_at` even when no number the
      packet carries has moved. **Display-precision hashing would not have caught any of
      this** — there was no float precision left to discard once #88 landed, and the
      churn is in a timestamp rather than in a value. The task as scheduled was aimed at
      the wrong target. What it should become: decide whether the staleness hash covers
      the packet's provenance block at all, or only its figures. That is a smaller and
      better-aimed change than rounding, and it is the difference between "these numbers
      are out of date" and "these numbers were fetched again", which are not the same
      claim to make to a reader. Carried into Milestone 13, where citation binding has to
      settle what a figure's provenance *is* anyway.

- Note: **Milestone 12 closed 2026-09-06 with run `v2`.** 105 generations from 7 models
      over 5 scenarios and 3 regions, 0 failures, 105 judgments, $4.15. Winner
      **Gemini 3.7 Flash** at 3.56/4.00 with 0.0% unsupported figures and 0 flagged
      claims. Full table in [reports/evaluation/v2.md](reports/evaluation/v2.md).

      Two findings worth carrying forward. **Milestone 8's central result replicated**:
      capability does not predict quality here. Mistral Small 4 (cheap tier, 2.87) beat
      Mistral Large 3 (mid tier, 2.68), and Gemini 3.1 Flash-Lite came within 0.58 of
      the winner at a fifth the price. Running both tiers is what made that visible, and
      is why spending on six candidates rather than three was the right call. **And the
      local fallback is not a degraded option**: Gemma 4 E4B scored 2.90, beating three
      of the six hosted candidates outright.

      DeepSeek V4 Pro placed second on quality (3.47) and is impractical regardless: it
      hit the 6,000-token output cap on every explanation generation, took 75s each, and
      costs $0.0269 per region against Mistral Small 4's $0.00066 — 22x the price and
      24x the latency for 0.6 rubric points. With its lack of an addressable checkpoint,
      that is what put it at tier 4 rather than tier 1.

- Note: **The staleness gate was verified end to end on 2026-09-06.** A second
      `hip explain --level county` immediately after a full regeneration wrote 0 and
      reported "21 already current"; `--force` regenerated one. It only works because of
      #88 — before the float fix every run minted a new derived vintage and the gate
      would have answered "stale" for all 21 forever, which is exactly the state the
      pre-milestone review found and #73 only half-corrected.

- Note: **Measured cost of a New Jersey regeneration, 2026-09-06.** From real calls
      against markdown packets rather than extrapolated from the benchmark's JSON ones
      (markdown is 1,518 tokens against JSON's 4,703, so benchmark figures overstate by
      roughly 3x):

      | Model | 21 counties | Full NJ (1,133) | Full NJ /yr monthly |
      |---|---:|---:|---:|
      | gemini-3.7-flash | $0.26 | $10.56 | $126.77 |
      | gemini-3.1-flash-lite | $0.02 | $0.80 | $9.61 |
      | mistral-small-4 | $0.01 | $0.48 | $5.71 |
      | deepseek-v4-pro | $0.56 | $30.45 | $365.42 |

      **Gemini 3.7 Flash's cost barely scales down with region size** — output was 2,692
      tokens for a county, 3,002 for a municipality, 1,372 for a ZIP, because thinking
      dominates and is near-constant. So the 564 municipalities each cost about what a
      county does, and full NJ is 40x the county-only bill rather than the 4x the packet
      sizes suggest. That is what turns $3/yr into $127/yr, and it is the argument for
      tier 2 if the scope ever widens. The roadmap's "single-digit dollars for a full
      county-level regeneration" holds only for the cheap tier: at Milestone 15's 3,144
      counties the winner is roughly $40 and Gemini 3.1 Flash-Lite roughly $7.70.

- Note: **`dist/` is stale again** — the 21 explanations were regenerated after the
      refresh, so `make publish` needs re-running before the site reflects them. Not done
      here; it is Milestone 11's surface and its done criterion is a reachable URL.

- [x] **Reasoning effort was never controlled, so the benchmark compared vendor
      defaults rather than comparable configurations.** Raised 2026-09-06 from an
      outside review and verified against the live API the same day. `HostedRunner`
      sends no reasoning parameter, and DeepSeek V4 defaults to *high* — which fully
      explains the 93-95% reasoning share, the 34,666 output tokens across 15 benchmark
      runs, the $18.92 per thousand generations, and the 12-of-21 empty answers that
      forced the 24,000-token ceiling (#93). Every DeepSeek cost figure in
      [reports/evaluation/v2.md](reports/evaluation/v2.md) is therefore an upper bound
      measured at the model's most expensive setting, not its floor.

      Measured on `deepseek-v4-pro`, one packet-shaped prompt, 2026-09-06:

      | Variant | output tok | reasoning | answer |
      |---|---:|---:|---:|
      | default (what `v2` benchmarked) | 858 | 661 | 879 chars |
      | `reasoning_effort: "low"` | 801 | 603 | 883 chars |
      | `thinking: {"type": "disabled"}` | **223** | 0 | **986 chars** |

      Two things follow. `reasoning_effort: "low"` is not the lever — it saves 7%. The
      lever is disabling thinking outright, which cuts output 3.8x *and* returned a
      longer answer, so on this task the reasoning was not buying the reader anything.

      **The wider finding is not about DeepSeek.** `v2` compared seven models each at its
      own vendor default: Gemini 3.7 Flash spent 18,885 of 26,840 output tokens thinking,
      Mistral spent none, DeepSeek nearly all. So the quality-per-dollar column partly
      measures how much a vendor thinks by default rather than a model's efficiency at
      comparable effort. That is a defensible thing to measure — it is what you get out
      of the box — but it was not stated. **The report now states it** (2026-09-07): the
      quality-per-dollar section says every candidate ran at its provider's default, name
      the three defaults, and calls the figures an upper bound for a reasoning-heavy
      candidate. That closes the misleading-document half of this item; what remains is
      measuring the alternative rather than describing it. It does not move the winner:
      rubric score is unaffected, and Gemini 3.7 Flash led at 3.56.

      Scope when it is picked up: reasoning effort becomes a `CandidateModel` field so a
      configuration is a candidate rather than a hidden default, and `HostedRunner` sends
      it per dialect — `thinking` / `reasoning_effort` on the OpenAI-shaped body,
      `thinkingConfig` inside Gemini's `generationConfig`. Thinking-disabled variants of
      **`deepseek-flash`** and `gemini-3.7-flash` join config as candidates with their own
      ids — `deepseek-flash`, not `deepseek-v4-pro`, which DeepSeek routes to V4.1 Flash
      from 2026-09-14 (Milestone 22), and which defaults to thinking on just as V4 did.

      **Revised 2026-09-10: the variants are measured in the fresh run `v3`, not added to
      `v2`.** Milestone 21 changes every packet, so `v2`'s frozen scenarios would measure
      the variants against data the site no longer shows. The earlier plan — 30 judgments
      appended to `v2`, about $1.19 — is superseded; see "Run `v3`" at the top of this
      file. Milestone 20 itself therefore builds and tests the mechanism and runs no
      benchmark. **Do not quietly switch the generation path to thinking-disabled
      first**: Milestone 8's rule is that only a benchmarked configuration writes
      published prose, and a different reasoning setting is a different configuration.

      **Built in Milestone 20 (2026-09-10)**, with one change of plan: Gemini 3.7 Flash
      refuses its documented floor, `minimal`, and documents no off switch, so its
      variant is `gemini-3.7-flash-low` rather than a thinking-disabled one.

- [ ] **Historical comparison for Milestone 17 — trajectory, not just position.**
      Asked 2026-09-06: can a reader compare last quarter or last year against now, and
      does it need an external volume? **It does not.** The premise that this is a
      storage problem is wrong: `fact_metric_observation` already holds the full monthly
      series — 319 ZHVI date columns back to 2000 across 337,552 rows — so "Mercer this
      quarter against a year ago" is a query over rows already loaded, not data to
      acquire.

      What genuinely does not exist is *historical rank and percentile*.
      `region_rankings` is current-only at 27,923 rows, so "14th of 21 last year, 17th
      now" cannot be answered today. Two routes: compute on the fly with a window
      function over the series at an as-of date, which costs nothing on disk; or
      materialise monthly as-of rankings, which for five years of New Jersey is roughly
      500MB against 26GB free. Even at Milestone 15's 3,144 counties a materialised
      history stays in the low gigabytes. The unpruned raw tier above is what would fill
      the disk, not this.

      Why it belongs in Milestone 17 specifically: that milestone's stated purpose is
      answering a decision rather than reporting a figure, and its verdict sentence is
      computed from rank and percentile with no model involved. A trajectory is the same
      deterministic computation with a second as-of date — "more expensive than 16 of 21
      counties, and it has climbed five places in two years" — and it is strictly more
      decision-useful than a static rank. It also completes the tradeoff view: whether a
      cheaper place is *getting* cheaper or merely *is* cheaper is the question a buyer
      actually has, and only one of those is answerable today.

## Milestone 22 — DeepSeek migration and substitution detection

Started 2026-09-10, ahead of 13 because of a vendor date. DeepSeek dropped
`deepseek-v4-flash` from `/models` between 2026-09-06 and 2026-09-10, and retires
`deepseek-v4-pro` at 04:00 UTC on 2026-09-14. Neither is being *withdrawn* in the sense
SPEC anticipated. Both are **routed**: a request naming the retired model returns HTTP
200 and a well-formed answer written by a different one.

Measured 2026-09-10, one call each:

| requested | HTTP | model the response says served it | `system_fingerprint` |
|---|---|---|---|
| `deepseek-v4-flash` | 200 | `deepseek-flash` | `aeb56401…` |
| `deepseek-flash` | 200 | `deepseek-flash` | `aeb56401…` |
| `deepseek-v4-pro` | 200 | `deepseek-v4-pro` | `a307abda…` |
| `mistral-small-2603` | 200 | `mistral-small-2603` | none sent |
| `mistral-large-2512` | 200 | `mistral-large-2512` | none sent |
| `gemini-3.1-flash-lite` | 200 | `gemini-3.1-flash-lite` (`modelVersion`) | none sent |
| `gemini-3.7-flash` | 200 | `gemini-3.7-flash` (`modelVersion`) | none sent |

**Why routing is worse than withdrawal, and why the platform could not see it.** SPEC's
pinning rule rests on a withdrawn pin failing loudly and falling through. A routed pin
never fails. `HostedRunner` sends `"model": ref` and never reads back the model the
response names, so after 2026-09-14 a regeneration would store `deepseek-v4-pro` against
prose V4.1 Flash wrote. `--probe` would be fooled too: it checks that text arrives, not
which model sent it. The response already carries the truth — every provider above names
the model that answered — so the fix is to read it.

**A second gap, found while designing the first.** The preference list is documented as
falling through on a withdrawn pin ([selection.py](src/hip/eval/selection.py)), and it
never has. `resolve` decides availability with `runner.available()`, which for a hosted
cohort checks only that a key is set. A withdrawn or routed model therefore resolved as
available and then failed every region one by one. Fall-through covered a missing key,
not a missing model.

**The benchmark is deliberately out of scope.** It waits until 21, 13 and 20 have landed,
so that one fresh run measures the final packet shape, citation binding and the
reasoning-effort variants together, instead of three partial runs.

### Tasks

- [x] `Telemetry` records the served model and, where the provider sends one, the
      `system_fingerprint`. Both optional, so every existing JSONL record still parses
- [x] A served model that differs from the requested ref is a **substitution**: recorded
      as an error naming both, with the billed tokens kept (the call was paid for) and
      the text never used. Exact match only — every current candidate reports exactly
      its requested ref, and a spurious mismatch fails in the safe direction
- [x] `probe()` checks which model answered, not just that it answered
- [x] `resolve()` can probe hosted tiers, and `hip explain` asks it to, so a withdrawn or
      routed pin actually falls through — as SPEC requires and the docs already claimed
- [x] `hip explain --all` and `--model` verify each hosted model once up front, instead
      of paying for 21 substituted calls to learn the same thing 21 times
- [x] A reasoning model cut off before answering (`finish_reason` of `length` or
      `MAX_TOKENS`) is marked `truncated_reasoning`. DeepSeek reasons in a separate
      field the tag-based check never reads, which is why three empty `v2` answers
      reported `truncated_reasoning=False` and the explain errors said "no reasoning
      emitted" over 6,000 tokens of it
- [x] Config: `deepseek-flash` (V4.1 Flash) added as an unbenchmarked candidate at peak
      $0.30/$1.20, **not** on the preference list; `deepseek-v4-flash` kept and annotated
      as routed, because dropping it would remove it from run `v2`'s report;
      `deepseek-v4-pro` annotated as retiring — once routed, the guard makes it fall
      through by itself
- [x] Tests for all of the above

- Note: **`deepseek-flash` cannot be pinned.** It carries no version at all and will be
      repointed at the next Flash. The guard catches a *different* name coming back; it
      cannot catch the *same* name meaning a new model. `system_fingerprint` is the only
      trace of that, which is why it is recorded rather than enforced — fingerprints also
      change for infrastructure reasons, so failing on them would be noise.
      `hip check-config` cannot flag it either: it rejects only `-latest` and `-preview`
      suffixes, and no name-based rule can tell a version from an alias in general,
      which is why detection happens at runtime rather than at config load.
- Note: **Nothing published is wrong.** The 21 V4 Pro explanations were written by the
      real V4 Pro on 2026-09-06 and are correctly attributed. They cannot be regenerated
      as V4 Pro after 2026-09-14, so they are replaced after the re-benchmark, not before.
- Note: **Verified live on 2026-09-10.** `hip eval models --probe` against every hosted
      candidate: `deepseek-v4-flash` reported `substitution: requested
      'deepseek-v4-flash' but deepseek answered with 'deepseek-flash'`, and the other
      six — including the new `deepseek-flash` and the still-live `deepseek-v4-pro` —
      passed. No false positives: Gemini's `modelVersion` and Mistral's `model` both
      report exactly the pinned ref. After 04:00 UTC on 2026-09-14 this same probe is what
      makes `deepseek-v4-pro` fall through, so nothing else has to happen before that date.

## Milestone 20 — Reasoning effort as a measured variable

Started and finished 2026-09-10, the first of the order agreed that day: 20, 21, 13, then
run `v3`. It builds and tests the mechanism and runs no benchmark; the variants it
configures are measured in `v3`, once 21 and 13 have settled the packet they will be
measured on.

**What each provider documents, read 2026-09-10**, and what calling it showed:

| Provider | Control | When nothing is sent | Lowest setting the model accepted |
|---|---|---|---|
| DeepSeek | `thinking.type` `enabled`/`disabled`; `reasoning_effort` `low`/`high`/`max` | thinking on, effort `high` | `thinking: disabled`, a hard off |
| Gemini 3.x | `generationConfig.thinkingConfig.thinkingLevel` `minimal`/`low`/`medium`/`high` | `high` on Flash, `minimal` on Flash-Lite | `low` — 3.7 Flash refuses `minimal` with HTTP 400 |
| Mistral | `reasoning_effort` `none`/`high` | not stated; `v2` measured no reasoning | not tried; `default` only |

Four things follow, and they changed the scope as written in [ROADMAP.md](ROADMAP.md):

- **Gemini 3.7 Flash accepts no off switch.** The roadmap asked for a "thinking-disabled"
  Gemini variant. Google offers `minimal` as the floor for Flash and says even that
  "does not guarantee that thinking is off"; 3.7 Flash answered it with `400 Thinking
  level MINIMAL is not supported for this model`. The variant is therefore `low`, named
  as a level rather than as an off, with measured reasoning printed beside it. The
  legacy `thinkingBudget: 0` was tried and measured the same as `low` — 549 output
  tokens, no thinking — and is not used: it survives for backward compatibility only,
  with no documented meaning on Gemini 3.
- **`--probe` caught the refusal before anything ran.** `minimal` passed config
  validation, because capability is declared per provider, and failed its first call.
  That is the case the probe exists for: a refused setting cost one request here rather
  than fifteen generations inside `v3`.
- **Mistral stays at `default`.** Its `high` turns `message.content` from a string into a
  list of thinking and text chunks, which `_extract` would stringify into a Python repr
  and grade as the answer. And `v2` already measured no reasoning at the default, so a
  `none` variant would re-measure one configuration under two ids.
- **DeepSeek ignored the pinned sampling in `v2`.** Its reference says `temperature`
  "has no effect in thinking mode" and raises `top_p` below 0.95 to 0.95, so every
  default-effort DeepSeek generation was sampled at the provider's settings rather than
  greedily. Thinking off is the first configuration in which the deterministic mode
  reaches DeepSeek at all — which also means the `v3` pair differs in two variables, not
  one.

### Tasks

- [x] `CandidateModel.reasoning_effort` — `default`, `disabled`, or `low` — validated at
      config load: a local cohort sends no reasoning control and cannot set one, and a
      hosted candidate cannot request a setting its provider does not offer
      (`REASONING_CONTROLS` in [config.py](src/hip/config.py))
- [x] `HostedRunner` sends it in each dialect's own shape: `thinking: {"type":
      "disabled"}` for DeepSeek, `thinkingConfig.thinkingLevel: "low"` inside Gemini's
      `generationConfig`. `default` sends nothing, so a default candidate's request stays
      byte-identical to the one `v2` measured
- [x] Every `Generation` records the effort it was sent at. `v1` and `v2` records carry
      no field and parse as `default`, which is what they were
- [x] One id is one configuration: `hip eval run` refuses to resume a candidate whose
      recorded generations used a different effort (`ConfigurationChanged`), and
      `hip check-config` rejects two candidates in one cohort declaring the same ref at
      the same effort
- [x] Eligibility follows the configuration, not the name: `resolve` and
      `hip explain --all`/`--model` skip a model configured at an effort the latest run
      did not measure it at, so flipping the field on a listed model cannot publish
      prose from an unmeasured configuration
- [x] The report states the effort behind every figure — an Effort column in all four
      tables and on the selected-model line — with the hard-coded `v2` paragraph
      replaced by one derived from the run. It flags a `disabled` generation that still
      reported reasoning tokens, and a model sent two efforts under one id, which is
      excluded from selection
- [x] `deepseek-flash-nothink` and `gemini-3.7-flash-low` in config, off the preference
      list, for `v3`
- [x] `hip eval models` prints each candidate's effort, and `--probe` sends it
- [x] `reports/evaluation/v2.md` re-rendered: an Effort column reading `default` in every
      row, and the effort paragraph computed from `v2`'s own figures. No figure moved
- [x] Tests — 24 new, 379 Python tests in all
- [x] Live check, 2026-09-10 — below. Nothing was written to `region_explanations` or
      `data/eval`; the calls went through the runners directly

- Note: **Measured on Mercer County's 5y packet, explain-shaped prompt, one call each**
  (peak rates):

  | Candidate | Output tokens | Reasoning | Answer | Cost |
  |---|---:|---:|---:|---:|
  | `deepseek-flash` (default) | 5,693 | 5,068 | 2,107 chars | $0.0075 |
  | `deepseek-flash-nothink` | 512 | 0 | 2,049 chars | $0.0013 |
  | `gemini-3.7-flash` (default) | 2,655 | 2,083 | 1,725 chars | $0.0120 |
  | `gemini-3.7-flash-low` | 565 | 0 | 2,038 chars | $0.0042 |

  One call per configuration is an anecdote, not a benchmark: it shows the controls do
  what they claim and roughly what they save — 5.8x on DeepSeek, 2.9x on Gemini — and
  says nothing about quality, which is `v3`'s question. Hosted generation also varies
  between identical calls: the same `low` request returned 545 tokens once and 565 the
  next.
- Note: **the whole live check cost about $0.03**, including `hip eval models --probe`
  over all nine hosted candidates. The probe also re-confirmed `deepseek-v4-flash` as a
  substitution and every other pin as answered by itself.
- Note: **`--all` and `--model` still require no benchmark at all.** Milestone 20 made
  them check that a model's *configuration* matches what the latest run measured, which
  closes the in-place effort edit. A model the run never measured still passes, as it
  always has: the preference list is trusted to hold only benchmarked models, and
  nothing outside `resolve` enforces it. Not introduced here and not widened; listed
  under "After `v3`", because the regeneration there runs `--all`.
- Note: **Gemini 3 recommends temperature 1.0** and warns that lower values "may lead to
  unexpected behavior, such as looping or degraded performance". The harness pins 0.0
  for every candidate so that none is sampled differently from the rest, and `v2`
  scored Gemini 3.7 Flash highest under that pin, so it has not visibly cost anything —
  but it departs from the provider's guidance, and it is a `v3` decision, not a
  Milestone 20 one.
- Note: **a report prices from the rates in config when it renders**, not from rates
  recorded with the run. Gemini 3.7 Flash's rates double on 2027-01-01; if config is
  updated then, re-rendering `v2` reprices it. Reasoning effort is read from the
  generations for exactly this reason. The rates are the same hazard and are not fixed
  here.

## Milestone 19 — Multi-model interpretation

Started 2026-09-06, out of numeric order and before 13-18. Precedent: Milestone 9 was
built before 5, and 18 before 16 and 17. The reason here is that the evaluation data is
fresh and the keys are live, so generating the content costs $0.86 today and a
re-benchmark later.

**Deliverable.** Every county page carries all five benchmarked models' interpretations
of the same packet, switchable by the reader and each attributed to the model and
provider that wrote it. Same numbers under every one; only the prose differs.

**Why it is a milestone rather than a task.** It changes the warehouse schema and a
published API contract, both of which are expensive to reverse and earn Decisions Log
rows. A TODO item that quietly alters a primary key would be mis-filed.

### The design decision that shapes the rest

`API_MAY_IMPORT` is `{warehouse, packets}` ([tests/test_module_boundaries.py:37](tests/test_module_boundaries.py:37)),
so the API cannot read `generation.preference` to decide which of five explanations is
the primary one. The ordering therefore has to be **data in the warehouse**, written at
generation time: `region_explanations` gains a `rank` smallint carrying the model's
position in the preference list when the row was written. That also records real
provenance — which tier produced this paragraph — in the same spirit as the existing
`model_id` and `runtime` columns, and it keeps `hip publish` able to replay the API
without the API growing a config dependency.

The published contract stays backwards compatible. `/regions/{id}/explanation` keeps
returning **one** object with its existing shape — now the rank-1 row rather than the
only row — so `regions/{id}/explanation/{window}.json` does not change shape for any
consumer. A new `/regions/{id}/explanations` returns all of them ordered by rank, which
publishes as a new file beside the old one. Rejected: making the existing endpoint
return a list, which would break every consumer of an artifact tree whose whole point is
being consumable.

### Tasks

- [x] Migration 0010: `region_explanations` primary key becomes
      `(region_id, window, model_id)` and the table gains `rank smallint not null`.
      Existing rows take rank 0
- [x] `store` and `is_stale` in [explain.py](src/hip/eval/explain.py) key on the model as
      well as the region and window; `is_stale` currently uses `scalar_one_or_none` and
      would raise on five rows
- [x] `hip explain` accepts `--model` repeatably and `--all`, which walks
      `generation.preference` and generates one explanation per candidate. The staleness
      gate becomes per `(region, model)` so a partial run resumes
- [x] `GET /regions/{id}/explanations` returning all rows ordered by rank;
      `GET /regions/{id}/explanation` unchanged in shape, now ordered by rank and
      limited to one
- [x] `hip publish` renders the new endpoint to
      `regions/{id}/explanations/{window}.json`
- [x] Dashboard: a switcher on the interpretation panel, defaulting to rank 1, labelling
      each option with model and provider. The panel's dashed border and indentation are
      how a SPEC requirement is kept on screen and must survive the change
- [x] Generate all five sets for the 21 counties ($0.86, plus ~10 minutes of local Gemma)
- [x] Tests: the migration round-trips, five rows per region coexist, the singular
      endpoint still returns one object of the old shape, the plural returns five in rank
      order, publish emits both paths, and the staleness gate is per model

- Note: **DeepSeek V4 Pro needed a ceiling sized for its tail, and failing silently is
      the part worth remembering.** At the evaluation's 6,000-token budget it returned an
      empty answer for 12 of 21 counties, having spent the whole budget on reasoning; at
      12,000 it still failed 2. Every one of those calls returned HTTP 200 with a
      well-formed body — nothing in the response says you received nothing, and only a
      row count caught it. Bergen County then completed the identical packet in 7,871
      tokens under a 24,000 ceiling, so this is variance in reasoning length rather than
      a threshold, which is precisely the non-reproducibility SPEC accepts for hosted
      generation. The ceiling is now 24,000 for hosted cohorts and costs nothing: billing
      is per token emitted, so a ceiling is not a reservation and headroom is free unless
      used. Recorded as ARCHITECTURE #93.
- Note: **Measured cost of the five-model set: $0.86 for 21 counties**, near the estimate.
      DeepSeek V4 Pro is $0.031 per answer against Mistral Small 4's $0.0007 — 47x — on
      rates only 1.06x higher on output, because it emits 2.6x the tokens and roughly 93%
      of them are reasoning. Price per token is not price per answer, and that gap is the
      argument for keeping the comparison to four models beyond county scope.


- Note: **Two cautions carried from the write-up.** It multiplies the staleness surface
      by five, since each region-model pair carries its own packet hash. And at full NJ
      it would cost roughly $42 per refresh, $30 of which is DeepSeek V4 Pro alone — so
      beyond county scope this wants a four-model set. County-only it is $0.86.
- Note: **It is the reachable subset of "bring-your-own-model comparison"** under
      Post-Version 2, whose two stated blockers were that there is no server to run a
      model on and that the rubric half needs a paid judge. Pre-generated explanations
      need neither, being ordinary artifacts.

- [ ] **Revision tracking — what the platform currently throws away.** Raised
      2026-09-07 while settling the prune. Zillow revises published months
      retroactively, and the warehouse cannot see it: `fact_metric_observation` is keyed
      on `(region_id, metric_id, period_start)` and the loader upserts, so a revised June
      silently replaces the old June and no record survives that the figure moved. The
      only trace is the superseded file in `data/raw/`, which nothing reads and the prune
      above would eventually delete.

      Worth building rather than merely preserving, and it is on-thesis: a platform whose
      claim is that every figure traces to a source release is unusually well placed to
      say *"this figure was reported as $X last month and is $Y now"*, which is real
      signal about a market and something almost nobody publishes. It is also cheap in
      storage — a revision row is written only when a value actually changes, which today
      is a small fraction of observations.

      Not on the roadmap. The roadmap mentions Zillow's revisions only as a suspected
      cause of staleness, and that suspicion turned out to be wrong (it was the float
      defect, #88). Revisions as *data* have never been considered. Sequence it after the
      prune, since the prune decides how much history is recoverable when it starts.

- [ ] **Nothing prunes superseded raw releases, and a refresh cadence makes that
      unbounded.** Measured 2026-09-06. The raw tier is content-addressed and immutable
      by design (ARCHITECTURE #10), which is right for provenance and means a refresh
      leaves both copies on disk: after one Zillow refresh `data/raw/zillow_zhvi/` holds
      129MB and 117MB for the ZIP layer, 97MB and 89MB for city, 13MB and 13MB for
      county — the second of each superseded. The only `unlink` in `hip.sources.base`
      cleans a partial download; `hip analyze` prunes unreferenced `hip_derived`
      releases and there is no equivalent for downloaded files.

      One refresh costs roughly 275MB across Zillow ZHVI, ZORI, FHFA and BLS. That
      delta does **not** grow with state count — Zillow's files are already national at
      3,071 counties — so it is about 3.3GB/year monthly or 1.1GB/year quarterly,
      against 26GB free today. The docs' "2.9GB against 32GB free" is stale in both
      halves: `hip footprint` now reports 3.4GB filesystem plus 291MB Postgres, and the
      volume has 26GB free at 88% capacity.

      **A prune does not touch time comparisons, and the reason is worth stating.** Every
      Zillow release carries the *entire* series — 319 monthly columns back to 2000, not a
      delta — so the newest file supplies all history and the superseded ones are
      redundant for that purpose. Year-over-year, quarterly and monthly trends are read
      from `fact_metric_observation`, which keeps every observation from 1971 to 2026 and
      is untouched by pruning `data/raw/`.

      What a prune would cost is **revision history**, and that is already being lost:
      `_INSERT_FACT` upserts on `(region_id, metric_id, period_start)`
      ([load.py:233](src/hip/warehouse/load.py:233)), so when Zillow revises June
      retroactively the previous value is overwritten and the superseded raw file becomes
      the only record that it ever differed. Nothing reads that today, but pruning makes
      the loss permanent. Keeping the N most recent releases per ref — three, say — stops
      the unbounded growth while leaving a window in which a revision is still
      recoverable, which is why that shape is preferred to deleting everything superseded.

      The fix is that prune, not a slower cadence: quarterly saves 2.2GB/year and costs up to three months of staleness on
      a platform whose product is current figures. It pairs with the conditional-request
      item above — together they turn a refresh from "re-download 2GB and keep it
      forever" into "fetch what moved and retain a bounded history."

- Note: **The "no external volume needed" claim holds, with a caveat the original did
      not state.** [ROADMAP.md](ROADMAP.md) and the Milestone 10 notes concluded that no
      Version 2 milestone as scoped requires an external volume, and that is still true:
      the Northeast adds 3-6GB against 26GB free, and Milestone 15 stops at county
      level. What the conclusion assumed without saying so is a *static* dataset. It was
      reached before any refresh had ever been run, and accumulation from refreshes is
      the term it omits. With the prune above it stays true indefinitely; without one,
      monthly refreshes plus the Northeast put the boot disk under real pressure inside
      about five years. The relocation machinery itself is built and works —
      `HIP_DATA_DIR`, `HIP_REPORTS_DIR` and `HIP_PGDATA` are independent settings with
      `~` expansion (ARCHITECTURE #65), and `.env.example` carries the SSD example —
      so this is a capacity-planning note rather than an engineering gap.
- Note: **Cloud storage and compute, costed 2026-09-07 — revisit with scheduled refresh,
      not before.** Asked whether to put everything in the cloud instead of on an external
      drive. Storage is effectively free: R2 is about $0.06 a month for today's 4GB and
      under $1 at 50GB. **Managed Postgres is the whole bill** — $15–25 a month for a ~2GB
      database on Neon, Supabase or RDS — and a monthly pipeline run on spot or CI compute
      is well under a dollar. The catch is what the fee buys. Production does not use
      Postgres: Milestone 11 ships static artifacts with no database and no application
      server, and the architecture lists "no cloud service is required" among its
      constraints ([ARCHITECTURE.md](ARCHITECTURE.md)). So the fee would host a
      build-time dependency the live site never queries, breaking even against a one-off
      SSD in five to eight
      months. The cloud earns its keep only for running the pipeline on a schedule without
      a laptop open, which is the Post-Version 2 scheduled-refresh item.
- Note: **An external drive is probably unnecessary; fix the prune first.** 3.7GB is used
      against 26GB free, and Milestones 14 and 15 would add only about 1.5GB and 1.2GB.
      The unpruned raw tier is what would fill the disk, at ~275MB per refresh, and the
      prune is a small code change against a purchase. If a drive is bought anyway, note
      that USB-C is a connector, not a speed: the same port carries USB 3.0 (~500MB/s) or
      USB4 and Thunderbolt (40Gbps). Check the protocol behind it — NVMe inside, USB 3.2
      Gen 2 at minimum — because `hip stage` does random-read, out-of-core DuckDB work
      against the Parquet tier. APFS, not exFAT, per the Milestone 10 note.

- Note: **`hip land` silently dropped a month of Zillow data, found and fixed
      2026-09-06.** Worse than the acquire cache above and in the same family. The
      forced re-acquire correctly fetched Zillow's August release, whose county file
      carries 319 date columns ending `2026-07-31` against the previous 318 ending
      `2026-06-30`. `hip land` registered the new release and did not re-transcode it,
      because `parquet_path` keys on `vintage` — the literal string `current` for this
      source — so both releases resolve to
      `data/parquet/zillow_zhvi/current/county.parquet`, and the lander skipped on
      `out.exists()`. The file still had the previous month's mtime. Fixed by recording
      the producing release's sha256 in a `.parquet.src` sidecar and comparing against
      it (ARCHITECTURE #89), which keeps the skip that matters — MOD-IV is 1.1GB — while
      making it answer the right question. After re-landing and re-running the pipeline:
      `fact_metric_observation` 335,927 → 337,552, `fact_metric_change` 19,531 → 19,574,
      `region_rankings` 27,823 → 27,923, latest ZHVI period `2026-06-30` → `2026-07-31`,
      and real figures moved — Mercer County's 5y window shifted to
      `2021-07-31 → 2026-07-31` with the home value index at $450,985 against $453,317,
      a month-over-month decline.

      **This supersedes the "nothing changed" note above**, which was written from the
      landed Parquet and was wrong about the cause: the refresh did carry new data, and
      two silent gates stopped it reaching the warehouse. What survives from that note
      is the part that was measured correctly — that `fetched_at` moves the packet hash
      on a re-acquire whether or not a figure changed, and that display-precision
      hashing does not address it.

- Note: **Refresh cadence, now that both gates are understood.** Until 2026-09-06 no
      cadence would have produced anything: every source whose vintage is `current` was
      double-gated, so a nightly `make pipeline` would have run for months emitting
      identical output. On the interval itself, monthly is right and fortnightly buys
      almost nothing — the core housing data is monthly with roughly a seven-week lag
      (the July figure published around 2026-08-16), and of the twelve sources only
      FRED's mortgage rate is weekly while ACS, HUD, IRS, Census permits and MOD-IV are
      annual and FHFA quarterly. A fortnightly run would re-fetch the better part of a
      gigabyte to pick up one mortgage-rate print. Better than any fixed interval is to
      align to publication, which is what the conditional request makes affordable:
      check every source daily for a few KB of headers and transcode only what moved.

- Note: **A listed model is not a callable one, found 2026-09-06.**
      `gemini-2.5-flash-lite` was the intended cheap Gemini tier and the price floor of
      the whole slate at $0.10/$0.40. It appears in the `/models` listing, advertises
      `generateContent` among its `supportedGenerationMethods`, and returns
      `404 "no longer available to new users"` when called — it is grandfathered for
      keys older than this account's. `served_models()` cannot see that, because the
      listing is not the thing that lies. `hip eval models --probe` now calls each
      hosted candidate once with a trivial prompt; it costs a fraction of a cent per
      candidate and is the only check that catches this class. The cheap Gemini tier is
      `gemini-3.1-flash-lite` at $0.25/$1.50 — which this file had previously rejected
      for sitting between the two chosen models, a rejection that no longer applies now
      that the model below it is unreachable.
- Note: **DeepSeek offers no pinnable checkpoint, confirmed 2026-09-06.** The provider
      serves exactly three models — `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`,
      `deepseek-v4-pro` — and no dated snapshot, while its Flash checkpoint moved to
      V4-Flash-0731 and Pro to V4-Pro-0813 without either id changing. Mistral is the
      only one of the three that pins in the sense SPEC means
      (`mistral-small-2603`, `mistral-large-2512`); Gemini's ids are stable but undated.
      So the roadmap's DeepSeek-first ordering puts the least pinnable provider in
      tier 1, which is worth revisiting once the benchmark has ranked them.
- Note: **Live smoke test passed on 2026-09-06**, one generation per candidate through
      the real APIs: all six answered correctly from a small packet, at $0.000045
      (Mistral Small 4) to $0.001173 (DeepSeek V4 Pro) per generation and 508ms to
      3,646ms. Mistral Large 3 volunteered the smoothing caveat unprompted, which is
      the behaviour the rubric's caveat_handling criterion rewards.

- Note: **What is built and what is blocked, as of 2026-09-06.** Everything that does
      not need a key is done and tested: the config schema, `HostedRunner` with its
      three dialects and its retry, the preference list, bounded concurrency, the
      staleness gate, the cost column, and the five collision items from the
      pre-milestone review. 321 tests pass. Two tasks remain and both need the pipeline rather than a key: measuring real staleness on a refresh, and regenerating the 21 NJ explanations
      with whichever model the benchmark selects. The verified candidate slate is now
      in `config/evaluation.yml`.
- Note: **`generation.preference` holds one model and that is the honest state.** SPEC
      requires the list to contain only models that have passed the evaluation, and
      today that is the local Gemma 4 E4B alone. Hosted tiers are prepended as they
      clear the benchmark, so the config's own history records when each provider
      earned its place rather than asserting it in advance.
- Note: **`hip explain --unbenchmarked` exists for the bootstrap and is a loaded gun.**
      The benchmark gate cannot be satisfied by a candidate that has never run, so
      there has to be a way through it to run one. The flag says plainly in its help
      text and in its output that it publishes prose from an unmeasured model. If it is
      ever needed outside this milestone, that is a sign the gate is wrong rather than
      that the flag is useful.

- Note: **`hip eval cost` under-reports, found 2026-09-06.** `estimated_cost`
      ([judge.py:342](src/hip/eval/judge.py:342)) assumes 7,000 input and 800 output
      tokens per judgment. Rebuilding the real prompt over the stored `v1` artifacts
      gives ~2,600 input (226 system + 442 schema + 1,931 user, mean of 15) and
      2,000–3,000 output, because `effort: medium` thinking bills as output and
      dominates the verdict JSON. The estimate is low by 15–60%. Corrected in this
      milestone, which is also the one that adds a cost column.

## Attribution and licensing

- [x] **Site-wide source footer** (2026-09-05). Was: the landing page's choropleth and
      ranking table are both `zhvi_sfr` and named no source at all. Now all 2,273 pages
      carry every source with its terms, up from 1,671 that mentioned Zillow only
      because a report happened to print its packet's sources table. Rendered from a new
      `GET /sources` — the one endpoint ARCHITECTURE listed as unbuilt — so the footer
      reads the same rows the packet does and cannot drift when a source is added.
- [x] **`NOTICE` separating code terms from data terms** (2026-09-05). MIT covers the
      software; data and derived outputs stay under each publisher's terms, generated
      from `config/sources.yml`.
- Note: **The footer cost 2,272 files and 62MB** — one extra RSC payload per route, so
      `dist/site` went from 11,375 files to 13,647 and from 254MB to 316MB. Still inside
      Cloudflare Pages' 20,000-file free tier, but it consumed a third of the remaining
      headroom for a footer, which is a concrete instance of the pre-rendering cost noted
      under ARCHITECTURE #68.
- [x] **Source links pointed at API roots, not pages** (2026-09-05, migration 0009,
      ARCHITECTURE #72). Five of twelve were broken or machine-facing for a reader:
      `api.census.gov/data` returned JSON, `api.bls.gov/publicAPI/v2` and
      `api.stlouisfed.org/fred` 404ed, HUD's API root asked for a sign-in, and the
      MOD-IV link had rotted — NJ retired that page and the tax list now lives on NJGIN.
      `sources.url` stays as it was, because the packet contract carries it and it is
      correct provenance; a new `homepage` holds the page a person should visit and
      falls back to `url` where they are the same. The footer links `homepage`.
- Note: **`make publish` now deletes `web/.next` before building.** Next's incremental
      cache is keyed on source rather than on data fetched during the build, so a
      component whose markup did not change but whose API response gained a field is
      served from cache. That is exactly how the first corrected build shipped a footer
      whose links had no `href` at all, while `dist/artifacts/sources.json` beside it
      held the right values. Publishing is not a dev loop; a cold build is the right
      trade.
- Note: **Per-source licences are already recorded and already travel with the data.**
  `config/sources.yml` carries a `license` for every source, packets carry it per source,
  and the Markdown reports print it. The gap is not the data model; it is that the two
  surfaces a casual visitor actually sees — the landing page and the repository root —
  do not surface what the packet already knows.

## Decisions deferred to their milestones

Recorded here so they are decided deliberately when the milestone opens, rather than
defaulted in the first commit that needs them.

- Note: **Mixed-model prose across the site (Milestone 12).** The preference list can
  fall through mid-run, so some regions may carry prose from one model and some from
  another. `region_explanations` already stores `model_id`, `model_label`, and `runtime`,
  and the dashboard already shows them, so it is visible rather than hidden. The open
  question is whether a change of model should *force* regeneration — a consistent voice
  at the cost of a full re-run — or leave existing prose in place, which is free and
  leaves several models' writing on the site indefinitely. Leaning toward leaving it:
  every row is labelled, and the packet hash already guarantees nobody reads prose about
  stale numbers. Not decided.
- Note: **Staleness currently ignores model identity (Milestone 12).**
  `hip.eval.explain.is_stale` compares only `packet_sha256`, so swapping models does not
  mark anything stale. That is the correct default under the leaning above, but it is a
  default nobody chose — it falls out of the Milestone 8 implementation. Whichever way
  the decision above goes, this function should say so explicitly.
- Note: **Cloudflare Pages caps files per deployment (Milestone 11).** Verify the
  current limit before choosing the artifact layout. One rendered file per region fits
  at county scale (3,144) and does not fit at national municipality scale, which decides
  between per-region files and a queryable data layer for the long tail — a layout
  decision, not a scheduling one.
- Note: **Milestones 14 and 15 are reorderable (open until 13 ships).** 14 is depth
  (five levels, nine states); 15 is breadth (two levels, every state). 15 is the easier
  engineering and unblocks the map; 14 exercises the volume increase where a bad load is
  still cheap to reload. Recorded in [ROADMAP.md](ROADMAP.md) under "Why this order".
- [x] **`regions.name_lsad` loaded from TIGER's NAMELSAD** (2026-09-05, migration
  0008, ARCHITECTURE #70). Done ahead of Milestone 17 because it is a pipeline and
  schema change, not a frontend one. NJ reuses 30 municipality names; `parent_id`
  resolved most, but four pairs shared a name *and* a county — Andover borough/township
  in Sussex, Boonton town/township in Morris, Bordentown city/township in Burlington,
  Washington borough/township in Warren — and were separable only by GEOID. After the
  reload, zero municipalities are ambiguous on `(name_lsad, parent_id)`. `name` is
  unchanged, so no published label moved. Also exposed on the API's `Region` model,
  including inside the recursive ancestors CTE, which selects its own columns and would
  otherwise have drifted.
- Note: **ZIP cannot label a search result, though it is a fine search input**
  (Milestone 17). Newark maps to 15 ZIP codes; `region_crosswalk` makes ZIP↔municipality
  many-to-many by design, so there is no single ZIP to display and showing one would be
  wrong. County plus legal type is the label; population is useful only for ordering
  results, since it says which match is larger rather than which is the one meant.
- Note: **Milestone 17's second user path needs a query the static tree cannot answer.**
  Someone evaluating a place they are moving to wants it compared against where they
  live now, which is `/compare` — one of the three endpoints in the publish manifest's
  `unpublishable` list, because an arbitrary set of region ids is combinatorial. So the
  consumer entry point carries a dependency on a browser-side query layer over published
  data, and is larger than its row suggests. Worth settling before it is scheduled.
- Note: **The typeface and wordmark in Milestone 18 are a taste decision, not an
  engineering one.** Everything else in that milestone is checkable — focus states
  exist or they do not, the metric selector works or it does not — but the type
  pairing and the mark are the owner's call and should be chosen rather than
  defaulted. What is *not* open: the palette, the tabular figures, the print
  stylesheet, and the interpretation panel's dashed treatment are all deliberate and
  documented, and Milestone 18 restyles around them rather than over them.
- Note: **`place` versus `cousub` outside the strong-MCD states.** Not a Version 2
  decision — Milestone 14's nine states are all strong-MCD and Milestone 15 stops at
  county level, so nothing in Version 2 needs it. It becomes blocking the first time
  municipality-level data is wanted in a state where county subdivisions are statistical
  divisions. `config/geography.yml` already warns that the identifier system is expensive
  to change once fact rows reference it.

## Data sources worth adding

Reachability probed 2026-08-13; each line says what it would add and what it needs.

**Sized on 2026-09-07, because storage was the deciding question.** Every candidate below
that uses an existing key is negligible against a 2.4GB raw tier — all five of Milestone
21's sources together are under 10MB, about 0.3% of what is already on disk:

| Source | Measured | Ten-year NJ footprint |
|---|---|---|
| FRED `NJSTHPI` | 19.7 KB, full history in one call | ~20 KB |
| HUD FMR | 0.3 KB per county-year | ~63 KB (21 counties x 10 years) |
| ACS B25002/B25003 | same shape as the ACS files already held, single-digit KB each | ~200 KB |
| HUD CHAS | endpoint returns 200; the query shape needs settling — it answered empty to a guessed `entityId`, so size it properly before scheduling | likely well under 1 MB |
| Census BPS place, Northeast | 813 KB per year, whole NE region before filtering to NJ | ~7.9 MB |

So storage is not a reason to sequence any of these, and **BPS place is the only one large
enough to notice** — and it is large only because the file covers the whole Northeast
region rather than one state.

**The exception, and it is the expensive one:** Zillow's other cuts (bottom- and top-tier
ZHVI, days-to-pending, for-sale inventory) are each another ~100MB national CSV *per
refresh*, so they multiply the prune problem rather than adding to it once. They belong
with expansion, not with New Jersey depth.

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

- ~~`ANTHROPIC_API_KEY`~~ — supplied and spent: Milestone 8 closed on 2026-08-14 with
  105 rubric judgments from `claude-opus-5`. Still the only paid key the platform uses,
  and still read by nothing outside `hip eval judge`.

**Needed by Version 2**

- [ ] **Top up the Anthropic credit before run `v3`.** About $3.47 remained after `v2`'s
  judging batch — a count from quoted batch costs, not a console reading, so check the
  console. `v3` needs roughly $5–6, plus a margin for one re-run; `hip eval cost --run
  v3` quotes it exactly before anything is spent. The credit is read only by
  `hip eval judge`, so nothing else waits on it.
- [ ] **Rotate the DeepSeek, Gemini and Mistral keys if the 2026-09-06 transcript is ever
  shared.** All three were pasted into chat to be written into `.env`, the same situation
  the Census, FRED and BLS keys above are in.
- ~~A hosted inference key~~ — DeepSeek, Gemini and Mistral keys supplied 2026-09-06 and
  in `.env`; Milestone 12 benchmarked all three providers.
- ~~The domain, and a Cloudflare account it is served from~~ — live since Milestone 11 at
  `housing.jasonli.app`, with artifacts at `housing-data.jasonli.app`.
- Note: no external volume is listed here, because none is needed. Milestone 10 is
  written and tested against a second local path, and no Version 2 milestone as scoped
  outgrows the boot disk. See the Milestone 10 notes for the numbers, and "Nothing prunes
  superseded raw releases" for the one thing that would change that.

**Nothing already built is blocked on user input.** Every key the existing pipeline uses
is present. The one outstanding item is the Anthropic top-up, and it blocks only step 4
of "Resume here".
