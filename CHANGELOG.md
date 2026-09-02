# Changelog

All notable changes to the Housing Intelligence Platform. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [0.10.0] — 2026-09-02

First milestone of Version 2, and the smallest one on the plan. It answers a question
nobody could answer before: what does one state cost? Not in throughput — `mac-sitrep`
has profiled `make pipeline` since 2026-08-28 — but in bytes left on disk afterwards,
split by storage tier and by state. That is the figure Milestone 14 multiplies by nine,
and New Jersey's is now published rather than guessed at.

The milestone was re-scoped mid-flight. It was planned as per-stage timing plus disk
relocation, on the premise that disk pressure was the constraint. Reading the repository
showed both halves of that were wrong: sitrep already measures time, CPU, RAM, and I/O,
so a second harness would have produced rival numbers in the same README; and the disk
argument did not survive the measurement, since the two largest items under `data/` —
1.1 GB of NJ MOD-IV and the 529 MB national ZCTA layer — do not grow when states are
added. What survived was a latent path defect and a genuine measurement gap.

### Added
- **`hip footprint`** (ARCHITECTURE #66) — bytes per storage tier, per warehouse table,
  and per state, with `--json` for capturing into a document. Postgres is included
  because it lives inside Docker's disk image, invisible both to sitrep's process
  accounting and to `du` against `data/`. Degrades to the filesystem half when Postgres
  is unreachable, matching `warehouse.db.probe` — a capacity question should not require
  `docker compose up`.
- **`HIP_REPORTS_DIR`** — reports are now located by their own setting.
- **`HIP_PGDATA`** — relocates the Postgres data directory, read by
  `docker-compose.yml`. Defaults to the existing `pgdata` named volume, so a warehouse
  that is already loaded stays untouched until someone opts in.
- **Seven per-stage scenarios** in `.sitrep/project.json`, so the existing profiler
  reports which stage dominates instead of only the eight together. `acquire` is
  deliberately excluded: it returns cached releases without touching the network, so
  profiling it measures a hash check rather than a download.
- **Storage Footprint section in the README**, measured for New Jersey: 3.1 GB across
  the filesystem tiers plus 339.3 MB in Postgres, 3.4 GB in total. `regions` is 40 kB
  per row because it carries PostGIS geometry, which is why a state's cost tracks how
  finely it is subdivided rather than how much history it holds.
- **`make data-dirs`**, which creates the storage tiers wherever the config points them.

### Changed
- **Storage locations are settings, never derivations** (ARCHITECTURE #65).
  `Settings.reports_dir` was a property returning `data_dir.parent / "reports"`; it is
  now a field defaulting to the repo root. The default is byte-identical to what the old
  expression returned, so nothing moves for anyone who does not set the variable.
- **`make setup` no longer hardcodes `data/`** — it asks the config where the tiers are,
  so a setup run with `HIP_DATA_DIR` set does not leave an unused `data/` in the repo.
- **`~` is expanded** in `HIP_DATA_DIR`, `HIP_CONFIG_DIR`, and `HIP_REPORTS_DIR`, which
  would otherwise have created a directory literally named `~`.

### Fixed
- **Relocating the data root silently relocated `reports/` with it.** Because
  `reports_dir` derived from `data_dir.parent`, pointing `HIP_DATA_DIR` at an external
  volume would have taken the 21 git-tracked county reports and the evaluation report
  off the repo, breaking every README link to them. Dormant until someone moved the data
  root, which is exactly what this milestone was going to make easy.

### Documented
- **The published pipeline timing is a warm run.** `hip acquire` returns cached releases
  unless `--force`, so the 22-second figure re-processes data already on disk and
  downloads nothing. Cold-run cost — what adding a state actually incurs — has never
  been measured. Recorded in the README and in Known Limitations.
- **`make pipeline` always dirties 21 tracked files**, because `analyze` writes a new
  `hip_derived` release stamped with the run time. The reports are correct; the diff is
  noise.

## [0.9.0] — 2026-08-14

The last milestone of Version 1, and the first time a model touches the platform. Eight
local candidates answered the same five questions about the same real analysis packets;
every figure they stated was checked against the packet deterministically, and Claude
graded only what counting cannot reach. **Gemma 4 E4B (Q4_K_M, Ollama) was selected** —
3.21/4.00 weighted, 0.0% unsupported figures, 3/3 correct refusals, 28.6 tok/s — and it
now writes the explanation shown on every county page, labeled as interpretation.

Three of the four harness bugs found along the way would have published a wrong result.
They are listed under Fixed because that is what they were, and because the anchor pair
that caught the largest one is the reason the report can be trusted at all.

### Added
- **Evaluation harness** — `hip eval scenarios | run | check | judge | report | models |
  show | cost`. Five standardized scenarios are built from real analysis packets and put
  through eight local candidates across two runtimes, with sampling pinned identically
  on both sides so the comparison is not a stochastic sampler against a greedy one.
- **One `ModelRunner` protocol** over Ollama and MLX-LM (ARCHITECTURE #57). Each
  implementation normalizes its runtime's telemetry and declares what it cannot report:
  MLX exposes a true allocator peak, Ollama only process RSS, and `memory_basis` says
  which a figure is rather than letting a reader assume they are comparable.
- **Deterministic numeric verification** (#58) — every figure a model states is matched
  against the packet it was given, so hallucination rate is counted rather than graded.
  Claude scores only what a reader can judge: grounding, caveat handling, usability.
- **Reasoning normalization** — Ollama splits reasoning into a `thinking` field while
  MLX leaves `<think>` inline, for the same model and prompt. Both are reduced to one
  answer before grading, including the unterminated case where the budget ran out
  mid-thought. Reasoning tokens are measured as cost and never graded as quality.
- **`region_explanations` and `GET /regions/{id}/explanation`** (migration `0007`, #60)
  — `hip explain` generates a short narrative per region with the selected model and
  stores it with the model, the runtime, and `packet_sha256`. The response carries
  `kind: "interpretation"`, names the model, and reports `stale` when the numbers have
  moved since the text was written.
- **Explanation panel** on the region page, styled as commentary rather than as another
  data card, with attribution in the heading. Renders nothing when no explanation
  exists — the dashboard is fully usable with no AI layer at all.
- **`config/evaluation.yml`** — candidates, scenarios, rubric and weights, and judge
  settings as product configuration, cross-checked by `hip check-config`.
- **`make setup-eval` and `make eval`**, plus the optional `eval` dependency group.

### Fixed
- **Neither runtime was applying the models' instruct formatting.** MLX-LM's
  `stream_generate` takes a raw string and does not template it; Ollama models imported
  with a bare `FROM` carry `TEMPLATE {{ .Prompt }}`. Untemplated, a model never emits
  its end-of-turn token: the same Qwen3-8B at the same precision reported 89 stated
  figures on one runtime and 1,461 on the other, with 3/3 correct refusals against 0/3.
  Prompts now go through `apply_chat_template` on MLX and `/api/chat` on Ollama. Caught
  by the matched anchor pair, which is what the anchors are for.
- **A thinking model returned nothing at all through `/api/generate`.** gemma-4-12B
  produced an empty string for every prompt — including "Reply with exactly: OK" — while
  consuming the whole token budget, because its output goes to a reasoning channel the
  raw endpoint never populates. The same call on `/api/chat` returns its reasoning.
- **`.env` was never loaded into the process environment.** pydantic-settings reads it
  only for `HIP_`-prefixed settings, so every source credential and the judge key —
  all resolved with `os.environ.get()` — ignored the file that `.env.example`, the
  README, and the judge's own error message all told you to put them in.
- **The judge's rubric schema was rejected by the API.** Structured outputs do not
  support `minimum`/`maximum` on numbers, and the rejection lands per request at
  submission: the first batch returned 105 errors for 105 requests. Scores are an enum
  now, and `collect_batch` carries the API's message through instead of recording only
  the result type.
- **The explanation API tests deleted real data.** They pick the top-ranked county and
  delete its row to exercise the 404 path, against the developer's own warehouse, so
  running the suite after `hip explain` silently destroyed one county's explanation.
  An autouse fixture now snapshots and restores it.
- **The numeric checker counted correctly-cited dates as fabrications.** `2019-12-31`
  was decomposed by the number pattern into 2019, -12, and -31, so every citation of a
  window produced three phantom "unsupported" figures. Measured on a real run: 33 of 148
  figures reported unsupported for gemma-4-E4B, against 0 of 74 after the fix. Two
  related false positives went with it — a number inside a metric *name*, and a year
  echoed from the question while correctly declining to answer.
- **The output budget truncated reasoning models specifically.** At 1,600 tokens
  Qwen3-8B wrote 5,747 characters of reasoning, hit the cap, and returned an empty
  answer. Grading that as a zero would have biased the entire comparison against
  reasoning models, which is the confound the milestone exists to avoid.

### Known gaps
- **The deterministic fabrication gate never bound.** Every judged model came in under
  the 5% bar, so the winner was decided on rubric score alone. The gate makes the
  ordering safe to state; it did not have to fire this time.
- **`completeness` and `caveat_handling` are the weakest criteria for every model** —
  2.1 and 2.5 even for the winner, against 3.8 for factual accuracy. Local models quote
  the packet accurately and then leave out much of what it supports.
- **The evaluation covers three counties and one payload format.** Markdown only; the
  JSON-vs-Markdown comparison the 3x token gap motivates has not been run.
- **`gemma-4-e4b-mlx` cannot be loaded** by mlx-lm 0.31.3 (`Received 126 parameters not
  in model` — the E4B MatFormer architecture). All 15 of its generations are recorded
  as errors, and it costs one of the two anchor pairs.
- **Three candidates do not converge at a 6,000-token budget** — `phi-4-mini-mlx` on
  15 of 15, `qwen35-9b-mlx` on 13 of 15, `gemma-4-12b-q4` on 6 of 15 at 8.6 minutes per
  attempt. Doubling the budget from 3,000 changed the first two not at all.
- **The evaluation samples three counties**, not all 21. Widening it is a flag, at one
  generation per model per question.
- **Refusal detection is a heuristic** — a phrase list plus a length ceiling, tuned to
  under-report rather than credit a decline that was never made.
- **The numeric checker verifies existence, not correct use.** A packet figure attached
  to the wrong metric passes the count and is the judge's to catch.
- **`uv sync` removes unlisted groups**, so `make setup` uninstalls `mlx-lm` and
  `anthropic`; `make setup-eval` is the one that installs them.

## [0.8.0] — 2026-08-13

The parcel tier arrives, and with it the housing *stock* — how much of it there is, how
old, on what lots — which nothing else in the warehouse measured. It also forced two
things the platform had been deferring: ranking by value rather than only by change, and
a provenance defect that had been shipping a caveat in every packet.

### Added
- **Milestone 7 — 3.48M NJ parcels.** `hip.sources.nj_modiv` acquires the statewide
  parcel/MOD-IV composite from NJGIN's ArcGIS Feature Service in 1,741 `OBJECTID`-window
  requests (~32 minutes, 1.16GB NDJSON, 67MB Parquet). The parcels stay in Parquet and
  DuckDB; only aggregates reach Postgres.
- **Six municipality assessment metrics** — median assessed value, residential parcel
  count, median year built, median lot size, vacant land share, and apartment share,
  computed in DuckDB for 554 of 564 municipalities.
- **`region_identifiers` is populated at last.** 554 NJ municipal codes under scheme
  `nj_cd_code`, the column Milestone 1 created and left empty pending exactly this
  source. A future NJ source keyed on `CD_CODE` now joins without name matching.
- **Value-based rankings** — `region_rankings.basis` distinguishes `change` over a
  window from `value` at the latest observation (migration `0006`). 8,302 value
  rankings. `/rankings?basis=value` answers "which municipality is most expensive",
  which the warehouse could not answer before.
- **Packet `1.1`** adds `levels`: every metric's most recent reading with its value
  rank. Additive and backward-compatible, and the first migration the published schema
  has had to perform. A packet with levels and no changes is now valid, because that is
  what a snapshot-only municipality genuinely is.
- **Current-values tables** on the region page and the report page, and a `Current
  values` section in the Markdown report.
- **`land_ndjson`** streams newline-delimited JSON straight to Parquet through DuckDB,
  so 3.48M rows never pass through Python.
- **`SourceAdapter.filename()`** lets an adapter that assembles a release from many API
  calls name the result, instead of inheriting the last path segment of a query URL.

### Fixed
- **Release provenance now names the right vintage** (ARCHITECTURE #47 → #53). The
  loader keyed releases on `(source_id, layer)`, which is not unique for a source
  publishing several vintages, so every ACS observation in the warehouse cited the 2019
  release. Every staging model now carries `release_vintage`, read off the Parquet path
  by a new `release_vintage()` macro, and the loader resolves most-precise-first. Each
  ACS year cites its own release; all five vintages are in use.
- The packet caveat that reported that defect now asks the fact table whether provenance
  is actually collapsed, rather than inferring it from a source's vintage count — so it
  disappeared on its own once the data no longer warranted it.
- Tables inside `.scroll-x` no longer compress on a narrow screen (carried from 0.7.0).

### Changed
- `/rankings` takes `basis` and returns `unit` plus an always-present `value`; the
  change-only fields are null under `basis=value`.
- `/regions/{id}/summary` returns `levels` alongside `headlines`.
- `hip analyze` reports change rankings and value rankings separately.
- `hip` configures logging at INFO so a 32-minute parcel fetch reports progress, with
  httpx's per-request logging silenced.
- `year` and `acres` units format correctly in both the Markdown report and the
  dashboard — a year renders as `1958`, not `1,958`.
- `njgin_parcels` moved from a Milestone 7 source to Milestone 8: the MOD-IV composite
  already carries the geometry, so a separate geometry source would fetch the same
  shapes twice.

### Known gaps
- **The bulk 943MB geodatabase is unreachable to an automated client.** `geoapps.nj.gov`
  sits behind Imperva bot protection — `HEAD` returns 200, `GET` returns a 403
  JavaScript challenge. Working around bot detection is out of scope, so acquisition
  uses the public REST API instead.
- **No parcel geometry**, so no parcel map layer. Attributes only.
- **10 municipalities unmatched**, all names MOD-IV truncated to fit a fixed-width field
  (Upper Saddle River, Parsippany-Troy Hills, South Orange Village, and seven others).
  Resolving them means a rule per place, which is guessing.
- **Assessed values are not market values**, and equalization ratios are not loaded.
- **Layer-level provenance is still approximate** for keyed sources: vintage is exact,
  but which file within a vintage carried a row can still be wrong.

## [0.7.0] — 2026-08-12

The pipeline reaches its last stage. Analytics now emit a versioned, schema-validated
packet, and the same packet becomes a Markdown report and a printable page — two
independent readers for a contract whose eventual consumer is a model that has not been
chosen yet.

### Added
- **Milestone 6 — analysis packet `1.0`.** `hip.packets.schema` holds the Pydantic
  models that define the contract; `schemas/packet-v1.json` is generated from them,
  committed, and printed by `hip schema`. A test fails when the file and the models
  drift, and another validates real packets against the published file with
  `jsonschema`, as an external consumer would.
- **`hip.packets.assemble`** — `build_packet(session, region_id, window)` reading every
  number from `fact_metric_change`, `region_rankings`, and `fact_metric_observation`. A
  county packet is ~13KB: 15 metrics with rank, percentile, CAGR and provenance, the
  peer cohort, highlights, caveats, and the source releases behind the values.
- **`hip pack`** — the eighth and last pipeline stage. Writes
  `data/packets/<window>/<region_id>.json` for every region at a level, and with
  `--report` also `reports/regions/<window>/<geoid>.md`. 21 county packets and reports
  on this warehouse. Each packet is re-parsed from the bytes about to be written before
  the file is created.
- **`GET /regions/{id}/packet` and `GET /regions/{id}/report`** — the packet as JSON and
  as `text/markdown`, both assembled from Postgres per request rather than served from
  the files `hip pack` writes, so neither can go stale.
- **Print-ready report page** at `/regions/[id]/report` — the same packet laid out for a
  screen and a sheet of paper, with a print stylesheet, a print button, and a link to
  the Markdown export. Reached from the region detail page.
- **Vitest in `web/`**, closing the gap Milestone 5 left open. 24 tests over
  `lib/format.ts` and the newly extracted `lib/scale.ts`, including a regression for the
  one-colour map: 21 same-signed values must land in five classes.
- **`hip schema`** prints the published packet contract, or writes it with `--write`.

### Changed
- `/regions/{id}/summary` now derives its caveats from `hip.packets.caveats`, the same
  function packets use. It returns more caveats than before; the dashboard and a packet
  reader can no longer be told different things about the same figure.
- `make test` runs both suites. `make test-py` and `make test-web` run one each.
- `make pipeline` ends with `hip pack --report`.
- Chart and map arithmetic moved out of the components into `web/lib/scale.ts`, and
  `RegionLevel`/`Window` out of three routers into `hip/api/params.py`. `nation` is now
  an accepted `level` on `/metrics` and `/regions`, which it always was in the warehouse.
- Tables inside a `.scroll-x` container now scroll on a narrow screen instead of
  compressing every cell to three wrapped lines.

### Fixed
- `hip validate` and `hip pack` resolve `reports/` through `Settings.reports_dir`
  instead of rebuilding the path from `data_dir.parent` inline.
- Documentation drift: the API table left `/rankings`, `/compare`, and
  `/regions/{id}/summary` unmarked though Milestone 4 shipped them, described `/compare`
  as taking several metrics when it takes one, claimed the derived tables were unbuilt,
  and promised a 503 from ranking endpoints that nothing implements.

### Known gaps
- **A fact's `release_id` names the right source but not always the right vintage.**
  Found by reading a packet's sources: the loader keys releases by `(source, layer)`,
  which is not unique for a source with several vintages, so all of ACS's five vintages
  cite one release. Every affected packet now carries a caveat naming the sources. The
  fix means carrying each row's source file through staging — five dbt models, the
  matcher, and the loader — and is scheduled rather than accepted.
- No cross-region packet: comparing two counties means two packets.
- The dashboard's tests cover arithmetic only; no test renders a page.

## [0.6.0] — 2026-08-12

The warehouse gets a face. Two pages, no map library, no charting library, no tile
server — the dashboard renders from our own GeoJSON and works offline.

### Added
- **Milestone 5 — overview page.** County choropleth of five-year change drawn as inline
  SVG, beside a ranking table. Clicking a county opens its detail page.
- **Region detail page.** Metric tiles with change and rank, trend charts for home
  values, rents, and income, the ancestor breadcrumb, and the caveats that qualify the
  numbers.
- **Table view under every chart**, listing each observation with its source and match
  method. It is the accessible fallback and it satisfies the relief rule for the one
  palette step below 3:1 on the light surface.
- **Validated palette** as CSS custom properties, light and dark both selected rather
  than one flipped into the other. The three categorical slots clear all-pairs CVD and
  normal-vision floors in both modes; checked with a validator before any chart was
  drawn, not by eye.

### Fixed
- The choropleth rendered every county the same colour. A diverging ramp centred on zero
  is wrong when no value crosses zero — NJ home values rose in all 21 counties — so the
  component now selects a sequential ramp in that case and uses quintile breaks instead
  of fixed thresholds.
- `next/link` inside `<svg>` renders an HTML anchor, which is invalid there; the browser
  relocated it and React reported a hydration mismatch. Replaced with SVG's own anchor.
- Passing `formatValue` as a prop into a client chart failed: functions cannot cross the
  React server/client boundary. Pure formatters moved to `web/lib/format.ts`.

### Known gaps
- Only the county level has a choropleth; municipalities and ZIPs do not.
- No side-by-side comparison UI, though `/compare` exists to serve one.
- No pan, zoom, or basemap — the deliberate cost of shipping without a map library.

## [0.5.0] — 2026-08-12

Allocation stops guessing. ZIP data is now weighted by where people actually live, and
affordability can cite a published policy benchmark.

### Added
- **Milestone 9 — HUD USPS crosswalk.** `type=2` (zip-county) and `type=11`
  (zip-countysub) residential-address ratios. 2,456 of 2,491 NJ crosswalk rows now use
  HUD weights; 35 keep area weighting where HUD has no coverage.
- **HUD income limits.** `hud_area_median_income` and `hud_income_limit_80` (4-person
  household) per county per year, 2020–2024.
- **`price_to_ami`** — typical home value against HUD's published area median income,
  the benchmark housing agencies use, alongside the ACS-survey-based
  `price_to_income`.

### Changed
- ZIP allocation is residential-address weighted where HUD covers the pair. Area
  weighting assumed a metric spreads evenly across a ZIP's surface, which counts a golf
  course like a subdivision. Every ZIP-derived figure changes as a result.
- `SourceAdapter.headers` is no longer a `ClassVar`, so an adapter needing per-instance
  credentials can override it without mutating state shared by every other source.

### Known gaps
- AMI affordability is county-only; HUD publishes no municipal income limits.
- Fair Market Rents and CHAS are approved in SPEC but not fetched.

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
