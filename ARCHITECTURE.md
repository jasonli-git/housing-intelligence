# Housing Intelligence Platform — Architecture

How the platform is built and why it is built that way: the storage tiers, the module
boundaries, the warehouse schema, the pipeline stages, and the decisions behind each.
[SPEC.md](SPEC.md) is the source of truth for *what* the system does and for Version 1
scope; this document does not restate it.

> **Status (2026-08-13):** Milestones 0 through 7 and 9 are complete. The warehouse
> holds a NJ geography spine (3,365 regions; 2,491 ZIP allocation weights, 2,456 of them
> HUD residential-address ratios; 554 NJ municipal codes in `region_identifiers`) and
> **335,927 observations across 23 metrics from 10 sources**, spanning 1971 to 2026 at
> nation, state, county, municipality, and ZIP level — loaded through all eight stages,
> `acquire → land → stage → geocode → validate → load → analyze → pack`, served by the
> API, and displayed by a three-page dashboard. 19,527 computed changes, 19,517 change
> rankings and 8,302 value rankings. **3.48M NJ parcels** live in Parquet and DuckDB and
> reach the warehouse only as six municipality-level assessment aggregates (#49). Packet
> `1.1` is validated against `schemas/packet-v1.json`; 21 county and 564 municipal
> packets are produced by `hip pack`. 223 Python tests and 26 dashboard tests pass,
> `tsc --noEmit` is clean. **Version 1 is complete (Milestone 8, #56-#64).** Eight local
> models across two runtimes answered five standardized scenarios over three real county
> packets — 120 generations, 105 usable — with every stated figure checked against its
> packet deterministically and 105 rubric judgments from `claude-opus-5`. **Gemma 4 E4B
> (Q4_K_M, Ollama) was selected** on measured performance: 3.21/4.00, 0.0% unsupported
> figures, 28.6 tok/s. It wrote the 21 county explanations in `region_explanations`
> (migration `0007`), served by `GET /regions/{id}/explanation` and shown as
> interpretation in the dashboard. Nothing in the pipeline or the API depends on a model
> being present: with the table empty, every page and endpoint still works.

## System Shape

A local-first, single-machine analytical platform: a staged batch pipeline that builds a
curated housing warehouse, with a read-only web application served on top of it.

- **Runtime** — Python 3.12+ for acquisition, ETL, validation, and analytics, driven by
  a Typer CLI. dbt-core owns the warehouse transform DAG. FastAPI serves the HTTP API.
  Next.js (TypeScript) serves the dashboard and maps.
- **Storage, three tiers** — Parquet holds immutable raw landings and history; DuckDB is
  the in-process transform engine over those Parquet files; PostgreSQL + PostGIS is the
  curated warehouse and the only thing the API reads.
- **Boundary** — the pipeline writes, the API reads. No HTTP request triggers a pipeline
  stage, and no pipeline stage calls the API. They share the database, not code paths.
- **External dependencies** — public HTTP endpoints only: Zillow research CSVs, Census
  ACS and Building Permits, FHFA HPI, FRED, BLS, IRS SOI migration, and NJGIN parcel /
  MOD-IV extracts. Each is reached through one source adapter, and every download is
  cached to disk so a full rebuild never re-fetches.
- **No cloud service is required.** Docker Compose provides Postgres/PostGIS; Python and
  Node run natively.
- **No LLM in the Version 1 runtime.** The analytics layer emits analysis packets as
  JSON artifacts that currently have no consumer. See decision #11.

Future deployment shapes stay cheap because of where the seams are. The API reads
Postgres through SQLAlchemy and holds no DuckDB or Parquet dependency, so moving to a
managed Postgres is a connection-string change. dbt targets abstract the execution
engine, so promoting a transform from DuckDB to warehouse-side SQL is a config edit, not
a rewrite. Source adapters expose one method — fetch a release, return a local path — so
swapping local disk for object storage replaces the storage backend and leaves all
adapters untouched. `web/` is a separate deployable that only knows the API's base URL.
Geographic expansion beyond New Jersey is a `config/geography.yml` scope change plus new
source adapters, because no state code is hard-coded into schema or analytics (#14).

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Three storage tiers: Parquet lands raw data, DuckDB transforms it, Postgres serves it. | Each tier does the one thing it is best at, and each stage persists before the next begins (SPEC principle 6). Rejected: single-Postgres, which turns 3M+ parcel rows into slow bulk loads and makes reprocessing mean re-downloading; and Parquet+DuckDB only, which leaves no concurrent-reader database for the API. Costs a data copy at each boundary and a schema definition maintained in two places. |
| 2 | PostgreSQL 16 + PostGIS is the serving warehouse. | The API needs concurrent readers, real constraints, transactional reloads, and spatial queries for map endpoints. Rejected: serving DuckDB files directly — single-writer, no network protocol, and file locking fights the pipeline. Costs one service to run, hence #13. |
| 3 | DuckDB is the transform engine, reading Parquet in place. | Columnar, out-of-core, zero setup, and it reads the landing tier without an import step. Rejected: pandas (dies on parcel-scale files) and Spark (operationally absurd for one machine). Costs a second SQL dialect alongside Postgres. |
| 4 | dbt-core owns warehouse transforms; the Typer CLI owns acquisition and loading. | Transforms are declarative SQL with dependency ordering, tests, and lineage handed to us; acquisition is imperative I/O with retries and credentials, which dbt models badly. Rejected: hand-rolled SQL runner, which means rebuilding lineage and testing. Costs a second tool and a split mental model of where logic lives. |
| 5 | FastAPI for the API, Next.js + TypeScript for the dashboard, split across a network boundary. | The API is a first-class deliverable per SPEC ("public analytics API"), and a network boundary forces it to be genuinely usable rather than an internal function call. Rejected: Streamlit (no API surface, weak map interaction) and server-rendered Jinja + HTMX (simpler deploy, but map/chart interaction fights the model). Costs two toolchains and CORS/config handling. |
| 6 | The API is strictly read-only; every write path is a CLI command. | Refresh runs are long, memory-hungry, and must not be triggerable by a page load (SPEC principle 6). Also means the API can be given a read-only Postgres role. Costs: no "refresh now" button — refresh is a terminal command or a cron entry. |
| 7 | One `regions` table holds every geography level, keyed by a surrogate `region_id` over `(level, geoid)`. | Facts reference one column regardless of level, so a query never needs to know whether it is looking at a county or a tract, and a new level is rows rather than tables. Rejected: per-level tables and per-dataset geography columns, both of which force every join and every analytic to branch on level. Costs a join to get human-readable names. |
| 8 | Metrics live in one long fact table keyed `(region_id, metric_id, period_start)`, not wide per-source tables. | Adding a source that supplies an existing metric adds rows, not columns, so no migration and no analytics change. Rankings and comparisons become one query shape across all metrics. Rejected: wide tables per source, which are pleasant to read and require a migration per source. Costs: reads need pivoting, and the table is the largest in the warehouse — mitigated by the composite primary key and a `metric_id, period_start` index. |
| 9 | Every fact row carries a `release_id` pointing at the exact source file it came from. | Provenance is a SPEC requirement, and it makes a bad load reversible: delete the release, its facts cascade. Rejected: source-name-only columns, which cannot distinguish two vintages of the same source. Costs 8 bytes per row and a mandatory release record before any load. |
| 10 | Raw downloads are immutable and content-addressed; a re-fetch that differs is a new release, never an overwrite. | Reproducibility, and it makes upstream revisions visible instead of silent — Zillow and ACS both revise history. Rejected: overwrite-in-place, which is smaller and destroys the audit trail. Costs disk that grows monotonically; pruning is manual and deliberate. |
| 11 | The local LLM runtime is deferred. Version 1 emits analysis packets and stops there. | The packet contract is what matters and it is testable without a model; picking Ollama vs. llama.cpp vs. LM Studio before the eval scenarios exist would be choosing on reputation, which SPEC principle 9 rejects. Rejected: wiring Ollama now for a demo. Costs: no explanation feature ships in V1, and the packet schema gets its first real consumer only in M8. |
| 12 | Analysis packets are versioned JSON artifacts validated against a published schema. | A stable, small contract keeps the AI layer replaceable (SPEC principle 8) and lets packets be diffed, tested, and stored as fixtures. Rejected: building prompt strings directly in the analytics layer, which welds the model to the metrics. Costs a schema to version and migrate. |
| 13 | Docker Compose runs Postgres/PostGIS only; Python and Node run natively. | One reproducible command for the piece with real setup cost, without containerizing the code under active edit. Rejected: full containerization (slow rebuilds, painful debugging) and native Postgres via Homebrew (setup instructions become machine-specific). Costs: Docker is a prerequisite. |
| 14 | Geographic scope is config, not code: `config/geography.yml` declares which states and levels are in scope. | NJ-first, not NJ-only (SPEC principle 3). A hard-coded `WHERE state = 'NJ'` in analytics is the thing that makes expansion an architecture change. Costs a config indirection that is pure overhead while only one state is loaded. |
| 15 | Validation is a distinct gate stage that can block the load, not a set of assertions scattered through ETL. | A failed load is worse than a skipped one, and the gate is where "is this release sane" is answered once. **Corrected 2026-08-13:** this row used to say Pandera checked shapes at the DuckDB boundary and dbt tests checked the warehouse after load. Neither is true — Pandera is not a dependency and never was, and dbt's 15 tests run inside `hip stage` against DuckDB, before the load rather than after it. The gate is hand-written DuckDB SQL in `hip/validate/gate.py`, declarative in the sense that each check reports its own name and count. Costs a stage that will occasionally block on a real-but-unusual upstream change. |
| 16 | Parcel and MOD-IV data stay in Parquet/DuckDB; only aggregates are promoted to Postgres. | NJ has roughly 3.5M parcels with wide records — worth analyzing, not worth serving row-by-row from the API in V1. Rejected: loading all parcels into Postgres, which inflates the warehouse and the backup for a feature nothing yet consumes. Costs: parcel-level API endpoints are impossible until this is revisited, which is a post-V1 item in [ROADMAP.md](ROADMAP.md). |
| 17 | `uv` manages Python dependencies and the virtualenv; the lockfile is committed. | Fast, single-tool resolution and a reproducible environment for anyone cloning the repo. Rejected: Poetry (slower) and bare pip + requirements.txt (no real lock). Costs a tool that is newer than pip. |
| 18 | The Python patch version is pinned in `.python-version` (3.12.13), not just `>=3.12` in `pyproject.toml`. | Found the hard way on 2026-08-10: uv resolved Python through a `cpython-3.12` symlink and wrote that path as `home` in `pyvenv.cfg`, while CPython resolved the symlink to `cpython-3.12.13`. The mismatch stopped CPython recognizing the venv, which silently disabled `.pth` processing and broke *every* editable install — surfacing only as `ModuleNotFoundError: No module named 'hip'` after an unrelated `uv sync`. Pinning the patch makes uv record the resolved path. Costs a pin to bump on upgrades, and it is a workaround for an environment bug, not a fix for it. |
| 19 | dbt lives in its own `dbt` dependency group, not in the main dependencies. | dbt-core carries a large pinned tree of its own; keeping it out of the default resolution stops it from constraining FastAPI, Pydantic, and SQLAlchemy versions later. They currently co-resolve cleanly, so this costs nothing today and buys an escape hatch when they stop. Costs: `uv sync` alone gives no dbt — `make setup` installs both groups. |
| 20 | Tests import `hip` from `src/` via pytest's `pythonpath`, not via the editable install. | A broken editable install then fails loudly at `uv sync` instead of showing up as a collection error in every test file — which is exactly how #18 first presented, and it cost real time to trace. Costs a second import mechanism that must stay in step with the package layout. |
| 21 | Municipalities key on Census County Subdivision (MCD) FIPS; NJ's own municipal code is stored in `region_identifiers`. | Keeps municipalities on the same GEOID scheme as every other level, so ACS, Zillow, and Building Permits join with no reconciliation — federal sources outnumber state ones. Rejected: keying on the NJ municipal code, which would force a crosswalk for every federal source and has no analogue in other states. Storing both rather than choosing one costs a small table and removes the need to ever revisit. `region_identifiers` stays empty until Milestone 7 supplies MOD-IV. |
| 22 | Boundary geometry comes from Census TIGER/Line, currently the 2025 vintage. | TIGER's GEOIDs *are* the join keys the largest sources use, so geometry and attributes agree by construction. Rejected: NJGIN's authoritative NJ boundaries — higher fidelity, but needs a GEOID crosswalk for every federal source and does not generalize past NJ. Costs generalized boundaries and a 635MB initial download, 529MB of which is the national ZCTA file Census stopped partitioning by state after 2020. |
| 23 | `hip/config.py` and `hip/duck.py` are infrastructure leaves, importable from any module. | `hip.landing` needs DuckDB to read shapefiles in place, and landing importing `hip.transform` would run backward along the pipeline. Making the DuckDB session a leaf resolves that without weakening the rule for anything that carries pipeline logic. Costs two modules exempt from the ordering check; the boundary test names them explicitly so the exemption cannot spread by accident. |
| 24 | The Makefile exports `PYTHONPATH=src`; nothing depends on the editable install's `.pth` file. **Supersedes #18.** | #18 blamed a stale interpreter symlink. The real cause: `uv` sets macOS's `UF_HIDDEN` flag on every `.pth` file it writes, and CPython's `site.py` (3.12, line 176) silently skips hidden `.pth` files — so `import hip` broke after every sync, including syncs triggered implicitly by `uv run`. No `.pth`-based fix survives, because uv re-hides the file each time. `PYTHONPATH` sidesteps `.pth` entirely and is portable. The `.python-version` pin from #18 is harmless and stays; its stated rationale was wrong. `make venv-fix` clears the flag for anyone running bare `uv run hip`. |
| 25 | Regions are upserted on `(level, geoid)` and never deleted and reinserted. | `region_id` is a surrogate key every future fact row will reference. A reload that reassigned ids would silently repoint every metric in the warehouse at the wrong place — the worst class of bug here, because nothing would error. Costs an upsert path plus insertion in parent-before-child order, since the parent lookup is inline. |
| 26 | ZIP→municipality and ZIP→county weights are computed by **area** overlap, in EPSG:5070. | Self-contained and needs no credential, so the crosswalk exists from day one. Equal-area projection because computing on raw 4269 degrees shrinks a degree of longitude with latitude and biases every weight. Rejected *for now*: HUD's USPS crosswalk, which is residential-address-weighted and genuinely better for housing — it needs a registered API key, so adopting it silently was not an option. `method` is stored per row so both can coexist and be compared; the seam is the `method` column. |
| 27 | Geography resolution is recorded per fact in `match_method`, and unresolvable source geographies are **rejected, not guessed**. | Zillow publishes no FIPS below county level, so municipalities can only be matched by name. New Jersey has co-located pairs (Chatham Borough / Chatham Township) that a name+county key cannot separate, and stripping legal-form suffixes merges genuinely different places (Boonton vs Boonton Township, Egg Harbor City vs Egg Harbor Township). Picking one silently puts a real number on the wrong town, which is worse than a gap — the platform's whole claim is that a figure can be trusted. Costs ~29% of municipalities having no Zillow data; `source_match_reject` and `/sources/unresolved` say which and why. |
| 28 | Ambiguity is rejected on **both** sides of the join, not just the lookup side. | Found by the validation gate, which blocked a load with 318 duplicate `(region, metric, period)` rows. Checking only for two municipalities sharing a name missed the mirror case: two *source* rows collapsing onto one municipality after normalization. Both directions are fatal and both are now tested. |
| 29 | dbt models select Zillow's date columns by the pattern `YYYY-MM-DD` rather than excluding a known identifier list. | Zillow's identifier columns differ per level — ZIP files carry a `City` column that county and city files do not — and a new date column appears every month. An exclude-list broke immediately on the first and would have silently stopped importing new months on the second. Costs nothing; the pattern is stable. |
| 30 | National series get a `nation` region level and a synthetic `US` region, rather than a separate table. | FRED's mortgage rate has no regional breakdown, but every fact needs a region. One enum value and one row keep national data in the same fact table, endpoints, and provenance path as everything else (#7). Rejected: a parallel `fact_national_observation` that every cross-level query would have to union; and attaching the rate to New Jersey, which would record a national figure as a state measurement. Costs a nullable `regions.geom` — the US region has no boundary. |
| 31 | Sources publishing an exact identifier bypass the matcher entirely; only Zillow is name-matched. | ACS, permits, BLS, IRS, and FHFA all ship FIPS or a state code, so their dbt models emit `(geoid, level, match_method)` directly and are unioned in. Running them through the fuzzy matcher would invent ambiguity that does not exist. The payoff is concrete: ACS publishes county-subdivision GEOIDs, which took municipal coverage from 403/564 to **564/564**. |
| 32 | Range checks tolerate a small share of out-of-range values instead of failing on the first. | ACS genuinely publishes a $99 median gross rent for Alexandria Township, where the renter sample is a handful of households — real, published, and useless, but not a parsing bug. Blocking a 330,000-row load over two such rows makes the gate an obstacle; ignoring a third of a metric makes it decoration. A metric now fails only above both an absolute floor (5 rows) and a share (0.1%). Costs: a genuine small-scale corruption under both thresholds would pass. |
| 33 | Fact provenance falls back from `(source, layer)` to `(source)` when a keyed model's level does not name its release layer. | ACS municipal rows are staged as `municipality` but arrive in the `cousub` release, so an exact layer match dropped them silently. The fallback never attributes a value to the wrong *source*; it loses layer precision for keyed sources. The exact fix is to carry the release layer through staging, which needs the globbed models to record which file each row came from. |
| 34 | Computed metrics are ordinary facts under a synthetic `hip_derived` source, one release per `analyze` run. | Affordability ratios are metrics, so #8 says they are rows in `fact_metric_observation`, not a new table — and #9 says every fact names a release. A synthetic source satisfies both and makes a derived figure traceable to the run that produced it. Rejected: a separate `fact_derived` table, which would split every metric query in two, and a nullable `release_id`, which would weaken the provenance guarantee for measured values too. |
| 35 | Change windows are anchored on `period_end`, never `period_start`. | An ACS 5-year estimate begins four years before it ends. Anchoring on `period_start` labelled a comparison of the 2019 and 2023 vintages as "2015 to 2019" — a real span of eight years reported as four. Anchoring on `period_end` makes the recorded window match its label, and recovered 3,333 additional change rows by aligning sources with different frequencies. |
| 36 | Rankings are computed on `pct_change` within a level, ordered by the metric's own `direction`. | "Fastest rising" is the question a ranking answers, and comparing a county's home value against a ZIP's is meaningless. Taking direction from `metrics` means rank 1 is the better end wherever "better" is defined, without every caller re-deriving it. Costs: a `neutral` metric is ordered by largest increase, which is presentation rather than judgment. |
| 37 | HUD residential-address ratios supersede area weights per `(zip, target level)`; area survives only where HUD has no coverage. **Supersedes the coexistence claim in #26.** | Area weighting assumes a metric is spread evenly across a ZIP's surface, which counts a golf course like a subdivision; HUD weights by the share of a ZIP's dwellings. #26 said `method` would let both coexist and be compared — the primary key on `(from_region_id, to_region_id)` does not permit it, so one method wins per pair. 2,456 of 2,491 NJ crosswalk rows are now HUD; 35 remain area. `method` still records which produced every row. |
| 38 | HUD's bearer token lives on the adapter instance, not the class. | `SourceAdapter.headers` was a `ClassVar`, which a per-instance credential cannot override without mutating shared state for every adapter. Making it a plain class attribute lets HUD set its own on the instance while everything else inherits the default User-Agent. |
| 39 | Choropleths and charts are inline SVG drawn from our own GeoJSON — no map or charting library. | A tile server or charting CDN puts a third-party in the render path of a platform whose premise is local-first (SPEC principle 7); the dashboard now works with the network off. Rejected: MapLibre (needs a tile source, and a keyed provider is a dependency the project spent four milestones avoiding) and Recharts (~500KB, and its styling fights the provenance annotations every value here carries). Costs: no pan, zoom, or basemap, and axis and tooltip logic written once by hand. MapLibre becomes worth revisiting when parcels arrive at Milestone 7. |
| 40 | The choropleth picks its colour ramp from the data, not from the metric. | Percentage change is signed, so a diverging ramp is right *when values straddle zero*. NJ home values rose in all 21 counties over five years, and a diverging ramp centred on zero painted every county the same step — a map conveying nothing. The component now uses the sequential single-hue ramp when every value shares a sign, and quintile breaks rather than fixed thresholds, so it separates the regions it actually contains. |
| 41 | Value formatters live in `web/lib/format.ts`, apart from `web/lib/api.ts`. | Functions cannot cross the React server/client boundary as props, and passing `formatValue` into the client chart failed at render. Splitting the pure formatters from the fetch layer lets a client component import one without pulling the API base URL into the browser bundle. |
| 42 | The packet endpoints assemble from Postgres per request; `hip pack` writes files that the API never reads. | One assembler, two callers. A cached file served as current would go stale the moment the pipeline ran without a re-pack, and staleness in the artifact whose whole purpose is provenance is the worst place to have it. Packets are small — 15 metric rows and five queries — so assembling per request costs less than reconciling a cache. Rejected: serving `data/packets/<window>/<id>.json`, which would also give the read-only API a filesystem dependency it does not otherwise have. Costs: five queries per request instead of one file read. |
| 43 | The published JSON Schema is generated from the Pydantic models and committed to `schemas/packet-v1.json`, with a test that fails on drift. | The models must be the single definition or the two disagree, but a consumer in another language needs a file, not a Python import. Generating and committing gives both, and the drift test is what stops the committed copy from quietly becoming fiction. `hip schema --write` regenerates. Rejected: hand-writing the schema (drifts immediately) and generating at build time (nothing to review in a diff). Costs a regeneration step whenever a field changes. |
| 44 | A packet carries no wall-clock field. | Regenerating from an unchanged warehouse produces byte-identical output, so `diff` between two packs answers "what changed in the data" rather than "when did I run this" — which is what makes packets usable as test fixtures and as an evaluation corpus at Milestone 8. When the data was gathered is a property of the releases, and every packet carries `sources[].fetched_at`. Rejected: a `generated_at` field, which would make every regeneration differ in a field nobody reads. |
| 45 | The exportable report is Markdown rendered from the packet, with the dashboard's report page as a second view of the same contract. | Markdown is readable as text, diffable between runs, and opens anywhere; the browser's own print dialog turns the page into a PDF. Rejected: WeasyPrint or headless Chromium, which is a heavy rendering dependency for a file the browser already produces (the same reasoning as #39). The two renderers are not duplication — they are two media over one contract, which is the first real demonstration that the packet is a contract at all. Costs: a value formatter written once in Python and once in TypeScript. |
| 46 | Caveat derivation lives in `hip.packets.caveats` and `/regions/{id}/summary` calls it. | The router kept its own copy from Milestone 4, so a model reading a packet and a person reading the dashboard could be told different things about the same figure. `api` may import `packets` (the boundary rule allows exactly this), so one pure function serves both. Costs: `/summary` now returns more caveats than it did, which is the correction, not a regression. |
| 47 | Release provenance names the right source but not always the right vintage. **Refines #33; fixed by #53 at Milestone 7.** | #33 blamed a layer-matching fallback. The real defect is narrower and worse: `_release_ids` keys releases by `(source_id, layer)`, which is not unique when a source publishes several vintages — ACS has ten releases across five vintages, HUD has 107 — so all but one collapse and every year's fact points at the survivor. Every ACS observation for a region currently cites vintage 2019. Found by building a packet and reading its sources. The fix is to carry each row's source file through staging (the ACS model already extracts a vintage from the filename) and key releases on `(source, layer, vintage)`; that touches five dbt models, the matcher, and the loader, so it is scheduled work rather than a patch. Until then packets say so in a caveat naming the affected sources. |
| 48 | Chart and map arithmetic lives in `web/lib/scale.ts`, tested with Vitest. | The one-colour map (#40) shipped because the classifier could not be called without rendering a component. The ramp choice, the quintile breaks, the class assignment, and the chart's projection are pure functions, so they are now tested directly — including a regression asserting that 21 same-signed values land in five classes. Node environment, no jsdom: the bugs were arithmetic, not markup. Costs one dev dependency in `web/`. |
| 49 | NJ parcels are acquired from the ArcGIS Feature Service, not the 943MB bulk geodatabase. | NJGIN publishes the whole composite as one file at `geoapps.nj.gov`, which would be a single download. That host sits behind Imperva bot protection: `HEAD` returns 200, `GET` returns a 403 JavaScript challenge. Defeating bot detection is not something this project does, and the Feature Service is a public API meant to be queried programmatically, so acquisition goes there. Costs 1,741 requests and ~32 minutes instead of one download, and forgoes parcel geometry, which the REST path would make enormous. `_fetch_bytes` is the seam if the file ever becomes reachable — everything downstream reads NDJSON and would not change. |
| 50 | The parcel layer is paged by `OBJECTID` window, never by `resultOffset`. | Measured 2026-08-12: a 2000-row page at offset 0 takes 0.76s and the same page at offset 1,500,000 takes 26.7s, because the server materializes and discards every skipped row. An indexed `OBJECTID >= lo AND OBJECTID < hi` window is ~1.0s at any depth. Offset paging would have taken roughly 13 hours against 32 minutes. A window that reports `exceededTransferLimit` splits in half rather than dropping the overflow — defensive, since `OBJECTID` is dense today (max id equals row count). |
| 51 | MOD-IV matches Census municipalities on the legal form, and the county half resolves by arithmetic. | NJ county codes run 01-21 alphabetically and NJ county FIPS run odd and alphabetically, so `FIPS = 2*code - 1` needs no name at all. For the municipality half MOD-IV carries the legal form — "BOONTON TWP" against "BOONTON TOWN" — which is exactly what Zillow lacks and exactly what separates Boonton town from Boonton township (#27, #28). 554 of 564 match one-to-one with **zero ambiguity on either side**, against Zillow's 403 ceiling. The 10 misses are MOD-IV truncations from a fixed-width field ("UPPER SADDLE RIV", "PARSIPPANY TR HLS"); a rule per place would be the guessing #27 rejects, so they are reported instead. |
| 52 | Rankings carry a `basis`: `change` over a window, or `value` at the latest observation. | MOD-IV publishes one composite, so its metrics have no change and would have loaded correctly and then been invisible to `/rankings`, `/summary`, and every packet. `basis` also answers a question the warehouse never could — "which municipality is most expensive", not only "which rose fastest" — closing a Milestone 4 note. Both bases share one table (#8) because a second rankings table would split every ranking query in two. Costs an overloaded `window` column, which holds the literal `latest` for a value ranking since a level has no span. |
| 53 | Releases are keyed `(source_id, layer, vintage)`, resolved most-precise-first. **Fixes #47.** | `(source, layer)` was not unique for a source publishing several vintages — ACS has ten releases across five vintages, HUD 107 — so all but one collapsed and every year's fact cited the survivor. Every ACS observation claimed vintage 2019. Every staging model now carries `release_vintage`, read off the Parquet path by the `release_vintage()` macro, because landing writes `<source>/<vintage>/<layer>.parquet` for every source with no per-source knowledge. Lookup falls back `(source, layer, vintage)` → `(source, vintage)` → `(source, layer)` → `(source)`: vintage outranks layer, because the wrong *year* misstates when a thing was measured while the wrong layer of the right vintage only loses which file carried it. |
| 54 | Packet `1.1` adds `levels`; `metrics` keeps its exact 1.0 meaning. | A snapshot source has no change, so `metrics` — which reads `fact_metric_change` — could never carry it. `levels` holds the latest observation of every metric with its value rank, which is also the first migration the published schema has actually had to perform. Additive and backward-compatible: a 1.0 reader parses a 1.1 packet and simply does not see the new array, which is what the minor version signals. A packet with levels and no changes is now valid, because that is what a MOD-IV-only municipality genuinely looks like. |
| 55 | `mlx-lm` lives in its own optional `mlx` dependency group, and local models are never a runtime dependency. | Same reasoning as #19: mlx pins its own numpy/transformers tree, which must not constrain FastAPI, Pydantic, and SQLAlchemy, and a non-macOS checkout must still `uv sync` everything else — mlx is Apple-silicon only. `make setup` installs `dev` and `dbt` and deliberately not this. It also fixes a real break: an earlier `python3 -m pip install mlx-lm` landed on the system Python 3.9.6, EOL since October 2025 and a different interpreter from the project's; the group puts `mlx-lm` 0.31.3 / `mlx` 0.32.0 in the 3.12.13 environment the rest of the code uses. Costs one more group to remember, and the Milestone 8 harness must degrade rather than fail when the group is absent (#11 still holds — nothing in the Version 1 runtime imports a model). |
| 56 | The evaluation is a pipeline stage (`eval`) after `packets`, and `anthropic` lives in an optional `eval` dependency group. | A packet is the entire contract a model may see, so the stage that feeds models belongs after the stage that builds them, and the boundary test enforces it: `eval` may read `packets` and `warehouse`, and nothing may import `eval`. The group keeps the judge out of the application dependencies because SPEC requires the platform stay fully useful with the AI layer disabled — no runtime import path may need an LLM client present. Costs: `uv sync` with an explicit group list *removes* unlisted groups, so `make setup` alone strips `mlx` and `eval`; `make setup-eval` installs all four. |
| 57 | Local models are reached through one `ModelRunner` protocol; Ollama and MLX-LM are two implementations of it. | SPEC principle 9 says the model choice follows measurement rather than reputation, which is only true if swapping a runtime is a config edit. Each implementation normalizes its own telemetry and is required to be honest about what it cannot report: MLX's `mx.get_peak_memory()` is a true allocator peak, Ollama exposes only process RSS, so `memory_basis` records which one a figure is instead of letting a reader assume they are comparable. Rejected: a single Ollama-only path, which would have made the MLX cohort unmeasurable and the runtime choice permanent. |
| 58 | Numeric accuracy is checked deterministically; the judge grades only what a reader can judge. | SPEC draws this line explicitly — Claude evaluates qualitative quality and does not replace deterministic validation. A set lookup is a better instrument than a language model for "is 4.7 in this packet", costs nothing per call, and cannot itself hallucinate, so hallucination *rate* — the number the selection turns on — is counted rather than graded. The judge scores grounding, caveat handling, and usability, which counting cannot reach. |
| 59 | A model that fabricates figures is ineligible regardless of its rubric score. | Selection is quality-ordered but gated: above a 5% unsupported-figure rate a model is excluded however well it writes. The platform's entire claim is that a figure traces to a source file, so an explainer that invents them is not a worse option — it is a disqualified one. A gate rather than another weighted term, because weighting lets a high clarity score buy back a fabrication. |
| 60 | Explanations are precomputed by `hip explain`, stored in `region_explanations`, and served read-only. | Generating at request time would put a multi-gigabyte model load in a page view, and on 16GB of unified memory a resident model means swap. Storing them keeps #6 intact — the CLI is still the only write path — and lets the row carry what makes generated text accountable: the model, the runtime, and `packet_sha256`, which pins the prose to the bytes it was written from so staleness is detectable rather than merely suspected. Nothing reads this table to compute anything; the arrow points out to the reader. |
| 61 | `packet_hash()` lives in `hip.packets`, not in the evaluation. | The API has to answer "is this explanation stale?" and may not import `eval` (the dependency rule). The hash is a property of the packet anyway, and it is meaningful precisely because a packet carries no wall-clock field (#44): it changes when the data changes and at no other time. |
| 62 | Every prompt reaches a model through that model's own instruct formatting: `tokenizer.apply_chat_template` on MLX, `/api/chat` on Ollama. | Both runtimes silently accept a raw string and neither warns. Untemplated, a model never sees the turn markers it was tuned on and never emits its end-of-turn token. Measured 2026-08-13 on Qwen3-8B, the matched anchor pair: templated Ollama stopped at 528 tokens with a clean answer while untemplated MLX produced the same opening and ran to the 3,000-token cap, inflating its stated-figure count from 89 to 1,461 and burying the answer past where refusal detection could see it. Ollama's `/api/chat` is byte-identical to `/api/generate` for a model whose renderer applies either way (verified on gemma-4-E4B: same 819 tokens, same text), and is the difference between output and silence for a thinking model — gemma-4-12B returned an empty string from the raw path for every prompt, including "Reply with exactly: OK". Rejected: hand-writing a template per model in the Modelfile, which puts the formatting in an import script rather than with the model that owns it. |
| 63 | `hip` loads `.env` into `os.environ` at startup. | `Settings` reads `.env` only for its own `HIP_`-prefixed fields; pydantic-settings exports nothing else. Every source credential and the judge key are resolved with `os.environ.get()`, so keys placed in `.env` — exactly where `.env.example`, the README, and the judge's own error message all say to put them — were invisible to the code that needed them, and had to be exported by hand. The documentation was right and the loader was missing. A real environment variable still wins, so an explicit export overrides the file and CI can inject secrets with no `.env` present. |
| 64 | The output-token budget is sized from measurement, and is uniform across every candidate. | It has to cover reasoning *and* answer, because a reasoning model spends it before emitting a word. Raised twice from evidence: 1600 truncated Qwen3-8B after 5,747 characters of reasoning into an empty answer; 3000 left gemma-4-12B returning nothing on 8 of 15 scenarios. At 6000, gemma-4-12B stops cleanly on 9 of 15. Uniform because a per-model budget reintroduces the confound the anchors exist to remove — and uniformity is cheap here, since deterministic sampling means a model that stops at 826 tokens produces byte-identical output at any higher cap, so raising it only requires re-running the models that actually hit it. |
| 65 | Every storage location is a setting, never a path derived from another setting. | `reports_dir` was `data_dir.parent / "reports"`, which was right only while `data_dir` sat in the repo: pointing `HIP_DATA_DIR` at an external volume silently moved `reports/` there too, taking the 21 git-tracked county reports and the README's links to them off the repo. It is now `HIP_REPORTS_DIR`, defaulting to the repo root — byte-identical to what the old expression returned at the default, so nothing moves for anyone who does not set it. Postgres follows the same rule through `HIP_PGDATA` in `docker-compose.yml`, defaulting to the existing `pgdata` named volume. Rejected: deriving the Postgres path from `HIP_DATA_DIR`, which would have relocated a loaded cluster the moment the data root moved and silently initialised an empty one. Costs three variables where there was one, and the relocation is opt-in rather than automatic — moving a path points Postgres at a different directory, it does not migrate what is already there. |
| 66 | Footprint is measured in `hip footprint`; wall clock, CPU, RAM, and I/O are left to `mac-sitrep`. | The two answer different questions and only one was covered. sitrep already profiles `make pipeline` and generates the README's Resource Requirements block, but it reports I/O *volume* — bytes moved during a run — while capacity planning needs *footprint*, the bytes still occupied afterwards, split by tier and by state. Postgres makes the gap concrete: it lives inside Docker's disk image, invisible both to sitrep's process accounting and to `du` against `data/`, and it is the tier that grows fastest with geography because geometry is stored per region. Rejected: a second timing harness inside `hip`, which would duplicate a working tool and produce a rival set of numbers in the same README. Costs a dependency on a Mac-only external tool for the throughput half, recorded as a limitation below. |
| 67 | Static artifacts are produced by replaying the API's own ASGI app, and `hip/publish.py` is the one module allowed to import `api`. | The published tree's whole claim is that `/regions/11/packet/5y.json` holds what `/regions/11/packet` serves. Replaying the app through `TestClient` makes that true by construction — response models, serialisation, float formatting, and null handling are the same code — where re-querying the warehouse in the publisher would be a second implementation of every endpoint, and the first one to change would break the promise with nothing to catch it. Narrows #6's "nothing imports api" rather than repealing it: the exception is one named path, and `test_only_the_publisher_imports_api` fails if a second importer appears, so the loophole cannot widen by accident. Rejected: publishing against a running server over real HTTP, which makes `make publish` depend on `make api` in another terminal. Costs the pipeline an import of FastAPI on the publish path only. |
| 68 | The dashboard is a static export, and HTML and data artifacts are deployed to two different origins. | `output: "export"` renders all 2,273 pages at build time, so production runs no Node server and no database — the same argument as #67, applied to the other half. Splitting the destinations is forced by measurement rather than taste: the export emits 11,375 files for 1,135 regions (one HTML plus four RSC payloads per page, 261MB), against 5,844 artifact files at 84MB. Static site hosts cap files per deployment — 20,000 free, 100,000 paid on Cloudflare Pages — while object stores do not, so HTML goes to the page host and the JSON tree to object storage, addressed by `NEXT_PUBLIC_ARTIFACT_URL`. Rejected: one origin for both, which fits New Jersey and breaks at the Northeast. Costs a second origin to configure, and a build-time warning because an unset artifact origin bakes `localhost` into every download link rather than failing at runtime. |
| 69 | The API's connection pool is sized explicitly at 20 with 20 overflow. | SQLAlchemy's default of 5 plus 10 was never chosen; it was never reached, because until the static export existed the only client was a dashboard serving one reader at a time. Six parallel export workers exhausted it in minutes: requests queued the full 30-second pool timeout, page renders passed their own 60-second deadline, Next retried them, and the retries kept the pool empty. The API stopped answering `/health` at all, and the build failed at 1,641 of 2,273 pages. 40 against PostgreSQL's default `max_connections` of 100 leaves room for psql and dbt while covering a fan-out wider than any human client. Rejected: capping the export's worker count, which hides a real defect — the first concurrent client found it, and a public deployment would have found it too. |

## Module Layout

What exists as of 2026-08-12. Every pipeline package now holds real modules; the
boundary rule in `tests/test_module_boundaries.py` enforces the import direction between
them. Planned files are marked with the milestone that adds them.

```text
housing-intelligence/
├── .python-version            # pinned patch version (#18)
├── config/
│   ├── sources.yml            # 13 sources: url, cadence, license, adapter name
│   ├── geography.yml          # in-scope states and levels (#14)
│   ├── metrics.yml            # 23 metrics: label, unit, frequency, direction
│   └── evaluation.yml         # candidates, scenarios, rubric, judge (#56)
├── schemas/
│   └── packet-v1.json         # published packet contract, generated from code (#43)
├── src/hip/
│   ├── cli.py                 # Typer entrypoint; check-config, schema, footprint, publish, 8 stages
│   ├── config.py              # settings, YAML loading, env resolution, STATE_FIPS
│   ├── duck.py                # DuckDB session + /vsizip path helper (#23)
│   ├── footprint.py           # bytes per storage tier and per state (#66)
│   ├── publish.py             # API surface rendered to static files (#67)
│   ├── sources/
│   │   ├── base.py            # SourceAdapter, retry, content-addressed cache (#10)
│   │   ├── registry.py        # which sources have adapters; PLANNED names the rest
│   │   ├── tiger.py           # Census TIGER/Line: 5 layers (#22)
│   │   ├── zillow.py          # ZHVI + ZORI over county, city, ZIP
│   │   ├── census_acs.py      # 5-year estimates at county and cousub (#31)
│   │   ├── census_permits.py  # Building Permits Survey, county annual
│   │   ├── fhfa.py            # hpi_master.csv — state level only
│   │   ├── fred.py            # MORTGAGE30US, national
│   │   ├── bls.py             # LAUS county unemployment
│   │   ├── irs_migration.py   # SOI county inflow/outflow, reduced to net
│   │   ├── hud.py             # USPS crosswalk + income limits (#37, #38)
│   │   └── nj_modiv.py        # 3.48M NJ parcels via OBJECTID paging (#49, #50)
│   ├── landing/
│   │   ├── shapefile.py       # zip → Parquet via ST_Read, geometry to MultiPolygon
│   │   └── tabular.py         # CSV/JSON/NDJSON → Parquet, format preserved
│   ├── transform/dbt_runner.py # runs dbt; STAGING_SCHEMA = main_staging
│   ├── geography/
│   │   ├── regions.py         # stg_regions: 5 levels, parent chain by geoid
│   │   ├── crosswalk.py       # ZIP allocation; HUD weights supersede area (#37)
│   │   └── matching.py        # source keys → regions; rejects ambiguity (#27, #28)
│   ├── validate/gate.py       # the load gate + JSON report (#15)
│   ├── warehouse/
│   │   ├── db.py              # engine, session_scope, probe() for /health
│   │   ├── models.py          # Region, RegionIdentifier, RegionCrosswalk
│   │   ├── load.py            # one-transaction upsert of spine and facts (#25)
│   │   └── migrations/        # Alembic 0001–0007
│   ├── analytics/compute.py   # change, CAGR, affordability, rankings (#34–#36)
│   ├── packets/
│   │   ├── schema.py          # Pydantic models = the contract (#12, #43, #44)
│   │   ├── assemble.py        # build_packet(session, region_id, window) (#42)
│   │   ├── caveats.py         # pure caveat derivation, shared with /summary (#46)
│   │   └── report.py          # render_markdown(packet) — pure (#45)
│   ├── eval/                  # Milestone 8: model evaluation + explanations (#56)
│   │   ├── types.py           # Scenario, Generation, CheckResult, Judgment
│   │   ├── scenarios.py       # questions x sampled packets, deterministic
│   │   ├── prompts.py         # packet → JSON or Markdown payload; prompt assembly
│   │   ├── normalize.py       # reasoning/answer split across both runtimes
│   │   ├── checks.py          # deterministic numeric verification (#58)
│   │   ├── runner.py          # the run loop: one model resident at a time
│   │   ├── runners/           # base protocol (#57), ollama.py, mlx_runner.py
│   │   ├── judge.py           # Claude rubric grading, Batch API
│   │   ├── store.py           # JSONL artifacts per stage, resumable
│   │   ├── report.py          # the published evaluation report (#59)
│   │   └── explain.py         # explanations for the selected model (#60)
│   ├── eval_cli.py            # `hip eval ...`; optional deps imported lazily
│   └── api/
│       ├── main.py            # FastAPI app, CORS for the dashboard origin
│       ├── deps.py            # read-only session dependency
│       ├── params.py          # RegionLevel and Window, shared by the routers
│       └── routers/           # health, regions, metrics, analytics, packets,
│                              #   explanations (#60)
├── dbt/
│   ├── dbt_project.yml        # staging = views, marts = tables
│   ├── profiles.yml           # duckdb (default) and postgres targets
│   ├── macros/                # zillow_observations, accepted_range,
│   │                          #   release_vintage (#53), nj_municipal_name (#51)
│   └── models/staging/        # 12 staging models + dbt tests
├── web/                       # Next.js 16 + React 19 dashboard
│   ├── app/page.tsx           # overview: choropleth + ranking table
│   ├── app/regions/[id]/page.tsx        # region detail: tiles, trends, tables
│   ├── app/regions/[id]/report/page.tsx # print-ready report from the packet (#45)
│   ├── components/            # Choropleth, TrendChart, PrintButton
│   ├── lib/api.ts             # server-side fetchers + packet types
│   ├── lib/format.ts          # pure value formatting (#41)
│   ├── lib/scale.ts           # ramp, breaks, projection — pure and tested (#48)
│   └── vitest.config.ts       # node environment, lib/**/*.test.ts
├── data/                      # gitignored, machine-local
│   ├── raw/                   # immutable downloads, content-addressed
│   ├── parquet/               # landing tier
│   ├── duckdb/                # working analytical database; 3.48M parcels live here
│   ├── packets/<window>/      # analysis packets, one JSON per region
│   └── eval/<run>/            # scenarios, generations, checks, judgments (JSONL)
├── reports/                   # human-facing output, not rebuildable input
│   ├── validation/            # gate reports per run; gitignored, per-run machine state
│   ├── regions/<window>/      # Markdown reports, one per region; 5y committed, README-linked
│   └── evaluation/            # the published model-evaluation report; committed
├── tests/                     # 223 Python tests; API tests skip without a warehouse
├── alembic.ini                # URL comes from hip.config, not from here
├── docker-compose.yml         # postgres + postgis only (#13)
├── Makefile                   # setup, db-up, migrate, pipeline, api, web, test, lint
└── pyproject.toml             # deps + dev / dbt / mlx groups (#19, #55)
```

**Dependency rule.** Imports flow one direction along the pipeline and never back:

```text
sources → landing → transform → geography → validate → warehouse → analytics
    → packets → eval
                   ↑
                 api (reads only)
```

`api` may import `warehouse` read models and `packets`, and nothing else from the
pipeline — including `eval`, which is why `packet_hash()` lives in `packets` (#61) — it must not be able to import `sources` or `transform`, which is what keeps
decision #6 true by construction rather than by discipline. Nothing imports `api`.
`web/` reaches the API over HTTP only and shares no code with Python. `config` and
`duck` are infrastructure leaves importable from anywhere (#23); every other cross-stage
import is a boundary violation. `cli` sits outside the chain and orchestrates all of it,
which is why every write path lives there.

## Warehouse Schema

**Every table below is built and populated.** Migration `0002` created `regions`,
`region_identifiers`, `region_crosswalk`, `sources`, and `source_releases`; `0003` added
`metrics`, `fact_metric_observation`, and `source_match_reject`; `0004` added the
`nation` level; `0005` added `fact_metric_change` and `region_rankings`; `0006` added
`region_rankings.basis` (#52). The fact table holds 335,927 observations, with 19,527
changes, 19,517 change rankings and 8,302 value rankings derived from them.
`region_identifiers`, empty since Milestone 1, now holds 554 NJ municipal codes under
scheme `nj_cd_code` — the join MOD-IV was always going to supply (#21, #51).
The migrations are authoritative for DDL and `src/hip/warehouse/models.py` carries the
ORM mapping for the spine; where they and the block below disagree, the migrations win —
in particular both derived tables carry a `"window"` column that this sketch predates.

`fact_metric_observation` carries one column the original sketch did not: `match_method`,
recording how the row's geography was resolved (`fips`, `zip_code`, `name_county`). See
#27 — a municipal value matched by name is a weaker claim than a county value matched by
FIPS, and a consumer must be able to tell them apart without redoing the join.

```sql
CREATE TYPE region_level AS ENUM
  ('state','county','municipality','zip','tract','parcel');

-- Every geography, every level, one table (#7).
CREATE TABLE regions (
  region_id   BIGSERIAL PRIMARY KEY,
  geoid       TEXT         NOT NULL,   -- Census GEOID, or source-native id
  level       region_level NOT NULL,
  name        TEXT         NOT NULL,
  state_code  CHAR(2)      NOT NULL,
  parent_id   BIGINT       REFERENCES regions(region_id),
  geom        GEOMETRY(MultiPolygon, 4269),
  UNIQUE (level, geoid)
);

-- ZIP↔municipality is many-to-many, so it cannot live in parent_id.
CREATE TABLE region_crosswalk (
  from_region_id BIGINT NOT NULL REFERENCES regions(region_id),
  to_region_id   BIGINT NOT NULL REFERENCES regions(region_id),
  weight         NUMERIC(8,6) NOT NULL,  -- allocation share, sums to 1.0 per from_id
  method         TEXT NOT NULL,          -- 'hud_res_ratio' or 'area' in practice
  PRIMARY KEY (from_region_id, to_region_id)
);

CREATE TABLE sources (
  source_id  TEXT PRIMARY KEY,           -- 'zillow_zhvi', 'census_acs'
  name       TEXT NOT NULL,
  publisher  TEXT NOT NULL,
  license    TEXT NOT NULL,
  url        TEXT NOT NULL,
  cadence    TEXT NOT NULL               -- 'monthly', 'annual'
);

-- One row per file we actually ingested (#9, #10).
CREATE TABLE source_releases (
  release_id  BIGSERIAL PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES sources(source_id),
  vintage     TEXT NOT NULL,             -- '2026-06', 'ACS 2020-2024'
  fetched_at  TIMESTAMPTZ NOT NULL,
  file_sha256 TEXT NOT NULL,
  row_count   BIGINT NOT NULL,
  UNIQUE (source_id, vintage, file_sha256)
);

CREATE TABLE metrics (
  metric_id   TEXT PRIMARY KEY,          -- 'zhvi_sfr', 'acs_median_hh_income'
  label       TEXT NOT NULL,
  unit        TEXT NOT NULL,             -- 'usd', 'usd_month', 'count', 'ratio'
  frequency   TEXT NOT NULL,             -- 'monthly', 'annual'
  direction   TEXT NOT NULL,             -- 'higher_is_better' | 'lower_is_better' | 'neutral'
  description TEXT NOT NULL
);

-- The one fact table (#8).
CREATE TABLE fact_metric_observation (
  region_id    BIGINT NOT NULL REFERENCES regions(region_id),
  metric_id    TEXT   NOT NULL REFERENCES metrics(metric_id),
  period_start DATE   NOT NULL,
  period_end   DATE   NOT NULL,
  value        DOUBLE PRECISION NOT NULL,
  release_id   BIGINT NOT NULL REFERENCES source_releases(release_id) ON DELETE CASCADE,
  PRIMARY KEY (region_id, metric_id, period_start)
);
CREATE INDEX ON fact_metric_observation (metric_id, period_start);

-- Analytics output: derived, always rebuildable, never a source of truth.
CREATE TABLE fact_metric_change (
  region_id     BIGINT NOT NULL REFERENCES regions(region_id),
  metric_id     TEXT   NOT NULL REFERENCES metrics(metric_id),
  window_start  DATE   NOT NULL,
  window_end    DATE   NOT NULL,
  start_value   DOUBLE PRECISION NOT NULL,
  end_value     DOUBLE PRECISION NOT NULL,
  pct_change    DOUBLE PRECISION NOT NULL,
  cagr          DOUBLE PRECISION,
  PRIMARY KEY (region_id, metric_id, window_start, window_end)
);

CREATE TABLE region_rankings (
  metric_id    TEXT   NOT NULL REFERENCES metrics(metric_id),
  level        region_level NOT NULL,
  window_start DATE   NOT NULL,
  window_end   DATE   NOT NULL,
  region_id    BIGINT NOT NULL REFERENCES regions(region_id),
  rank         INT    NOT NULL,
  percentile   DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (metric_id, level, window_start, window_end, region_id)
);
```

**Key properties encoded by the schema**

- There is exactly one value per `(region, metric, period)`. Reloading a source upserts
  rather than appends, so a double-run cannot silently double a county's population.
- Every fact traces to exactly one source file. `DELETE FROM source_releases WHERE
  release_id = ?` removes precisely what that file contributed and nothing else.
- `parent_id` is a strict hierarchy: `state → county → {municipality, tract}`.
  Municipality and tract are **siblings**, not nested — Census tracts nest within
  *counties*, and a tract can straddle municipal lines. (An earlier version of this
  document claimed tracts roll up through municipalities; that was wrong, and it
  matters: any municipality-level figure derived from tract data needs a crosswalk,
  exactly like ZIP.) ZIP codes are in no hierarchy at all, so `parent_id` is NULL for
  them and `ck_regions_parent_by_level` enforces that.
- All levels share one table, so a query that filters `level = 'county'` can be changed
  to `'municipality'` without touching its joins.
- A metric is defined once. Two sources supplying median rent write to the same
  `metric_id` with different `release_id`s, and the disagreement becomes visible instead
  of becoming two columns.
- `fact_metric_change` and `region_rankings` are derived and disposable. If they ever
  disagree with `fact_metric_observation`, they are wrong and get rebuilt.

**Surprising but intentional.** ZIP-level values are allocated through
`region_crosswalk`, not measured — a ZIP that straddles three municipalities gets a
weighted estimate, and the API labels it as such. This is unavoidable: ZIP codes are mail
routes, not statistical geographies. It is not scheduled to be "fixed" because there is
nothing to fix; the mitigation is that the weight and method stay queryable.

## Pipeline

Eight stages, each a CLI command, each persisting before the next runs (SPEC principle 6).

**All eight stages run as of Milestone 6.** Until a stage was implemented it exited 1
naming the milestone that would deliver it, so a stub could never be mistaken for a
successful run — a no-op exiting 0 would make an empty warehouse look like a clean
pipeline. `src/hip/cli.py` keeps that list in `_STAGE_MILESTONE`, now empty, and a test
asserts it and the command list agree, so the map cannot go stale.

`validate` is a real gate and has already earned it: it blocked a load carrying 318
duplicate observations caused by over-aggressive name normalization (#28). `make
pipeline` runs all eight stages in order, and a failing gate stops the chain.

```text
hip acquire   →  data/raw/<source>/<sha256>/        immutable download + manifest
     ↓
hip land      →  data/parquet/<source>/<vintage>/   typed Parquet, one dir per release
     ↓
hip stage     →  data/duckdb/hip.duckdb             dbt staging models over Parquet
     ↓
hip geocode   →  duckdb: resolved region_id columns  GEOID match, then crosswalk
     ↓
hip validate  →  reports/validation/<run_id>.json    GATE — non-zero exit blocks load
     ↓
hip load      →  postgres: regions, facts, releases  transactional, per-release
     ↓
hip analyze   →  postgres: changes, rankings         derived tables, full rebuild
     ↓
hip pack      →  data/packets/<window>/<id>.json     analysis packets (#12)
                 reports/regions/<window>/<geoid>.md  with --report (#45)
```

Only the parcel tier stops short of Postgres. `hip land` writes 3.48M NJ parcels to a
67MB Parquet file, `hip stage` aggregates them to 554 municipalities inside DuckDB, and
only those aggregates cross into the warehouse (#16, #49). The parcels stay queryable
where they are, which is what makes a parcel-level question answerable later without
re-downloading anything.

**What each stage guarantees.** `acquire` is the only stage that touches the network; it
is idempotent by content hash, so re-running it after a partial failure re-fetches only
what is missing, and an unchanged upstream file produces no new release. `land` is pure
transcoding — no business logic — so a bug there is always re-runnable from `data/raw/`
without network access. `stage` and `geocode` operate entirely inside DuckDB and can be
thrown away and rebuilt from Parquet. `load` wraps each release in one transaction: a
release is fully present or fully absent, never half-loaded. `analyze` truncates and
rebuilds its tables rather than incrementally updating them, because they are cheap to
recompute and expensive to reason about when stale. `pack` is pure output: it reads the
warehouse and writes files, touching no database state, so it can be re-run at any time
and its artifacts deleted without consequence.

**Failure behavior.** `validate` failing is the designed stop: the warehouse keeps
serving the previous release and the report names the failing check, the source, and the
row count. A failure in `acquire` or `land` affects only that source — the CLI processes
sources independently and reports a per-source exit summary, so one dead upstream URL
does not block a refresh of the other eight. A failure in `load` rolls back to the prior
release for that source only. A failure in `analyze` leaves the derived tables empty
rather than stale: `/rankings` and `/compare` then return empty results, `/regions/{id}/
packet` and `/regions/{id}/report` return 404 naming `hip analyze`, and every fact
endpoint keeps working. (An earlier version of this document promised 503 from the
ranking endpoints; nothing implements that, and an empty ranking is not a server error.)

**Degradation when a dependency is unavailable.** No Docker or no Postgres means stages 1
through 5 still run end-to-end — everything up to `load` is Parquet and DuckDB only,
which is deliberate: the expensive, slow work does not require the database to be up.

## Analysis Packets

The contract between deterministic analytics and any consumer (#12). Small, fully
computed, and validated against `schemas/packet-v1.json` before it is written. A county
packet is roughly 13KB — 15 metrics, 8 sources, 6 caveats.

`src/hip/packets/schema.py` holds the Pydantic models that *are* the schema; the JSON
Schema file is generated from them and committed (#43), and `hip schema` prints it.
Assembly is `build_packet(session, region_id, window)`; the API calls it per request and
`hip pack` calls it in a loop (#42).

```json
{
  "packet_version": "1.1",
  "region": { "region_id": 11, "geoid": "34021", "level": "county", "name": "Mercer",
              "label": "Mercer County, NJ", "state_code": "NJ",
              "parent": { "region_id": 1, "name": "New Jersey", "level": "state" } },
  "window": { "label": "5y", "start": "2018-12-31", "end": "2026-06-30" },
  "metrics": [
    { "metric_id": "zhvi_sfr", "label": "Home value index, single-family",
      "unit": "usd", "direction": "neutral",
      "window_start": "2021-06-30", "window_end": "2026-06-30",
      "start_value": 329222.0, "end_value": 453317.0, "pct_change": 37.69,
      "cagr": 6.63, "rank": 9, "of": 21, "percentile": 60.0,
      "release_id": 41, "source_id": "zillow_zhvi", "match_method": "fips" }
  ],
  "levels": [
    { "metric_id": "modiv_median_assessed_value",
      "label": "Median assessed value, residential parcels", "unit": "usd",
      "direction": "neutral", "value": 5153500.0,
      "period_start": "2026-03-06", "period_end": "2026-03-06",
      "rank": 1, "of": 553, "percentile": 100.0,
      "release_id": 372, "source_id": "nj_modiv", "match_method": "nj_cd_code" }
  ],
  "comparisons": { "peer_level": "county", "peer_scope": "NJ", "peer_count": 21 },
  "highlights": [
    { "metric_id": "permits_total_units", "label": "Residential units permitted",
      "position": "leading", "rank": 1, "of": 21, "pct_change": 319.33 }
  ],
  "caveats": ["ACS 5-year vintages overlap by four years, so consecutive estimates ..."],
  "sources": [
    { "source_id": "zillow_zhvi", "name": "Zillow Home Value Index",
      "publisher": "Zillow Research", "license": "Free for non-commercial use with
      attribution", "url": "...", "vintage": "current",
      "fetched_at": "2026-08-11T...", "release_ids": [41] }
  ]
}
```

**Key properties.**

- Every number is read from the warehouse, never computed at assembly time. If a value
  is not in `fact_metric_observation`, `fact_metric_change`, or `region_rankings`, it
  does not appear.
- `window.start` and `window.end` are the **envelope** across metrics, not a span each
  one covers. ACS is annual and ends in 2023, Zillow is monthly and ends in 2026, so a
  `5y` window resolves to different dates per metric (#35). Each metric carries its own
  pair, and both the report and the dashboard say so rather than printing the envelope
  as though it were shared.
- `metrics` describes movement and `levels` describes position. A metric published as
  a single snapshot — every MOD-IV aggregate — has no movement and appears only in
  `levels`, ranked by value (#52, #54). A metric with history appears in both, because
  "what it is now" and "how it moved" are both worth stating.
- `highlights` is selection, not statistics: a metric where the region ranks in the top
  or bottom three of a cohort of at least five. The rank comes from `region_rankings`;
  nothing new is derived.
- `caveats` come from `hip.packets.caveats`, the same pure function
  `/regions/{id}/summary` uses (#46), so limitations travel with the data instead of
  living in a document a reader never opens.
- There is no wall-clock field (#44), so two packs of an unchanged warehouse are
  byte-identical and `diff` shows only what the data did.
- An empty packet is never produced. A region with no analytics raises
  `PacketUnavailable`, which the API turns into a 404 naming `hip analyze` — a
  schema-valid packet with no metrics would tell a reader nothing while looking fine.

**Surprising but intentional.** No model consumes these in Version 1 (#11). The report
renderer and the dashboard's report page are their only readers, which is the point: the
contract is exercised by two independent media before an LLM shapes it.

**Fixed at Milestone 7.** `metrics[].release_id` used to name the right source and the
wrong vintage (#47); the loader now keys releases on `(source, layer, vintage)` (#53), so
each ACS year cites its own release. The caveat that reported the defect is still built,
but it now asks the fact table whether provenance is actually collapsed for that region
rather than assuming it from the source's vintage count — so it disappeared on its own
when the data stopped warranting it, and would return if a future source regressed.

## API

FastAPI over Postgres, read-only (#6), served at `http://localhost:8000`. Endpoints
marked ✅ are implemented; the rest arrive with the milestones that produce their data.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/health` | ✅ service + database + last successful load timestamp |
| GET | `/regions` | ✅ paged regions filtered by `level`, `state`, `parent_id`, name `q` |
| GET | `/regions/{region_id}` | ✅ one region, its full ancestor chain, child count |
| GET | `/geo/{level}` | ✅ GeoJSON FeatureCollection, simplified by default |
| GET | `/regions/{region_id}/metrics` | ✅ observations filtered by `metric_id`, `from`, `to`, each with source and match method |
| GET | `/regions/{region_id}/summary` | ✅ headline changes, rank, caveats — dashboard landing |
| GET | `/regions/{region_id}/packet` | ✅ the analysis packet, assembled per request (#42) |
| GET | `/regions/{region_id}/report` | ✅ the same packet as `text/markdown` |
| GET | `/rankings` | ✅ ranked regions for `metric_id`, `level`, and `basis` (`change` over a window, or `value`) |
| GET | `/compare` | ✅ aligned series for several `region_ids` |
| GET | `/sources` | source registry and the releases currently loaded |
| GET | `/sources/unresolved` | ✅ source geographies with no region, and why |

`/compare` takes one `metric_id` across several regions, not several metrics — the
earlier version of this table said otherwise. `/sources` is the only endpoint here still
unbuilt; a packet already carries the releases behind its own numbers, which is what the
dashboard needed it for.

Every response that contains a metric value also carries the `release_id` and source
vintage behind it — provenance is a field, not a separate lookup. The API holds a
read-only Postgres role, so decision #6 survives a careless handler.

## Known Limitations

Accepted for Version 1, written down so they are not rediscovered as bugs.

- **ACS 5-year estimates overlap.** Consecutive vintages share four years of sample, so
  year-over-year change from ACS is not an independent measurement. Change metrics
  computed over ACS use five-year gaps by default; shorter windows are available and
  carry a caveat.
- **Zillow indexes are revised retroactively.** A new ZHVI release can change values for
  periods already loaded. Because releases are immutable (#10) the revision is visible as
  a new `release_id`, but the current fact row is overwritten by the newer release — the
  warehouse shows current-best history, not what was published at the time.
- **MOD-IV assessed values are not market values.** Assessment ratios vary by
  municipality and revaluation year. Any parcel-derived value metric is an approximation
  until equalization ratios are applied, which is not in Version 1.
- **ZIP-level metrics are allocated, not observed** (see the schema section).
- **Parcel data is not queryable through the API** (#16). All 3.48M NJ parcels exist in
  Parquet and DuckDB; only six municipality-level aggregates reach Postgres. There is no
  parcel endpoint and no parcel map layer.
- **Parcel geometry is not downloaded** (#49). The REST path fetches attributes only, so
  the parcel polygons a map layer would need are absent — `njgin_parcels` stays a planned
  source for exactly that reason.
- **MOD-IV covers 554 of 564 municipalities** (#51). The ten misses are names MOD-IV
  truncated to fit a fixed-width field — Upper Saddle River, Parsippany-Troy Hills, South
  Orange Village, Peapack-Gladstone, Lower Alloways Creek, Point Pleasant Beach, Orange,
  Caldwell, North Caldwell, Essex Fells. Resolving them means a rule per place, which is
  the guessing #27 rejects.
- **An assessment is not a market value.** Ratios drift between revaluations and vary by
  municipality, so `modiv_median_assessed_value` tracks the tax roll rather than what
  houses sell for. Equalization ratios would fix this and are not loaded.
- **The static export is 3× the size of the data it displays** (#68). 1,135 regions
  produce 5,844 artifact files at 84MB and 11,375 export files at 261MB, because every
  page embeds its own data and Next writes four RSC payloads per page alongside the
  HTML. Pre-rendering therefore breaks on file count before storage or bandwidth become
  a question, and it breaks at Northeast scale rather than national — roughly 100,000
  export files for nine states. Beyond that, region pages have to render in the browser
  from the published artifacts instead of being pre-rendered.
- **`/compare` and region search cannot be published** (#67). Both take unbounded
  parameters — an arbitrary set of `region_ids`, and free-text `q` — so neither
  enumerates into files. The static tree names them in its manifest under
  `unpublishable` rather than omitting them silently. The seam where they would return
  is a queryable data layer in the browser over published Parquet, not a larger render.
- **README excerpts have no staleness check.** The platform detects stale prose about
  its own data — `region_explanations` stores a packet hash, `is_stale` compares it, and
  the API serves a `stale` flag the dashboard renders — but the figures quoted in
  `README.md` are copied by hand and nothing compares them with the artifacts they came
  from. A source release that revises history moves the numbers in
  `reports/regions/5y/34003.md` without moving the ones quoted beside it. Mitigated by
  dating every excerpt and linking the live file; `sitrep export --check` is the pattern
  a real check would follow, and Milestone 11 is where publishing makes the drift matter.
- **Throughput is measured by an external, Mac-only tool** (#66). `mac-sitrep` produces
  the README's Resource Requirements block; without it, wall clock, CPU, peak RAM, and
  disk I/O go unmeasured on this project. `hip footprint` covers only the storage half
  and has no such dependency.
- **The published pipeline timing is a warm run.** `hip acquire` returns cached releases
  without touching the network unless `--force`, so the 22-second figure re-processes
  data already on disk and downloads nothing. Cold-run cost — which is what adding a
  state actually incurs — has never been measured.
- **`make pipeline` always dirties 21 tracked files.** `analyze` writes a new
  `hip_derived` source release stamped with the run time, so every region report's
  provenance table changes on every run even when no number moves. The reports are
  correct; the diff is noise.
- **MOD-IV is one snapshot, so it has no change metrics.** Its six metrics carry a value
  and a value rank and nothing else; `/rankings?basis=change` returns nothing for them.
  A second vintage would need a second published composite, which NJGIN does not archive.
- **1.4% of parcels carry no `CD_CODE`** and are dropped before aggregation, because the
  composite could not confidently match the polygon to a MOD-IV record. They cannot be
  attributed to any municipality.
- **There is no AI layer** (#11). Packets are produced and read only by the report
  renderer and the dashboard's report page until Milestone 8.
- **Layer-level provenance is still approximate for keyed sources** (#53). Vintage is
  now exact, but a staged row names its region level rather than the release layer it
  arrived under, so `(source, vintage)` is often the most precise key that matches. The
  release named is always the right source and the right vintage; which file within that
  vintage carried the row can still be wrong for ACS county-versus-cousub.
- **A packet is per region and per window.** There is no cross-region packet, so a
  comparison between two counties means two packets. `/compare` serves that shape for
  a single metric; nothing packages it.
- **The report is Markdown and a print stylesheet, not a PDF** (#45). "Save as PDF" is
  the browser's dialog, so page breaks are the browser's judgment, and headers, footers,
  and page numbers are whatever it chooses to print.
- **The dashboard's tests cover arithmetic, not rendering** (#48). `lib/scale.ts` and
  `lib/format.ts` are tested directly; no test asserts that a page renders, that the
  report route fetches, or that print styles hide what they should.
- **The evaluation samples three counties, not all 21** (`hip eval scenarios
  --regions`). Five questions across three packets is 15 scenarios per model; widening
  it is a flag, but each added region costs one generation per model per question, and a
  generation is 40 seconds to 3 minutes on this machine.
- **Reasoning is measured, never graded.** Only final answers reach the judge. A model
  whose reasoning is excellent and whose answer is wrong scores as wrong, which is the
  intent — but it also means the evaluation says nothing about reasoning quality.
- **Refusal detection is a heuristic** (`hip.eval.normalize.looks_like_refusal`): a
  phrase list plus a length ceiling. Tuned to under-report rather than over-report,
  because crediting a model for a decline it never made is the worse error. The judge
  scores refusal quality properly under `instruction_following`; the heuristic exists so
  the deterministic layer can score the refusal scenario without paying for a judgment.
- **The numeric checker verifies existence, not correct use.** A figure that appears in
  the packet counts as supported even if the model attached it to the wrong metric.
  Catching that is the judge's job, under `factual_accuracy`. The counted rate is
  therefore a floor on fabrication, not a complete accuracy measure.
- **Token counts in the evaluation are estimates** (characters over four), not tokenizer
  output. An exact count needs each model's own tokenizer, which would make the scenario
  — the thing every model must receive identically — differ per model.
- **Explanations are generated per region and go stale silently in the warehouse.**
  `packet_sha256` makes staleness *detectable* and the API reports it, but nothing
  regenerates automatically; a pipeline run leaves every explanation stale until
  `hip explain` is run again.
- **`gemma-4-e4b-mlx` cannot be loaded at all.** mlx-lm 0.31.3 rejects the weights
  with `Received 126 parameters not in model` — the E4B MatFormer architecture is not
  supported. All 15 of its generations are recorded as errors rather than dropped, and
  it costs one of the two anchor pairs, so the cross-runtime comparison rests on
  Qwen3-8B alone.
- **Three candidates do not converge within a 6,000-token budget.** `phi-4-mini-mlx`
  hits the cap on 15 of 15 (a visible doubt loop: *"Wait, perhaps the window is 6
  years…"*), `qwen35-9b-mlx` on 13 of 15 (re-enumerating the same caveats, individual
  lines repeated four times), and `gemma-4-12b-q4` on 6 of 15 at 12.6 tok/s, which is
  8.6 minutes per attempt. Doubling the budget from 3,000 changed the first two not at
  all, which is what makes "does not converge" a finding rather than a suspicion.
- **The judge's rubric schema cannot express numeric bounds.** Structured outputs
  reject `minimum`/`maximum`, and the rejection happens per request at submission time,
  not when the schema is built — the first batch returned 105 errors for 105 requests.
  Scores are bounded by an enum instead, which also forces whole-number grades.
- **Refresh is manual.** There is no scheduler; a refresh is a `hip` command run by a
  person or a cron entry they write themselves. Deliberate — see #6.
- **ZIP allocation is area-weighted, not population-weighted** (#26). A half-empty ZIP
  contributes area it does not contribute households for, so ZIP-derived municipal
  figures skew toward large, sparsely populated areas. HUD's USPS crosswalk is the fix
  and needs an API key.
- **ZIP membership is decided by geometry, not by address.** 598 ZCTAs overlap NJ by
  positive area; ZCTAs that only touch the border across the Delaware or Hudson are
  excluded. A ZCTA mostly in Pennsylvania but partly in NJ is still recorded with
  `state_code = 'NJ'`, because scope contains only NJ — the label means "in scope and
  overlapping", not "majority of its area is here".
- **`/geo` geometry type varies with simplification.** `ST_SimplifyPreserveTopology` can
  reduce a single-part MultiPolygon to a Polygon, so the same region may serialize as
  either. GeoJSON consumers accept both; a client that switches on geometry type will
  be surprised.
- **Affordability ratios exist only where both sides do.** `price_to_income` needs ACS
  income and Zillow values for the same region and year; `rent_to_income` needs ZORI,
  which is sparse — hence 2,026 rows against 293. A municipality with no Zillow match
  has no ratio, even though it has ACS income.
- **A change window is the nearest observation within 400 days of the target**, not an
  exact date. Sources have different frequencies, so an exact match would drop every
  annual metric. Beyond 400 days the row is omitted rather than stretched.
- **The dashboard covers three pages.** An overview map with county rankings, a region
  detail page, and a print-ready region report. There is no side-by-side region
  comparison UI yet, even though `/compare` exists to serve one, and no municipality or
  ZIP choropleth — only county.
- **The map has no basemap, pan, or zoom.** A deliberate consequence of #39: boundaries
  render without roads or labels underneath, so a region is identified by shape and
  tooltip rather than by context.
- **AMI-based affordability is county-only.** HUD publishes income limits per county,
  so `price_to_ami` has 105 observations against `price_to_income`'s 2,026. A municipal
  AMI figure would mean allocating a county limit downward, which HUD does not sanction.
- **35 ZIP crosswalk rows still use area weighting**, where HUD has no residential
  addresses for the pair. `method` distinguishes them, and an allocation mixing the two
  is silently mixing assumptions.
- **HUD Fair Market Rents and CHAS are in SPEC but not fetched.** Both were approved as
  Version 1 sources; only the crosswalk and income limits are wired.
- **BLS history is 20 years and needs a key.** Without `BLS_API_KEY` the adapter falls
  back to API v1: three years of history and 25 queries a day, which is one run for New
  Jersey's 21 counties and too short for Milestone 4's change metrics.
- **FHFA is state-level only.** No county HPI is published at a reachable URL, so FHFA
  is the warehouse's only `state`-level metric and cannot participate in county rankings.
- **IRS migration is net returns per county, not flows.** The origin→destination matrix
  stays in Parquet and DuckDB; promoting it needs a two-region fact table.
- **Municipal Zillow coverage is 403 of 564 (71%), and that is a ceiling, not a bug.**
  Zillow publishes no FIPS below county level. 90 of its NJ "cities" are
  census-designated places inside townships with no municipal counterpart, and the rest
  are unresolvable name collisions (#27, #28). County coverage is 21/21 and ZIP is
  548/598. `/sources/unresolved` names every gap and its reason. ACS covers all 564
  municipalities exactly (#31), so the gap is Zillow-specific rather than structural.
- **Municipal values are name-matched and labelled as such.** `match_method =
  'name_county'` is a weaker claim than `'fips'`. Analytics that mix levels should say
  so; nothing currently enforces that.
- **Zillow revises history and does not version its URLs.** The same path always serves
  the current file, so `vintage` is ours to assign (`current`) and the content hash is
  what actually distinguishes releases. A reload upserts, so the warehouse shows
  current-best history rather than what was published at the time.
- **ZORI starts in 2015 and covers far less.** 15,836 observations against ZHVI's
  293,514, because a repeat-rent index needs listing volume. Rent-based analysis will
  be thinner than value-based analysis at every level, and much thinner at municipal
  level.
- **The Postgres container runs under emulation.** `postgis/postgis:16-3.4` resolves to
  linux/amd64 on this arm64 Mac, so Docker emulates it. Correct but slower than native;
  irrelevant at 3,365 rows, worth revisiting when the fact tables arrive.
