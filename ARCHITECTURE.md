# Housing Intelligence Platform — Architecture

How the platform is built and why it is built that way: the storage tiers, the module
boundaries, the warehouse schema, the pipeline stages, and the decisions behind each.
[SPEC.md](SPEC.md) is the source of truth for *what* the system does and for Version 1
scope; this document does not restate it.

> **Status (2026-09-11):** Milestones 0 through 13, 19, 20, 21 and 22 are complete; 16,
> 17 and 18 are planned, and 14 and 15 were deferred past Version 2 on 2026-09-07
> ([ROADMAP.md](ROADMAP.md)). The warehouse holds a NJ geography spine — 3,365 regions
> and the `nation` row, 2,493 ZIP allocation weights (2,460 of them HUD
> residential-address ratios), and 554 NJ municipal codes in `region_identifiers` — and
> **351,295 observations across 31 metrics from 12 sources**, spanning 1971 to 2026, with
> 26,805 computed changes, 26,790 change rankings and 11,884 value rankings derived from
> them. All eight stages run, `acquire → land → stage → geocode → validate → load →
> analyze → pack`. **3.48M NJ parcels** live in Parquet and DuckDB and reach the
> warehouse only as six municipality-level aggregates (#49). Packet `1.2` is validated
> against `schemas/packet-v1.json`. The API and a three-page dashboard are published as
> static files, with no database and no application server in production (#67, #68).
> Interpretation is written by hosted models behind a preference list that ends at a
> local one (#78, #96, #118): 105 explanations, five models' readings of each of the 21
> counties (#91), chosen by evaluation runs `v1`, `v2` and `v3`, with reasoning effort part of
> each candidate's configuration since Milestone 20 (#98). Since Milestone 13 every
> figure in new prose is bound to the packet field and release that licensed it before
> it is stored, and prose stating a figure the packet does not carry is refused (#112,
> #113). 452 Python tests and 34 dashboard tests pass. Nothing in the pipeline or the API depends on a model being
> present: with no explanations stored, every page and endpoint still works.

## System Shape

A local-first analytical platform that publishes itself: a staged batch pipeline builds a
curated housing warehouse on one machine, a read-only API and dashboard sit on top of it,
and production is their output rendered to static files (#67, #68).

- **Runtime** — Python 3.12+ for acquisition, ETL, validation, and analytics, driven by
  a Typer CLI. dbt-core owns the warehouse transform DAG. FastAPI serves the HTTP API.
  Next.js (TypeScript) serves the dashboard and maps.
- **Storage, three tiers** — Parquet holds immutable raw landings and history; DuckDB is
  the in-process transform engine over those Parquet files; PostgreSQL + PostGIS is the
  curated warehouse and the only thing the API reads.
- **Boundary** — the pipeline writes, the API reads. No HTTP request triggers a pipeline
  stage, and no pipeline stage calls the API. They share the database, not code paths.
- **Data sources** — public HTTP endpoints only: Census TIGER/Line, Zillow research CSVs,
  Census ACS and Building Permits, FHFA HPI, FRED, BLS, IRS SOI migration, HUD's USPS
  crosswalk, income limits, Fair Market Rents and CHAS, and NJGIN parcel / MOD-IV
  extracts. Each is reached
  through one source adapter, and every download is cached to disk so a full rebuild
  never re-fetches.
- **Model and hosting services, all optional** — Gemini, DeepSeek and Qwen write
  explanations by default, behind a preference list that ends at a local Ollama model
  (#78, #96, #118); Anthropic's API grades the evaluation and is read by `hip eval judge`
  alone (#56); Cloudflare R2 and Pages serve the published files (#68).
- **No cloud service is required to run it.** Docker Compose provides Postgres/PostGIS;
  Python and Node run natively. Without the hosted services the platform still builds,
  serves and renders everything except generated prose, which falls through to the
  local model or is simply absent.
- **Models explain; they never compute.** `hip explain` generates prose from analysis
  packets and stores it with the model and packet hash that produced it (#60); the API
  serves it and never runs a model (#6). Every figure in the prose is bound to the packet
  field that licensed it before the row is written, and prose stating a figure the packet
  does not carry is refused (#112, #113).

Future deployment shapes stay cheap because of where the seams are. The API reads
Postgres through SQLAlchemy and holds no DuckDB or Parquet dependency, so moving to a
managed Postgres is a connection-string change. dbt targets abstract the execution
engine, so promoting a transform from DuckDB to warehouse-side SQL is a config edit, not
a rewrite. Source adapters expose one method — fetch a release, return a local path — so
swapping local disk for object storage replaces the storage backend and leaves all
adapters untouched. `web/` is a separate deployable that knows only the API's base URL at
build time and the artifact origin at run time.
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
| 11 | The local LLM runtime is deferred. Version 1 emits analysis packets and stops there. **Superseded at Milestone 8, when evaluation chose the runtime (#56–#60), and by hosted inference at Milestone 12 (#78).** | The packet contract is what matters and it is testable without a model; picking Ollama vs. llama.cpp vs. LM Studio before the eval scenarios exist would be choosing on reputation, which SPEC principle 9 rejects. Rejected: wiring Ollama now for a demo. Costs: no explanation feature ships in V1, and the packet schema gets its first real consumer only in M8. |
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
| 68 | The dashboard is a static export, and HTML and data artifacts are deployed to two different origins. | `output: "export"` renders all 2,273 pages at build time, so production runs no Node server and no database — the same argument as #67, applied to the other half. Splitting the destinations is forced by measurement rather than taste: the export emits 13,647 files for 1,135 regions (one HTML plus five RSC payloads per page, 316MB), against 5,846 artifact files at 96MB. Static site hosts cap files per deployment — 20,000 free, 100,000 paid on Cloudflare Pages — while object stores do not, so HTML goes to the page host and the JSON tree to object storage, addressed by `NEXT_PUBLIC_ARTIFACT_URL`. Rejected: one origin for both, which fits New Jersey and breaks at the Northeast. Costs a second origin to configure, and a build-time warning because an unset artifact origin bakes `localhost` into every download link rather than failing at runtime. |
| 69 | The API's connection pool is sized explicitly at 20 with 20 overflow. | SQLAlchemy's default of 5 plus 10 was never chosen; it was never reached, because until the static export existed the only client was a dashboard serving one reader at a time. Six parallel export workers exhausted it in minutes: requests queued the full 30-second pool timeout, page renders passed their own 60-second deadline, Next retried them, and the retries kept the pool empty. The API stopped answering `/health` at all, and the build failed at 1,641 of 2,273 pages. 40 against PostgreSQL's default `max_connections` of 100 leaves room for psql and dbt while covering a fan-out wider than any human client. Rejected: capping the export's worker count, which hides a real defect — the first concurrent client found it, and a public deployment would have found it too. |
| 70 | `regions` stores TIGER's `NAMELSAD` beside `NAME`. | `name` is the label a reader wants — "Boonton", not "Boonton township" — and it does not identify a place. New Jersey alone reuses 30 municipality names; `parent_id` resolves most, because a municipality has one county, but four pairs share a name *and* a county (Andover borough/township in Sussex, Boonton town/township in Morris, Bordentown city/township in Burlington, Washington borough/township in Warren) and were separable only by GEOID. Stored rather than derived: legal status is a property of the place that only the source knows. NOT NULL with a fallback to `name`, so no consumer branches on absence — TIGER publishes no NAMELSAD for states and no name columns for ZCTAs, and there the bare name already is the full one. Rejected: replacing `name` with NAMELSAD, which would change every displayed label and every published page to say "township" where a reader expects a town. Costs one column and one index. |
| 71 | Attribution is rendered site-wide from `GET /sources`, not written into a template. | Zillow publishes ZHVI and ZORI "free for non-commercial use with attribution", which makes attribution a condition of use. Before 2026-09-05 only report pages carried it, because a packet ships its own sources table — the landing page showed a `zhvi_sfr` choropleth and ranking naming no source at all, and 1,135 region pages likewise. Reading the registry means the footer and the packet quote the same rows, so adding a source cannot leave the site under-attributing. Rejected: a hard-coded list in the footer component, half the work and wrong the first time `sources.yml` changes — and wrong here is a licence problem, not a stale copy. Costs one file per route in the static export, 2,272 files and 62MB, because the footer makes every page carry an extra payload segment. Also builds `/sources`, the last endpoint in the API table that had no implementation. |
| 72 | `sources` carries a `homepage` beside `url`. | `url` is the canonical root and is what every analysis packet records, so for an API-ingested source it is the API — correct provenance, and useless to a person. The attribution footer (#71) linked it directly, and five of twelve links led somewhere broken or machine-facing: `api.census.gov/data` returns JSON, `api.bls.gov/publicAPI/v2` and `api.stlouisfed.org/fred` return 404 in a browser, HUD's API root asks for a sign-in, and NJ had retired the MOD-IV page entirely. `homepage` is where a reader goes; nullable, because for most sources the two are one page and duplicating it would invite drift, and consumers resolve `COALESCE(homepage, url)`. Rejected: repointing `url` at the landing page, which would silently rewrite the provenance every published packet carries. Costs one column and one field to keep current. |
| 73 | `hip_derived` releases are content-addressed, and `analyze` prunes the ones no fact cites. | Every run minted a release stamped `to_char(now(), ...)` and repointed the three affordability metrics at it, so a packet's `sources[]` block and its derived metrics' `release_id` moved on every run. That falsified the one property the packet hash exists to have (#44, #61): it changed when the clock changed, not when the data did. The damage was downstream and silent — every stored explanation was marked stale by the next pipeline run whether or not a number had moved, so Milestone 12's staleness gate would have had nothing to gate on, and all 21 committed county reports showed a provenance diff with no figure behind it. The release is now identified by a sha256 over the derived rows, computed before it is written, exactly as the raw tier addresses a downloaded file by `sha256[:16]` (#10). An unchanged rebuild reuses the row; a real change makes a new one and correctly marks prose stale. Rejected: excluding provenance from the hash, which would have hidden the churn rather than removed it, and left the reports dirtying themselves forever. Costs a temp table per run and a hex vintage in place of a date, which is what a derived release honestly has. |
| 74 | `source_releases.row_count` holds rows, counted from the landed Parquet, and a re-recorded release corrects it. | Both callers passed `release.size_bytes` into it, so `GET /sources` — and the published `sources.json` behind the site's attribution footer — reported the national ZCTA file as 529,118,424 rows and NJ MOD-IV as 1,156,147,940. The column has been named `row_count` since migration 0002 and no caller ever set one. DuckDB answers `count(*)` from the Parquet footer, so counting at load time is a metadata read per file. The conflict clause had to become `DO UPDATE SET row_count` for the same reason: releases are immutable by content, so `DO NOTHING` would have left every existing row lying. `fetched_at` is deliberately *not* updated — packets quote it, and rewriting it per load would reintroduce #73 from the loader side. Bytes are not lost: the raw manifest records them per release and `hip footprint` reports them per tier. |
| 75 | A keyed staging model carries `release_layer` — the layer of the *file* the row arrived in, not the region level it describes. | The two coincide for Zillow, whose files are named by level, and diverge for every keyed source: BLS ships one file per county series, HUD one per county-year, ACS one per (level, year) under Census's own name for the level. `_append_keyed` wrote the region level into `layer`, so the loader's exact `(source, layer, vintage)` lookup never matched and fell through to the first release of that vintage. Every BLS observation in the warehouse cited Atlantic County's file, 107 HUD releases collapsed onto five, and every ACS municipal row cited the county file. This is the residue of #47 that #53 could not reach: vintage was made exact, layer never was. Measured after the fix — BLS 21/21 releases cited, HUD 105/107 (the two uncited are crosswalk files, which feed `region_crosswalk` rather than facts), ACS municipal rows on `cousub`. IRS keeps one imprecision by nature and now states it: a net figure is inflow minus outflow, so it derives from two files and can cite one, and it names inflow rather than leaving the loader to pick whichever the catalog returned first. |
| 76 | A credential never reaches disk, because redaction happens where a URL is recorded rather than where it is built. | Census and FRED accept a key only as a query parameter — there is no header to move it to — so the key is unavoidably part of the request URL. The default filename was the URL's last segment and the manifest serialised the whole ref, so `data/raw/` held 32 manifests quoting live keys and files literally *named* `...?registrationkey=<key>`, where a screenshot, a backup, or a stray `find` would carry them off the machine. Three boundaries now redact: the filename drops the query string entirely, the manifest keeps a redacted `url` because which endpoint a release came from is real provenance while the key is not, and a failed download is raised `from None` with a redacted message, since httpx renders the failing URL into both its message and its traceback. Cached releases are unaffected — `_from_cache` reads the filename out of the manifest — so nothing re-downloads. |
| 77 | Window selection in `hip analyze` is ordered totally, not by distance alone. | `DISTINCT ON` picked the observation nearest each window target, ordered only by `abs(period_end - target)`. That is not a total order: a target sitting between two observations is equidistant from both, which is 5,606 groups in New Jersey alone, so `window_start`, `start_value`, `pct_change` and `cagr` were whichever row the scan reached first. Two `analyze` runs over an identical warehouse produced different published figures and different row counts — measured at 19,527, 19,530 and 19,529 on three consecutive runs — which also meant #73 alone could not make a packet reproducible. Ties now resolve to the older observation, so a window is never shorter than its label, and `ends` gained a `DISTINCT ON` against two observations sharing a maximum `period_end`, the case the packet assembler already guarded. |
| 78 | Three hosted providers sit behind one `HostedRunner`, dispatched by a per-provider `_Dialect`. | What differs between DeepSeek, Gemini, and Mistral on this task is mechanical — the auth header, the path, and where the answer and the token counters sit in the response. What does not differ is everything that carries risk: the retry policy, the contract that a model-level failure is a recorded finding rather than a raised exception (`ModelRunner` in `hip/eval/runners/base.py`), the normalization into `Telemetry`, and the refusal to invent a memory figure for a machine we do not own. Three classes would have duplicated the second list to avoid duplicating the first. A fourth provider is a `_Dialect` entry. Raw `httpx` rather than three vendor SDKs, matching `OllamaRunner`: three SDKs would be three dependency surfaces and three release cadences in service of one non-streaming chat call. Gemini uses its native `generateContent` rather than its OpenAI compatibility layer, because that layer is a translation maintained for other people's clients and the field most likely to be dropped in one is a token counter the cost column depends on. Rejected again, for the reason first recorded on the roadmap: a router such as OpenRouter, which would supply the breadth through one integration and silently select a backend, putting prose from an unbenchmarked model on a public page under a row that names a different one. **A fourth provider, Qwen, joined as one more `_Dialect` on 2026-09-11 (#105).** |
| 79 | A cohort is named by config and passed to its runner, rather than hardcoded in the runner class. | `cohort="gguf"` and `cohort="mlx"` were string literals in both the success and failure paths of the two local runners. That was invisible while each class served exactly one cohort and became wrong the moment three providers shared `HostedRunner`: every hosted generation would have carried the same cohort, collapsing three jurisdictions into one column in the report and one row in every per-cohort table. `build_runner` now takes the cohort's key in `config/evaluation.yml`. The same change makes a second Ollama endpoint a config edit rather than a subclass. |
| 80 | An absent API key is *unavailability*, not a configuration error. | `check_config` treats a source's missing `api_key_env` as a hard problem, and applying that rule to a hosted cohort would have been the obvious symmetry and the wrong one. The preference list exists precisely so that a tier which cannot be reached is stepped over: a missing key, a withdrawn pin, and an unreachable Ollama are the same event to `resolve`, and only exhausting the list is an error. Making a key mandatory at config load would have turned normal degraded operation into a startup failure — and would have meant `make check-config` could not pass on a machine that deliberately holds only one of the three keys. |
| 81 | The winner gate is an error *rate*; the write gate is the same predicate as the win gate. | `select_winner` required `summary.errors == 0`, which was right for a local runtime where an error means the model genuinely could not run — it is how `gemma-4-e4b-mlx` was excluded. Against a hosted provider one HTTP 429 that outlived four retries would have disqualified an otherwise winning candidate on one bad afternoon. It is now `MAX_ERROR_RATE`, stated at one generation in fifteen so a single failure in a standard run is survivable and two are not, in the same shape as the 5% fabrication bar (#59). Separately, `selection.passed_benchmark` reuses that predicate rather than restating it, so a model can never become eligible to *write* under looser rules than it was eligible to be *recommended* under. |
| 82 | Concurrency is a property of the cohort, not of the run loop. | The loop is strictly sequential for a memory reason recorded when it was written: two local models do not fit in 16GB, and a resident model pushes the next into swap. None of that applies to a runtime hosted on somebody else's hardware, and serializing hosted requests would discard the one property that justified the milestone — wall clock, not price (SPEC: hosted inference is chosen for concurrency). A hosted cohort now fans out to `generation.max_concurrency`; local cohorts are untouched. Bounded rather than unbounded because an unbounded fan-out earns the 429s that the retry then pays for in the wall clock it was meant to save. `ThreadPoolExecutor.map` yields in submission order, so generations are appended in plan order however the requests interleave — a resumed run and a re-derived report must not depend on which request returned first, for the same reason the artifacts carry no wall-clock field (#44). |
| 83 | Cost is recorded per candidate, priced from the provider's own counters, and never reorders the preference list. | The rates live on `CandidateModel` rather than on `Cohort` because a provider's tiers differ by an order of magnitude and the quality-per-dollar column compares candidates, not vendors. They stay `None` for a local model: a local generation is not free, it is not billed per token, and a `0.00` in a published column reads as free. The figure is computed from `Telemetry.prompt_tokens` and `generation_tokens` as the provider reported them, so the column and the invoice derive from the same numbers rather than from an estimate. Reported beside quality and not folded into it, because SPEC is explicit that a cheaper model is chosen on measured evidence and that cost does not by itself reorder the list at generation time. Scaled to 1,000 generations in the report, since a per-generation figure at these rates has four leading zeros and 1,000 is the order of a real regeneration pass. |
| 84 | `hip eval cost` was recalibrated against the stored artifacts; it had been under-reporting by 15–60%. | The estimate assumed 7,000 prompt tokens and 800 output tokens per judgment. Rebuilding the real judge prompt over `data/eval/v1` gives ~2,600 in — 226 of system prompt, 442 of generated JSON schema, 1,931 of user prompt — and 2,000–3,000 out, because `effort: medium` thinking bills at the output rate and dominates the verdict JSON. The old figure was the size of the JSON alone, which is exactly the mistake the judge module's own docstring warns about for `max_tokens`. Corrected in the milestone that adds a cost column, on the principle that a number nobody can trust before spending money is worse than no number. |
| 85 | Evaluation runs are ordered by modification time, not by name. | `runs()` sorted directory names and `hip explain` took the last entry as "the most recent evaluation", so `v10` would have sorted before `v2` and the whole site's prose would have been generated with an older run's winner, silently. The name is a label; the filesystem knows which run happened last. Name breaks ties so two runs written in the same clock tick still order deterministically. Found in the pre-Milestone-12 review and fixed before the run that would have triggered it. |
| 86 | Verifying a hosted pin means calling it, not listing it. `hip eval models --probe` does. | `served_models()` asks the provider what it serves and marks a ref that is absent — which caught nothing, because the failure that actually occurred was not an absence. `gemini-2.5-flash-lite` is returned by `/v1beta/models`, advertises `generateContent` in its own `supportedGenerationMethods`, and answers a real call with `404 "no longer available to new users"`: it is grandfathered for keys older than this account's, and the listing endpoint does not model that distinction at all. A listing check cannot see it and neither can a config rule, so the only instrument that works is a call. `--probe` sends one trivial prompt per hosted candidate for a fraction of a cent; it is opt-in rather than folded into `available()`, because `available()` is consulted on every fallthrough during generation and must stay free and instant. Finding a dead pin costs a fraction of a cent here and fifteen generations plus the judging batch behind them during a run. |
| 87 | `quantization: hosted` is a statement of ignorance, and the four-bit invariant now applies only to local cohorts. | Every candidate through Milestone 8 was a 4-bit local import, and `test_every_candidate_is_four_bit` pinned that: precision was retired as a variable on 2026-08-13 and a stray Q8 would have silently reintroduced it. A hosted provider does not disclose the precision it serves and may change it without announcement, so the honest value is one that claims nothing. The invariant was scoped rather than deleted — it still holds where it can be checked — and a second test now requires that no hosted candidate claims a precision, so the column can never read as measured when it was not. This is a real reduction in what the cross-cohort comparison controls for and is one more reason SPEC accepts hosted generation as non-reproducible. |
| 88 | Derived affordability ratios are averaged in `numeric` and rounded, so the derived release digest is reproducible. | #73 made the `hip_derived` release content-addressed precisely so an unchanged rebuild would reuse it, and the property did not hold: four consecutive runs over an identical 335,927-row warehouse minted four digests, so every run marked all 21 explanations stale and dirtied all 21 committed reports — the exact damage #73 was written to stop. `analyze` alone was reproducible and `load` then `analyze` was not, which put the cause in the arithmetic rather than in the release logic. `_affordability` averaged the monthly Zillow numerator with `avg(value)` over `double precision`; floating-point addition is not associative, so the sum depends on the order the executor aggregates rows, and that order changes when `load` rewrites the heap or the planner chooses a parallel scan. Measured: 19,027 of 24,956 `(region, year)` groups differ between `avg(value)` and `avg(value::numeric)`, in the last one or two significant digits — invisible in every published figure and decisive in a sha256. Now averaged as `numeric`, which is exact decimal and therefore order-independent, with the ratio rounded to 6 decimal places: four more than an annual survey denominator can support, so nothing a reader sees changes. Rejected: hashing at display precision, which was the scheduled Milestone 12 approach and would have hidden this defect rather than removed it — and hidden the next one identically. Verified by three consecutive `load` + `analyze` cycles yielding one digest, and two consecutive `pack --report` runs byte-identical. |
| 89 | Landing skips on the producing release's sha256, recorded beside the Parquet, not on the destination path existing. | `parquet_path` is `{source}/{vintage}/{layer}.parquet`, and for every source whose vintage is the literal string `current` — Zillow, FHFA, FRED, BLS, MOD-IV — successive releases resolve to one path. `land_csv` skipped when that path existed, so a genuinely new release was registered in `source_releases` while the Parquet behind it stayed whatever the first run wrote. Measured on 2026-09-06: Zillow's August release carried a `2026-07-31` column, the raw tier stored it correctly under a new sha, and `data/parquet/zillow_zhvi/current/county.parquet` still had the mtime of the previous month's run — a full month of housing data acquired and never loaded. It compounded with the acquire cache (#TODO, deferred), which does not re-download a `@current` ref without `--force`: two independent gates, both silent, both defaulting to not refreshing, so `make pipeline` could not ingest new data for any of those five sources at all. The raw tier is content-addressed and was right; the landing tier keyed on a mutable string and was not. Now a `<name>.parquet.src` sidecar records the sha256 of the release that produced each Parquet and `needs_landing` compares against it. Rejected: dropping the skip entirely, which would re-transcode 1.1GB of MOD-IV on every run; and putting the sha in the path, which would content-address the landing tier at the cost of rewriting every downstream path and accumulating superseded Parquets. A Parquet with no sidecar is rebuilt once, because a file whose provenance is unknown cannot be trusted to be current. |
| 90 | `Telemetry.generation_tokens` counts every token billed as output, normalized across three provider conventions. | The three disagree, and taking each at face value put a wrong number in a published column. Gemini's `candidatesTokenCount` is the answer alone and reports thinking separately in `thoughtsTokenCount`, billing both at the output rate; the OpenAI-shaped providers fold reasoning into `completion_tokens`; Ollama's `eval_count` covers both. Run `v2` surfaced it as a 237% `reasoning_share` for `gemini-3.7-flash` — a ratio that cannot exceed 100% under a consistent denominator — and the same error understated that candidate's cost by 58%, $8.11 against $12.83 per thousand generations, on the model the run went on to select. The runner now adds thinking into `generation_tokens` for Gemini and leaves the other two alone, so the cost column and the invoice are computed from the same quantity everywhere. This is the `memory_basis` lesson (see `hip/eval/runners/base.py`) in a second column: a field whose meaning varies by runtime is worse than a field that is null, because it looks comparable. The stored `v2` telemetry was repaired in place rather than regenerated — both counts were present and correct as Google reported them, and the error was only in how they were combined, so the right figure is recoverable arithmetic rather than a new measurement. The pre-repair file is kept beside it as `generations.jsonl.pre-token-repair`. |
| 91 | `region_explanations` is keyed on the model, and carries the preference-list `rank` that orders several readings of one packet. | The table held one row per `(region_id, window)`, which was right while the platform ran one model and became the constraint the moment a reader could ask what a different model would have said. `model_id` joins the primary key (migration 0010). `rank` exists for a specific reason rather than convenience: `API_MAY_IMPORT` is `{warehouse, packets}`, so the API cannot read `generation.preference` to decide which of five explanations is the primary one, and the ordering therefore has to be data written at generation time rather than configuration read at request time. It doubles as provenance, recording which tier produced a paragraph in the same spirit as the existing `model_id` and `runtime`. `packet_sha256` stays per row, so one model's reading can be current while another's is stale — collapsing that to one flag per region would misreport both. |
| 92 | `/regions/{id}/explanation` keeps its shape; the comparison is a new `/explanations` beside it. | The singular endpoint is a published contract with an artifact tree behind it whose entire purpose is being consumable, so turning it into a list would break every reader to add a feature none of them asked for. It now answers `ORDER BY rank LIMIT 1` instead of `scalar_one_or_none`, which preserves both the response shape and the meaning — the preferred model's reading. The plural is additive at every layer: a new endpoint, a new published path beside the old one, and a switcher that renders nothing extra when only one explanation exists. Rejected: a `?model=` parameter on the singular endpoint, which would have published one file per model per region and multiplied the artifact tree by five to serve a page that wants all of them at once. |
| 93 | Generation limits are per cohort and separate from the evaluation's; the output ceiling is sized for the tail. | `limits` is an *evaluation* budget, and holding it common across candidates is what makes the benchmark mean anything — a per-cohort override there would quietly invalidate the comparison. Generation asks a different question, whether a model on a given runtime can finish a paragraph, and the answer is a property of the runtime: 12,288 context tokens is Gemma's window on this machine and describes nothing about a hosted model with an order of magnitude more. Reserving output inside the local figure was arithmetic about the wrong hardware. Measured 2026-09-06: `deepseek-v4-pro` spent the entire 6,000-token evaluation budget on reasoning and returned an empty answer for 12 of 21 counties, and the API reported HTTP 200 each time — nothing in the response says you received nothing. Raised to 12,000 it still failed 2 of 21; Bergen County exhausted 12,000 and then completed the identical packet in 7,871 under a 24,000 ceiling, which makes this variance rather than a threshold. The ceiling is therefore sized for the tail at 24,000, and that is free: billing is per token emitted, so headroom costs nothing unless it is used. |
| 94 | The published JSON tree is a build artifact, not a product, so Cloudflare's bot challenge stays on both origins. | `curl` against either origin returns a "Just a moment" interstitial rather than data, and the first reading of that was that it defeats the point of publishing artifacts as data. Investigation on 2026-09-06 found that overstated. The artifact origin is reached at runtime from exactly one place — the Markdown download link on the report page — which a browser follows, so the challenge is invisible to it; every figure the dashboard displays was baked in at build time against the local API, not fetched from the artifact host in production. Nothing a visitor does is affected. What the challenge does block is programmatic access, which today has no consumers. Against that, the tree is 96MB across 5,867 files with no auth, no rate limit and no revocation, and Zillow's data is licensed non-commercially with attribution — so friction against bulk mirroring is aligned with an obligation the project carries rather than incidental to it. Turning it off is a one-way door: once open there is nothing to close it with. **This is a decision about what the tree is for, not a defect.** If the JSON tree ever becomes a product — something the project wants consumed, rather than the store its own static site was built from — the answer changes, and the mechanism should then be a rate limit or a WAF skip rule scoped to `housing-data.jasonli.app` rather than removing protection from both hosts. Recorded because the 403 looks like a bug to anyone who meets it, and this argument should not have to be reconstructed. Noted honestly: a bot challenge raises the cost of casual bulk copying and is not licence enforcement — it neither stops a determined actor nor discharges the attribution obligation, which the site-wide source footer does. |
| 95 | Every hosted response's served model is checked against the requested ref, and a mismatch is a recorded substitution. | SPEC's pinning rule assumes a retired model is *withdrawn* — it fails loudly and the preference list falls through. DeepSeek retires models by *routing* them instead: measured 2026-09-10, `deepseek-v4-flash` was gone from `/models` yet a request naming it returned HTTP 200 with an answer from `deepseek-flash`, carrying the same `system_fingerprint`, and `deepseek-v4-pro` is routed the same way from 04:00 UTC on 2026-09-14. A routed pin never fails, so the fall-through never fires, and because `HostedRunner` sent `"model": ref` without reading anything back, a regeneration would have stored the retired model's name above another model's prose — precisely the silent substitution that got OpenRouter rejected (#78). Every provider here names the model that actually answered (`model` on the OpenAI-shaped APIs, `modelVersion` on Gemini), so the fix is to read it. **Exact match only**: every current candidate reports exactly its requested ref, and if a provider ever starts expanding names, a spurious mismatch fails in the safe direction — loudly, naming both models — rather than publishing prose under the wrong name. A substituted generation keeps its token counts, because the call was billed and the cost column must see it, but its text is never used as an answer. Rejected: prefix matching, which would accept an alias resolving to a different tier; failing on a changed `system_fingerprint`, which also moves for infrastructure reasons and would be noise. The fingerprint is recorded instead, because for an unversioned alias like `deepseek-flash` — which will be repointed without its name changing, and which the guard therefore cannot catch — it is the only trace a repoint leaves. `deepseek-v4-flash` stays in config rather than being deleted: `summarize` skips generations whose model is undeclared, so removing it would silently erase it from run `v2`'s report. |
| 96 | `hip explain` probes hosted tiers before choosing one, so a withdrawn or routed pin genuinely falls through. | Milestone 12 documented the preference list as falling through on a withdrawn pin, and it never did. `resolve` decided availability with `runner.available()`, which for a hosted cohort only checks that a key is set — a condition a withdrawn model passes. So a dead pin resolved as available and then failed every region one at a time, and a routed pin was worse, since it never failed. Fall-through covered a missing key, not a missing model. `resolve(probe=True)` now calls each hosted tier once before selecting it, at a few tokens per tier per run, and skips any that is unreachable or answered by another model; `hip explain` always passes it. It stays off by default so that asking what the list *would* pick costs nothing. Explicit `--model` and `--all` runs skip `resolve`, so they verify each hosted model once up front instead — otherwise a routed pin costs one paid failure per region, 21 calls to learn a single fact. Local models are never probed: they run the weights on disk, and there is nothing a provider could substitute. |
| 97 | A reasoning model cut off by its budget before producing any answer is `truncated_reasoning`, whatever channel its reasoning came through. | Truncation was detected only from an unterminated `<think>` tag in the answer text, which is how the local runtimes emit reasoning. DeepSeek returns reasoning in a separate `reasoning_content` field, so the check never saw it: three empty `v2` answers that spent all 6,000 output tokens reasoning were recorded as `truncated_reasoning=False`, and the explain path therefore reported "no reasoning emitted" over 6,000 tokens of it. A `finish_reason` of `length` (OpenAI-shaped) or `MAX_TOKENS` (Gemini) with an empty answer now counts as truncated. Deliberately *not* when some answer text arrived: running out mid-answer is a different finding from running out mid-thought, and conflating them would misreport which one happened. |
| 98 | Reasoning effort is a field of the candidate, sent in each provider's own shape and recorded on every generation; `default` sends nothing. | Run `v2` compared seven models each at its vendor's default, and the defaults differ enough to decide a cost column on their own — DeepSeek V4 thinks at high effort unless told otherwise and spent 93-95% of its output there, Mistral none — so part of what it measured was vendor defaults, and the report had to say so in a hand-written caveat. A `CandidateModel` field makes a configuration a candidate: a lower-effort setting gets its own id and is measured as one, never toggled at generation time, which is what keeps Milestone 8's rule — only a benchmarked configuration writes — true once effort can vary. The setting is recorded on each `Generation` rather than read back from config when a report renders, for the reason `served_model` is read back (#95): config can change after a run, and the artifact has to say what an answer was asked for. `default` adds nothing to the request, so every existing candidate's body is byte-identical to what `v2` sent and its benchmark still describes it; records written before the field parse as `default`, which is exactly what they were. Rejected: effort as a run-wide or cohort-wide option, which would let one id mean different configurations in different runs; and as a `hip explain` flag, which would publish prose from configurations no benchmark saw. Costs a candidate id per setting, which lengthens the slate and the report. |
| 99 | The effort vocabulary is what a model has been seen to accept — `default`, `disabled`, `low` — declared per provider in config and sent from the dialect. | `disabled` is DeepSeek's `thinking: {"type": "disabled"}`, a hard off, and makes a claim the report checks: a `disabled` generation that reports reasoning tokens is flagged. `low` is Gemini 3.7 Flash's `thinkingConfig.thinkingLevel: "low"` and claims only a level. Both were called before being accepted, on 2026-09-10. `REASONING_CONTROLS` in `hip.config` declares what each provider offers, so config refuses at load a setting a local runner cannot send or a provider does not offer; the wire fragment lives beside each `_Dialect` in `hip.eval.runners.hosted`, and a test holds the two tables equal, because a setting that validates and is then dropped would record answers against a configuration that never reached the model. Rejected: every level the providers document. `minimal` is documented for Gemini 3 Flash, and 3.7 Flash answered it with `400 Thinking level MINIMAL is not supported for this model` — an accepted value no model honours is the same unverified claim as a pin copied from a blog. Rejected: Gemini's legacy `thinkingBudget: 0`, which measured the same as `low` (549 output tokens, no thinking) but is kept for backward compatibility only, with no documented meaning on Gemini 3. Rejected: Mistral's `reasoning_effort`, because `high` turns `message.content` into a list of chunks that `_extract` would stringify and grade, and `none` is what `v2` measured at the default. Costs: capability is per provider, which one model can contradict — `hip eval models --probe` sends each candidate's setting, and is how `minimal` was caught before any run. |
| 100 | Eligibility belongs to a configuration, not a name: one candidate id is one configuration, enforced wherever a run or a write could mix two. | Once effort is a field, editing it on a benchmarked candidate would keep the id eligible while the configuration was new — the back door Milestone 8's rule closes, reopened by a config edit. So `resolve` compares each listed model's configured effort with the effort its benchmark measured, read from the generations, and skips a mismatch; `hip explain --all` and `--model`, which bypass `resolve`, repeat the check against the latest run; `hip eval run` refuses to resume a candidate whose recorded answers used another effort rather than averaging two configurations under one id; `hip check-config` rejects two ids declaring the same ref at the same effort; and a model measured at two efforts is excluded from selection by `meets_the_bar`, the predicate `passed_benchmark` now calls instead of restating. Rejected: effort in `Generation.key`, which would let a resume quietly start a second configuration under the same id in the same run. Costs: changing a listed model's effort now needs a re-benchmark before it writes, which is the intent. Not covered, and recorded rather than widened: `--all` and `--model` still require no benchmark for a model the latest run never measured, and a changed `ref` is invisible for runs recorded before `served_model` existed. **The first gap was closed by #102 on 2026-09-11.** |
| 101 | The judge grades at effort `high` from run `v3`, under a 16,000-token ceiling, and every verdict records its effort and the tokens it was billed for. | Effort is part of the instrument: like the judge's prompt, changing it moves scores, so it changes only at a run boundary. `v3` is one — new packets and a new slate already make it incomparable with `v2` — so no comparison is lost that was not already gone. `v1` and `v2` were graded at `medium`, a saving whose quality cost was never measured, on a judge whose scores decide close calls (`v2`'s top two were 0.09 apart) and in a run whose main question, whether lower reasoning effort costs quality (#98), is a close call by construction. `high` is the API's own default and the floor Anthropic recommends where accuracy matters. `max_tokens` rose from 3,000 because thinking and the verdict share it: at `high`, 3,000 would cut verdicts off mid-JSON and record paid-for answers as failed judgments, and a ceiling is not a reservation (#93). The verdict records `judge_effort`, `input_tokens` and `output_tokens`, because a report re-rendered later must name what its scores were graded at — read from the verdicts, as #98 reads effort from the generations — and because nothing had recorded what judging actually cost: `v2`'s $4.15 was the quote, not the bill. `hip eval cost` quotes output per verdict by effort; `high`'s 5,000 is a planning figure that `v3`'s recorded usage replaces. Considered and not run: a pilot re-judging `v2` answers at both efforts first, for about $1 — the change lands at a run boundary either way, and scores at the two settings are never compared. Rejected: the server-side refusal fallback Anthropic recommends for Opus 5, which the Batch API does not accept and which would put verdicts from a second judge into one table. Costs about $4 more per 120-verdict run until `v3` measures it. |
| 102 | `hip explain` publishes only from a model that passed the latest *judged* run, on every path; a model that cannot be used is skipped and named, and the exit status separates clean, partial and nothing written. | The preference list has required the benchmark since Milestone 12, but `--all` and `--model` never did (#100 recorded the gap), and `--all` is the path every published explanation has taken since Milestone 19 — so the reader-facing comparison was the one door unmeasured prose could publish through. `benchmark_problem` in `hip.eval.selection` is now the single gate for all three paths: passed in the latest judged run, at the configuration config sets now. A failing model is skipped rather than the command refused — a routed pin must not stop four other models' prose — and skipped rather than published with a warning, because in an unattended run a warning is read after the deploy. It fires only when config and the benchmark disagree: once the list is rebuilt from a run, every model on it was measured. "Latest" means latest *judged*: a run exists from its first file, and taking one still generating as the latest made every model ineligible for as long as a benchmark ran, a hazard the preference list had carried since Milestone 12. A `RunnerUnavailable` partway through now skips its model instead of ending the command for every model after it, and the run ends with one line per requested model. Exit status: 0 when every requested model's prose is current, 3 when some is but a model was skipped or a region failed, 1 when none is; not 2, which Click uses for usage errors. A scheduled refresh deploys on any of them — prose that was not rewritten stays up and the site labels it stale in place — and alerts on anything but 0. `--unbenchmarked` stays the bootstrap override on every path and lifts the configuration check with the benchmark, as it always has in `resolve`; #100's check on `--all` and `--model` applied even with it, and no longer does. Rejected: generating from an unmeasured model and flagging it, the first instinct and taken as far as it safely goes — nothing stops the command. Rejected: refusing the whole command when any model fails the gate. Costs: a model added to the list without a run is absent from the comparison until one passes it, reported by the summary and exit status 3 rather than by an error. |
| 103 | A run's scenario set is frozen once anything is generated against it, every `hip eval` command names its run, and scenarios default to the Markdown payload `hip explain` sends. | `hip eval scenarios` replaced its file unconditionally and every `hip eval` command defaulted to `--run v1`, so README's bare commands — and `make eval`, which ran them — would rewrite `v1`'s scenario set from today's packets, append new candidates to its generations, bill a batch to judge them, and re-render its report. The payload default was JSON, while `hip explain` has always sent the Markdown rendering the region reports use (#45). `v1` passed `--format markdown`; `v2`'s scenarios were built on 2026-09-06 by a command without the flag, so `v2` measured prose written from a payload the site never sends — nobody chose JSON. The comparison within `v2` is fair, since every model got the same packets, but it measured an input production does not use, and its cost column overstates what the site pays by roughly the input share (as JSON, a county packet is about three times the tokens it is as Markdown). A set with generations is refused even with `--replace`; a draft with none needs `--replace`; the check runs before any packet is built. Rejected: defaulting `--run` to the latest run — the command that creates a run cannot default to an existing one, and read commands defaulting differently from write commands would be their own trap. Costs: `--run` on every invocation, and `make eval` needs `RUN=`. |
| 104 | Every candidate is sent one sampling setting — temperature 0.0 — and the report names the candidates their provider samples differently or advises otherwise. | Decided on 2026-09-10 for `v3`. DeepSeek ignores temperature while its models reason, so `deepseek-flash` against `deepseek-flash-nothink` varies sampling as well as reasoning; Google recommends 1.0 for Gemini 3 and warns that lower values can cause looping. Accepted rather than designed away: sending each provider its own recommended setting would make every row a different sampling configuration, and the comparison would measure vendor defaults again — the problem #98 fixed for reasoning. `v2` showed no looping from Gemini at 0.0. The tables cannot show any of this, so `_sampling_note` in the report states it, derived from the run: the temperature from the sampling mode each generation records, reasoning from its token counts, and each provider's behaviour from a short table of what it documents. A run neither provider is in renders nothing, so `v1` is unchanged; `v2` gained one paragraph. Rejected: measuring whether a temperature was honoured, which no response reveals. Costs: a mode's temperature is read from config when the report renders, the hazard the rates carry. **Qwen's guidance joined the note on 2026-09-11 (#105).** |
| 105 | Qwen, through Alibaba Cloud Model Studio's International endpoint, is a fourth hosted provider, benchmarked in `v3` as a contender for the China slot: two pinned snapshots, each with thinking on and off. | The China slot has been DeepSeek's for its jurisdiction, and DeepSeek cannot be pinned: it serves moving aliases, repointed a Flash and a Pro checkpoint without renaming either, and retired two names within a month (#95). V4 Flash also scored below the local Gemma in `v2`. Qwen offers what that slot lacks — dated snapshots, `qwen3.7-flash-2026-07-15` and `qwen3.7-plus-2026-05-26` — without leaving the regime, so if DeepSeek falls below the bar the slot has a measured replacement rather than an empty place. It is not a fourth regime: Alibaba is Chinese, and one policy action against Chinese providers reaches both. A cheap and a mid tier, as for every provider, each at its default and with `enable_thinking: false`, because Qwen 3.5-3.8 think by default and thinking is most of the cost: on one county packet it was 2,268 of Flash's 2,497 output tokens and 2,378 of Plus's 2,796. Both controls were called and measured before being recorded (#99), and every response named exactly the snapshot requested, so the substitution guard applies unchanged. The endpoint speaks the OpenAI shape with DeepSeek's reasoning conventions, so the whole integration is a `_Dialect` entry and a `REASONING_CONTROLS` entry (#78). Singapore because an API key is bound to its region and only Singapore carries the new-account free quota; the cost column prices at list regardless, since that is what the site pays once the quota is gone. Rejected: the Max tier, at $2/$6 per million tokens, priced like candidates Milestone 12 already turned down; the newer `qwen3.8-flash`, which has no dated snapshot yet; the open-weight 27B and 35B models, which fit no 16GB machine locally and offer nothing hosted that Flash and Plus do not. Considered and left for later: Model Studio also serves `deepseek-v4-pro-0813`, the checkpoint `v2` measured, as a pinned snapshot — the only pinned DeepSeek on offer, but a different host makes it a different candidate. Sampling stays at the harness's one setting (#104), and the report's sampling note names every Qwen candidate held below its publisher's guidance, as it names Gemini 3: Qwen gives none for 3.7, which is API-only, and Model Studio's reference gives ranges rather than recommendations, so the note cites the model cards for 3.6 and 3.8, the releases either side — temperature 1.0 when thinking, 0.7 when not — which, unlike Qwen3's, do not warn against greedy decoding. One provider default the pin does not reach: Model Studio applies `presence_penalty` 1.5 to Qwen 3.6-3.8 in non-thinking mode, and 0 otherwise, so the two thinking-off candidates are sampled with a repetition penalty no other candidate gets; recorded rather than overridden, because sending a penalty would change what every default candidate has been measured under. Costs: four candidates add 60 generations and about $4 of judging to `v3`. |
| 106 | Fair Market Rents are their own source, `hud_fmr`, fetched per state and fiscal year, dated as the fiscal year they are, and kept at county level; `fmr_to_income` sets them against ACS income. | A source is what a reader sees credited beside a figure, so FMRs are not a layer of `hud`, whose name is "USPS ZIP crosswalk and income limits" — CHAS is split out for the same reason (#107). `/fmr/statedata/{state}` answers all 21 counties in one 9KB call, so ten fiscal years are ten requests where the per-county endpoint the source list was sized on would take 210. A fiscal year runs from 1 October: FY2026 took effect on 2025-10-01, so it is dated 2025-10-01 to 2026-09-30, where income limits are dated as calendar years (#38) — a quarter out for FMRs, and enough to pair each rent with income data a year newer than it was set from. `fmr_to_income` joins through the year the fiscal year starts in, so FY2024 meets the ACS vintage ending 2023, and county rent affordability runs every county and year where `rent_to_income` covered 19 counties. County level only: an FMR is set per area, and allocating it to a municipality is what `hud_county_ami` already says HUD does not sanction. Rejected: the nine NJ counties' Small Area FMRs, which are ZIP-level and apply to vouchers there — a later addition, recorded in Known Limitations. Rejected: FY2027, published but not in force until 2026-10-01; `FMR_YEARS` gains it then, the explicit bump `BLS_END_YEAR` gets. Costs: counties sharing an FMR area share a figure — eleven areas across 21 counties — so ranks among them compare areas; and HUD set some NJ areas at the 50th percentile until FY2020 (six counties in FY2017-2018, two in FY2019), so the 10-year and since-2019 windows mix two standards, which the packet caveat says. |
| 107 | CHAS is its own source, `hud_chas`, at county and municipal level for the 2018-2022 vintage, with municipal refs derived from HUD's MCD directory fetched as a release; it sits beside the ACS burden ratio rather than replacing it. | HUD tabulates cost burden from ACS microdata, so CHAS gives what no ACS table the warehouse reads can: severe burden (over 50% of income) and owner burden. Municipal refs cannot come from config — they are HUD's MCD codes, and HUD publishes the list (`chas/listMCDs/34`, 571 entries) — so the directory is fetched and cached like any release, and `fetch_all` derives the municipal refs from its content; a re-run, and `hip load` rebuilding provenance, therefore touch no network once it is cached. A CHAS row names its municipality by MCD code and names no county, so `stg_hud_chas` resolves state plus MCD code to a GEOID through TIGER, the file `stg_nj_municipal_codes` already reads: exact FIPS, no names. Denominators include households HUD could not compute a burden for, the universe the B25070 ratio uses, so the two read side by side. One vintage: they overlap by four years as ACS ones do, 2019-2023 is not yet published, and the ACS ratio already carries the trend — so CHAS metrics are snapshots ranked by value (#52). The field codes are read from HUD's own dictionary; a third-party mirror labels `A1` as total households, which the data contradicts. Rejected: HUD's bulk CHAS files, national per summary level, where 21 counties and 571 municipalities are 592 small requests. Rejected: replacing `acs_renter_cost_burden`, as the source list proposed — that would trade five vintages of trend for one. Costs: 592 releases, and requests paced to HUD's limit (#111). |
| 108 | ACS occupancy and tenure are requested under their own layers, `housing_county` and `housing_cousub`, rather than as more variables on the existing request. | The raw cache is keyed by (layer, scope, vintage), not by URL (#10), so a widened request under the old key would have been answered from the cached files that lack the new columns — silently, with a pipeline that ran clean and a vacancy rate that never appeared. Separate layers also give the new rows their own releases, so an income figure's provenance does not move because a tenure table was added. `stg_census_acs_housing` computes vacancy (B25002, vacant over all units) and homeownership (B25003, owner-occupied over occupied) for county and municipality. Rejected: forcing a re-download of the ten existing files, which would have re-minted every ACS release for no change in their numbers. Costs: ten more requests and ten more releases. The latent hazard stays for any source whose request changes under a fixed key; the rule is a new layer when the request changes. |
| 109 | FHFA's all-transactions index is read from `hpi_master.csv`, already fetched for `fhfa_hpi`, as a second metric — not from FRED's `NJSTHPI`. | `NJSTHPI` is FHFA's all-transactions index for New Jersey, republished by FRED; the master file carries it quarterly from 1975, with its source release already recorded. Fetching it through FRED would put FHFA's numbers under a second source and a second release. It is a separate metric, `fhfa_hpi_all_transactions`, rather than spliced onto the purchase-only series, because the two index different transactions — refinance appraisals are in one — and one is seasonally adjusted and the other is not. Costs: none in fetching; one more state-level metric, which like `fhfa_hpi` cannot be ranked across counties. |
| 110 | Building permits reach municipalities through the Census region's place file, resolved by its FIPS MCD column. | The source list expected a name match, saying place codes are not MCD FIPS. The Northeast place file carries county and MCD FIPS codes for every permit-issuing place, and in New Jersey every such place is a municipality, so state, county and MCD make the municipal GEOID exactly. Measured on 2026-09-11: 2024's municipal permits sum to the county file's total exactly, 36,596 units. One file per region per year covers nine states, so Milestone 14 needs no new fetches for them. Only the Northeast is mapped in `PLACE_REGIONS`, because it is the only region file that has been read; another state is refused with the fix named, rather than guessed at as a URL. The county file is read by name (`????.parquet`) so the place files beside it, whose columns differ, never reach `stg_census_permits`. Costs: permit counts below county level are small and volatile, which `permits_volatile` already says. |
| 111 | An adapter can declare `request_interval_s`, and a download answered HTTP 429 waits before retrying; the three HUD adapters pace at 1.1 seconds. | HUD User allows 60 requests a minute per token (`x-ratelimit-limit: 60`). The first municipal CHAS run stopped at release 101, because the retry loop retried a 429 instantly three times — spending every attempt inside the same window. Pacing lives in `SourceAdapter._download`, so a cached release never waits and every adapter can opt in; a 429 honours `Retry-After`, capped at a minute, or waits the minute when none is sent. Every HUD adapter paces, since the three share one token. Rejected: a pause inside the CHAS adapter alone, which the next HUD dataset would have to rediscover. Costs: a fresh CHAS fetch takes about twelve minutes; a cached one takes none. |
| 112 | Citation binding lives in `hip.packets.citations`: one index of every figure a packet licenses, used by `hip explain` as its publication gate and by the evaluation as its fabrication count. | The figure check existed only in the evaluation (#58), so published prose was vouched for by fifteen benchmark answers per model and nothing else: `hip explain` stored whatever came back, and none of the 105 published explanations had been checked one by one. One index with two callers makes the rate a benchmark reports and the rate at which the site refuses prose one number from one piece of code. It lives with the packet, not in `eval`, because it is a property of the packet — as `packet_hash` is (#61) — and both evaluation callers import it without importing each other. A binding records, per figure, a character span, the packet field path, its kind (value, window start, change, annualised rate, rank, cohort, percentile, year, vintage, or the packet's own wording), metric, period, release ids, match method, and `alternatives`, the fields it matched equally well. The licensing rules keep the checker's generosity (#116); what is new is attribution — the field whose unit the writer used ("4%" is a rate, "$452,500" a value), then the one whose metric the sentence names or has already cited, so "Home value: $452,500, rank 4 of 21" binds the rank to home value even where another metric also ranks 4. Measured on `v2`'s answers against their own packets: 976 of 977 figures bound, 879 of them to exactly one field. The dashboard marks each cited figure and lists where it came from. Rejected: asking models to tag their own figures — a prompt change that would need benchmarking, and a tag a model can get wrong; a language model as the binder, which is the thing being checked (SPEC: a model does not replace deterministic validation). Costs: between equal numbers attribution is a best reading, stated as `alternatives`; and binding licenses figures, not claims — a correct number in a wrong sentence passes (Known Limitations). |
| 113 | Prose stating a figure its packet does not carry is refused rather than stored; the run counts refusals apart from failures and exits 3. | The guardrail on prose published under a personal domain, which is why Milestone 13 preceded any expansion (ROADMAP). `v2` measured one unsupported figure in 1,007, and that one was a checker error (#116), so at `v2`'s rate a strict gate costs almost nothing, while any laxer rule is a judgement about which invented numbers are acceptable. A refusal leaves the model's previous row where it was — stale prose stays up labelled stale, as a skipped model's does (#102) — and the summary names every unbound figure with the nearest value the packet carries, so a false refusal points at the binder rather than disappearing. Rejected: storing the prose with the unbound figure flagged, which publishes a claim the data does not back, flag or not; retrying, which with sampling pinned at 0.0 asks for the same answer twice. Costs: a false refusal loses a model's reading of that region until the binder is fixed; `v3`'s `Bound` column measures the rate before the regeneration spends anything. |
| 114 | Staleness is decided on a content hash that leaves provenance out, and a stored explanation whose figures have not moved is re-bound instead of regenerated. | Carried from Milestone 12's review: the packet hash covers `fetched_at` and every release id, so a re-download that mints a new release without moving a figure made prose stale, and a scheduled refresh would have paid a model to rewrite accurate text. `packet_content_hash` drops release ids, source ids, match methods, `sources[]` and the contract version, and keeps every figure, label, caveat, rank and date — anything the prose may have said. `hip explain` classifies each stored row: `current`, `rebind` — its words still describe the packet but its citations do not, because only provenance moved or because it predates binding — or `stale`; a rebind re-cites the unchanged prose against the current packet for free. The API's `stale` flag applies the same rule (`still_describes`). Migration 0011 adds `binding` and `content_sha256` as null on existing rows, which are bound only when their packet has not changed at all — the one case where binding them is exact. Rejected: display-precision hashing, Milestone 12's plan, since #88 left no float precision to discard and the churn was a timestamp; binding old rows against today's packet in the migration, which would cite numbers they were not written from. Costs: between a provenance-only change and the next `hip explain`, a row's citations name the superseded release — accurate about when it was bound, and repaired by the next run. |
| 115 | A scenario keeps the packet it was rendered from, and `hip eval run` and `hip eval check` grade against it; a run with no packet to recover is refused. | Both commands rebuilt packets from the live warehouse, so a check was right only if nothing had loaded since the scenarios were built — and `hip eval check --run v1` on 2026-09-11 would have re-graded `v1` against Milestone 21's numbers and overwritten its record. A JSON payload is the packet, so `v2` is checkable; Markdown cannot be read back, so `v1` has no ground truth left and is refused with that said; every set built from now on carries its packet. Neither command needs Postgres any more. Rejected: approximating `v1` against today's warehouse, which writes a fabrication rate nobody measured over the one that was. Costs: `scenarios.jsonl` carries the packet, about 28KB per scenario. |
| 116 | Five checking rules changed with binding, so `v3`'s fabrication rate is measured by a different instrument than `v1`'s and `v2`'s. | Found by re-deriving `v2` under the binder. (1) A decimal, percentage or amount under 20 is checked: the old rule skipped every number under 20 that failed to match exactly as an ordinal — 57 figures in `v2`, every one of which does match, so it hid no fabrication, but a gate cannot keep it. (2) A figure is quoted from the payload only as a whole token: substring matching had licensed 452 from $452,500; in `v2` it rescued four figures, none invented. (3) A negative value's size is licensed beside a word that says which way it moved ("fell 36.66%"), which three of those four needed; a bare "36.66%" states a rise. (4) Years and vintages match exactly: the 0.5% tolerance was ten years wide at 2020. (5) Durations and hyphenated descriptors — "5-year", "4-person" — are structure. Parsing changed too: "pre-2018" is the year 2018, and the typographic minus is a sign. `v2` re-derived: one unbound figure in 977, Mistral Large 3's "591 891" written with a space; its one recorded fabrication, Mistral Small 4's, was the old checker reading "pre-2018" as minus 2018. `v1` and `v2` keep their stored checks, and the report's `Bound` column appears only for runs checked by binding, so both render unchanged. Rejected: re-checking `v2` and republishing it — a published result changed to fix a checker, for a run `v3` replaces. Costs: the Unsupported column is not comparable across the `v2`/`v3` boundary, as the rubric already is not (#101). |
| 117 | Packet 1.2 carries the provenance of each change window's start. | A packet named only the observation behind `end_value`, and in 10 of Mercer County's 19 metrics the start comes from an older release — ACS 2019 against 2023, HUD FY2020 against FY2024 — that `sources[]` never listed; a binding cannot cite a release the packet omits. `start_release_id` and `start_match_method` are resolved the way `hip analyze` chose the start observation, and `sources[]` lists the releases at both ends: Mercer's packet names 15 releases where it named 10. Additive, like 1.1: every new field is optional and 1.1 still parses, which the evaluation needs for `v2`'s stored packets. Timed for free: Milestone 21 had already made every explanation stale and `v3` was not yet built, so the change costs no regeneration and `v3` measures the final shape (ROADMAP). Costs: five more source rows per county report, about 180 tokens a prompt. |
| 118 | The preference list is set from run `v3`: Gemini 3.7 Flash at low thinking, DeepSeek V4.1 Flash with thinking off, Qwen 3.7 Plus, Gemini 3.1 Flash-Lite, then Gemma 4 E4B; the EU tier leaves. **Supersedes Milestone 12's ordering and its three-regime rule.** | Ordered by `v3`'s rubric (3.77, 3.57, 3.46, 3.10, 3.13), graded at effort `high` and so not comparable with `v2` (#101); every hosted tier writes before the local model only because it measured better, with one exception. Gemini 3.7 Flash leads at `low` (#98): its default scored 3.75 at nearly twice the cost, and one model at two settings would be one reading twice. The China slot goes to the better of its contenders, DeepSeek with thinking off; thinking on scored 2.78, three answers cut off by the benchmark's ceiling (Known Limitations). Qwen 3.7 Plus is a second China tier because it is pinned (#105): a DeepSeek repoint or retirement falls to a model that cannot change under its name, and with Free Quota Only on, the quota lapsing on 2026-12-10 is a failed probe and a fall-through, not a bill. Gemini 3.1 Flash-Lite stays at the owner's request, as a cheap in-provider step-down and the fifth reading on every county page; it scored 0.03 below Gemma, a gap fifteen answers cannot separate, and sits above it because the list must end on this machine (`check_config`). Mistral Small 4, the EU tier since Milestone 12, scored 2.68 — below the local model — so it should never write before it, and the failover its regime offered is one this machine now provides better. DeepSeek V4 Pro leaves because DeepSeek routes it to another model from 2026-09-14 (#95). Rejected: keeping Mistral for regime diversity, which ranks a hosted tier above a better local one — backwards on quality; both Gemini 3.7 settings. Costs: the tiers share two failure domains, Google (1 and 4) and China (2 and 3), so one policy action against Chinese providers leaves Google and then the local model; and a refresh run somewhere Ollama is not installed would lose the one tier Mistral would have covered. |
| 119 | `hip explain --prune` deletes the covered regions' stored explanations from models neither on the preference list nor named in the run; nothing else deletes one. | `hip explain` replaces a model's reading when it writes a new one and never deletes on its own, so a model that leaves the list keeps its rows, and `/regions/{id}/explanations` serves every stored row — after `v3`'s reorder, three retired models would have gone on appearing beside their replacements. Explicit, and scoped to what the run covers: the regions and window it generated for. It keeps every model the run names as well as every listed one, so `--model X --prune` cannot delete the reading it has just written for a model off the list; it refuses an empty keep-set; and it lists the rows it removed per model. It runs after generation, so a run in which no model was usable prunes nothing. Rejected: a one-off `DELETE`, which the next list change would need again; pruning on every run, which would make deleting a side effect of generating. Costs: irreversible, and a retired model cannot be asked again — the 63 rows pruned on 2026-09-11 were exported first, to `data/explanations-pruned-2026-09-11.jsonl`. |
| 120 | Two binding rules relax after the first regeneration against `v3`'s order refused correct prose: a share written as a whole percentage is a quotation, and the size of a negative value binds without a direction word. **Amends #116's rule (3).** | That regeneration, on 2026-09-11, refused 10 of Gemini 3.7 Flash's first 18 county explanations, and every rejected figure was a whole percentage beside a packet value: "47% of renters" for CHAS's 0.47498, "26%" for 0.26243. One, "42%", matched a negative value exactly, with no direction word the list knew. `v3` had not shown it because its answers quote figures, and explanations round them, as prose for a resident should. Shares: a value between -1 and 1 gains the form `round(x × 100)`, since the one-decimal form alone is 47.5, and the 0.5% tolerance cannot reach it from 47. Signs: the direction-word requirement was a claim check inside a figure checker — "improved 42%" for a falling unemployment rate and "outflows grew 42%" for a falling net-migration figure are both right, and neither names a decline — so a bare magnitude now binds, and still loses a tie to an outright form. Re-derived: `v3` unchanged, 2,301 figures with the same one unbound and no answer changing status; `v2` keeps its one unbound figure. Refusal messages now quote the words around each figure, because generation is not exactly repeatable and the "42%" sentence could not be reproduced. Rejected: a longer direction-word list, which would chase phrasing indefinitely while still checking a claim; a looser tolerance, which would license different figures of the same size. Costs: a change quoted with the wrong sign now binds, as a wrong direction word already could for a positive change. |
| 121 | Housing's type is Public Sans for display and text and JetBrains Mono for labels, self-hosted through `next/font` at build time; Space Grotesk appears only in the shared bar. | Chosen 2026-09-12 from four pairings trialled on Mercer's figures (TODO, "Decisions deferred to their milestones"). Public Sans is the US Web Design System's face, the typography of the federal sources these figures come from, and it has the tabular figures the tables depend on; JetBrains Mono matches jasonli.app's utility face. `next/font/google` downloads each face once at build and serves it from this site, so no reader's browser contacts Google — the local-first rule behind #39, applied to type. Rejected: Space Grotesk throughout, which gave Housing no identity of its own and set dense tables in a display face chosen for a twenty-word page; Space Grotesk over IBM Plex Sans; Atkinson Hyperlegible Next, the most legible and the furthest from the gateway. Costs: a cold build needs Google Fonts reachable once; three families where the system stack had none. |
| 122 | The shared bar's values are hand-copied from jasonli.app's `src/styles/tokens.css` into `web/app/tokens.css` as `--jl-*`. | The two sites should read as one ecosystem, and the bar — `Jason Li` leading back to the gateway, then the `Housing` wordmark — is the element that says so. jasonli.app's Milestone 4 will publish its tokens as a package; waiting for it was the better engineering and left Housing with no route home meanwhile, so the owner chose to copy now (2026-09-12, recorded in both repositories). The copies are few: the nav face, size, weight and tracking, two steps of the ink ramp and the live dot, each with its oklch form. `Jason Li` navigates in place, as jasonli.app's own project links do. Rejected: waiting for the package; loading jasonli.app's stylesheet at run time, which would put a second origin in every page's render path. Costs: the copies drift when either side changes, until the package replaces them. |
| 123 | Every caveat carries the metrics it qualifies: `hip.packets.scoped_caveats` returns each with its scope, `GET /regions/{id}/summary` gains `caveat_scopes`, and `caveats_for` returns exactly the texts it did. | Milestone 18 sets a caveat beside the figures it qualifies instead of collecting every caveat at the foot of the page, and a page cannot tell from a caveat's text which figures it is about. The rule sequence already decided each caveat from the metrics present, so its scope is the intersection that rule tested — one derivation, not a second mapping in the dashboard to keep in step (the reasoning of #46). The packet keeps its plain list, texts and order unchanged, so no content hash moves and no explanation goes stale. On a page, a caveat about one row is set under that row; one about several is lettered on each and set out under the table; one about the region as a whole goes under the tables (`web/lib/caveats.ts`). The report matches the packet's caveats to the summary's scopes by text, so the packet stays the authority on which appear. Rejected: scopes inside the packet, which would change every packet and regenerate 105 explanations for no change in what they say; pattern-matching caveat text in the dashboard. Costs: a caveat the summary is not told about — a thin cohort, a ZIP's named allocation weights — is treated as region-wide. |
| 124 | Shares render as percentages and multiples with ×, classified in `web/lib/format.ts`; the Markdown export keeps its ratios. | The unit `ratio` covers homeownership (0.62 of occupied homes) and price-to-income (4.13 times income), and a reader needs "61.9%" for one and "4.13×" for the other. Changing the unit would change every packet and stale every explanation, so the dashboard classifies instead: ten shares, two multiples, and a `ratio` metric in neither set throws during render, so an unclassified new metric fails `make publish` rather than shipping as "0.62" or "413%". Monthly money gains "/mo". The Markdown rendering is left alone because it is also every model's prompt (`hip.eval.prompts`): reformatting it would change what `v3` measured and what every future generation reads. Rejected: splitting the unit in `config/metrics.yml`, for the packet churn; a rule on the value, since a share of 1.0 and a multiple below 1 cannot be told apart by size. Costs: the report page shows 61.9% where its Markdown download shows 0.62. |
| 125 | A region page's change window is five years, stated rather than offered. | It is the only window published per region (`manifest.json` → `windows: ["5y"]`) and the only one with explanations. The trial drew a window control there; with one working option it would be a promise the data cannot keep. The New Jersey page does offer windows, because county rankings are published for five years, ten years and since 2019. Rejected: publishing summaries and packets per window, which triples the per-region artifacts and still leaves the interpretation five-year only. Costs: a county's ten-year change is found on the New Jersey page, not on the county's own. |
| 126 | The New Jersey page embeds every published county ranking at build, and the reader chooses the measure and window in the browser. | Until Milestone 18 the landing page's metric and window were module constants, so the front page answered one question. Rankings are small — about twenty measures, three windows, 21 counties — so all of them ride in the page and a switch needs no request, which a static export has nothing to answer anyway (#68). The county outlines are projected on the server (`web/lib/geo.ts`) and only the paths reach the browser. A window a measure does not publish is disabled and says why, rather than quietly showing another. Rejected: fetching rankings from the artifact origin on demand, which adds a second origin and a loading state to the front page; the selection in the URL, deferred rather than rejected. Costs: the page grew by about a third; a measure with no county change ranking — CHAS, MOD-IV — is not offered. |
| 127 | `/regions/1`, the state's own page, folds into the New Jersey page: neither it nor its report is exported, and `web/public/_redirects` sends both URLs to `/`. | The state page carried two FHFA index values, their caveat and the footer — a thinner page than the one titled "New Jersey" that already served as the state's front. Its figures sit on `/` now, with their caveat. A static export cannot redirect, because Next's `redirects` need a server, so the host does it: Cloudflare Pages reads `_redirects`, which `next build` copies out of `public/`. Region pages exclude `level = state` rather than naming region 1, so a second state would fold the same way. Rejected: exporting a page that only meta-refreshes, one more page to maintain. Costs: the redirect lives in the host's configuration, and another host would need its own. |
| 128 | The site footer groups sources by institution, and the non-commercial terms move to a plain line at the top right of every page. | The footer is a licence condition (#71), and it measured 563px at 1440×900 and 1,278px at 390×844. Grouping names each institution once and states a licence its datasets share once; every dataset still links to its homepage, now with its update cadence, and nothing collapses. The owner found the filled "Not for commercial use" block too loud, so the terms became a plain line under the county picker, naming the restricted sources from `GET /sources` — quieter to look at and, at the top of every page, harder to miss. It is not print-hidden. Each restricted dataset carries a Non-commercial tag pointing to it, the report keeps its own copy for paper, and NOTICE leads the footer's last line. Rejected: a toggle over the list, which the licence rules out; a full-width filled block, the owner's fallback. Costs: the terms appear at both ends of a report. |
| 129 | How a page is sectioned is presentation, kept in `web/lib/groups.ts` with an "Other measures" fallback. | The ledger, the current values, the report's tables and the New Jersey page's measure picker share four sections — Prices, Affordability, Incomes and jobs, Homes and people — so a reader learns one arrangement. The warehouse has no stake in page sections, and a `group` field in `config/metrics.yml` would widen the API for layout alone. Drift is the risk, a metric added to the config and not here, and the fallback answers it: an unlisted metric lands in "Other measures", never nowhere, and a test lists the catalog. Rejected: the config field; grouping by source, which splits prices across three. Costs: a new metric needs a line here to leave "Other". |
| 130 | The glossary lives in `web/lib/glossary.ts`: the sources' vocabulary, defined on hover and focus with no script, each term once per page. | Milestone 21 rewrote the metric labels in plain English, so what a reader still meets unexplained is the vocabulary of the sources — ACS, CHAS, Fair Market Rent, area median income, the two Zillow indexes, MOD-IV. Each definition is a button described by a tooltip, so it is reachable by keyboard, a tap opens it on a phone, and a screen reader announces it after the term. A term is marked the first time it appears on a page, because an underline on every "ACS" in a table is noise. The hairline is solid, never the interpretation panel's dotted citations. Rejected: each metric's `description` from `GET /metrics` as a tooltip on every label, which is written for maintainers ("ACS 5-year table B25003") and would underline every row; a separate glossary page, which is the scroll the milestone set out to remove. Costs: definitions are copy in the dashboard until the Post-Version 2 record-type field moves source descriptions into `config/sources.yml`. |

## Module Layout

What exists as of 2026-09-11. Every pipeline package now holds real modules; the
boundary rule in `tests/test_module_boundaries.py` enforces the import direction between
them. Planned files are marked with the milestone that adds them.

```text
housing-intelligence/
├── .python-version            # pinned patch version (#18)
├── config/
│   ├── sources.yml            # 15 sources: url, cadence, license, adapter name
│   ├── geography.yml          # in-scope states and levels (#14)
│   ├── metrics.yml            # 31 metrics: label, unit, frequency, direction
│   └── evaluation.yml         # candidates, scenarios, rubric, judge (#56)
├── schemas/
│   └── packet-v1.json         # published packet contract, generated from code (#43)
├── src/hip/
│   ├── cli.py                 # Typer entrypoint: 8 stages, explain, publish, footprint, schema, check-config
│   ├── config.py              # settings, YAML loading, env resolution, STATE_FIPS
│   ├── duck.py                # DuckDB session + /vsizip path helper (#23)
│   ├── footprint.py           # bytes per storage tier and per state (#66)
│   ├── publish.py             # API surface rendered to static files (#67)
│   ├── sources/
│   │   ├── base.py            # SourceAdapter, retry, content-addressed cache (#10)
│   │   ├── registry.py        # which sources have adapters; PLANNED names the rest
│   │   ├── tiger.py           # Census TIGER/Line: 5 layers (#22)
│   │   ├── zillow.py          # ZHVI + ZORI over county, city, ZIP
│   │   ├── census_acs.py      # 5-year estimates at county and cousub (#31, #108)
│   │   ├── census_permits.py  # Building Permits Survey, county and place (#110)
│   │   ├── fhfa.py            # hpi_master.csv — state level, two flavors (#109)
│   │   ├── fred.py            # MORTGAGE30US, national
│   │   ├── bls.py             # LAUS county unemployment
│   │   ├── irs_migration.py   # SOI county inflow/outflow, reduced to net
│   │   ├── hud.py             # crosswalk + income limits, FMR, CHAS (#37, #106, #107)
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
│   │   ├── models.py          # Region, RegionIdentifier, RegionCrosswalk, RegionExplanation
│   │   ├── load.py            # one-transaction upsert of spine and facts (#25)
│   │   └── migrations/        # Alembic 0001–0011
│   ├── analytics/compute.py   # change, CAGR, affordability, rankings (#34–#36)
│   ├── packets/
│   │   ├── schema.py          # Pydantic models = the contract (#12, #43, #44)
│   │   ├── assemble.py        # build_packet(session, region_id, window) (#42)
│   │   ├── caveats.py         # pure caveat derivation, shared with /summary (#46)
│   │   ├── citations.py       # citation binding: figure index + bind() (#112, #116)
│   │   └── report.py          # render_markdown(packet) — pure (#45)
│   ├── eval/                  # Milestone 8: model evaluation + explanations (#56)
│   │   ├── types.py           # Scenario, Generation, CheckResult, Judgment
│   │   ├── scenarios.py       # questions x sampled packets, deterministic
│   │   ├── prompts.py         # packet → JSON or Markdown payload; prompt assembly
│   │   ├── normalize.py       # reasoning/answer split across both runtimes
│   │   ├── checks.py          # the fabrication count, by binding (#58, #112, #115)
│   │   ├── runner.py          # the run loop: one local model at a time; hosted
│   │   │                      #   cohorts fan out to max_concurrency (#82)
│   │   ├── runners/           # base protocol (#57), ollama.py, mlx_runner.py,
│   │   │                      #   hosted.py — 4 providers, 1 runner (#78)
│   │   ├── selection.py       # preference list → the model that will write
│   │   ├── judge.py           # Claude rubric grading, Batch API; effort + usage per verdict (#101)
│   │   ├── store.py           # JSONL artifacts per stage, resumable
│   │   ├── report.py          # the published evaluation report (#59, #83, #98)
│   │   └── explain.py         # explanations; the binding gate and re-binding (#60, #113, #114)
│   ├── eval_cli.py            # `hip eval ...`; optional deps imported lazily
│   └── api/
│       ├── main.py            # FastAPI app, CORS for the dashboard origin
│       ├── deps.py            # session dependency; read-only by construction (#6)
│       ├── params.py          # RegionLevel and Window, shared by the routers
│       └── routers/           # health, regions, metrics, analytics, packets,
│                              #   explanations (#60)
├── dbt/
│   ├── dbt_project.yml        # staging = views, marts = tables
│   ├── profiles.yml           # duckdb (default) and postgres targets
│   ├── macros/                # zillow_observations, accepted_range,
│   │                          #   release_vintage (#53), nj_municipal_name (#51)
│   └── models/staging/        # 16 staging models + dbt tests
├── web/                       # Next.js 16 + React 19 dashboard
│   ├── app/layout.tsx         # fonts (#121), the shared bar, licence line, footer
│   ├── app/tokens.css         # palette, type, space; the bar's jasonli.app values (#122)
│   ├── app/globals.css        # base rules, the named component layer, print
│   ├── app/page.tsx           # New Jersey: measure and window chosen by the reader (#126)
│   ├── app/regions/[id]/page.tsx        # region: ledger, interpretation, trends, values
│   ├── app/regions/[id]/report/page.tsx # print-ready report from the packet (#45)
│   ├── components/            # Masthead, CountyPicker, LicenceLine, SourceFooter, Ledger,
│   │                          #   CurrentValues, CountyExplorer, Choropleth, TrendChart,
│   │                          #   ExplanationPanel, Glossed, PrintButton
│   ├── lib/api.ts             # server-side fetchers + packet types
│   ├── lib/format.ts          # value formatting (#41); shares and multiples (#124)
│   ├── lib/caveats.ts         # where each caveat sits on a page (#123)
│   ├── lib/groups.ts          # the four page sections (#129)
│   ├── lib/glossary.ts        # terms defined where they appear (#130)
│   ├── lib/periods.ts         # a period in its source's own terms
│   ├── lib/sources.ts         # the footer's institutions and the licence line (#128)
│   ├── lib/geo.ts             # county outlines projected on the server (#126)
│   ├── lib/windows.ts         # the New Jersey page's change windows
│   ├── lib/names.ts           # how a region is named to a reader
│   ├── lib/citations.ts       # a model's prose read against its binding (#112)
│   ├── lib/scale.ts           # ramp and breaks — pure and tested (#48)
│   ├── public/_redirects      # /regions/1 folded into / (#127)
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
├── tests/                     # 452 Python tests; API tests skip without a warehouse
├── alembic.ini                # URL comes from hip.config, not from here
├── docker-compose.yml         # postgres + postgis only (#13)
├── Makefile                   # setup, db-up, migrate, pipeline, api, web, test, lint
└── pyproject.toml             # deps + dev / dbt / mlx / eval groups (#19, #55, #56)
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
decision #6 true by construction rather than by discipline. Nothing imports `api` except
`hip/publish.py`, which replays the app to render the published files (#67);
`test_only_the_publisher_imports_api` fails if a second importer appears.
`web/` reaches the API over HTTP only and shares no code with Python. `config` and
`duck` are infrastructure leaves importable from anywhere (#23); every other cross-stage
import is a boundary violation. `cli` sits outside the chain and orchestrates all of it,
which is why every write path lives there.

## Warehouse Schema

**Every table below is built and populated.** Migration `0002` created `regions`,
`region_identifiers`, `region_crosswalk`, `sources`, and `source_releases`; `0003` added
`metrics`, `fact_metric_observation`, and `source_match_reject`; `0004` added the
`nation` level; `0005` added `fact_metric_change` and `region_rankings`; `0006` added
`region_rankings.basis` (#52); `0007` added `region_explanations` (#60); `0008` added
`regions.name_lsad` (#70); `0009` added `sources.homepage` (#72); `0010` keyed
`region_explanations` on the model and gave it a `rank` (#91); `0011` gave it `binding`
and `content_sha256` (#112, #114). Measured 2026-09-10, the
fact table holds 351,295 observations, with 26,805 changes, 26,790 change rankings and
11,884 value rankings derived from them.
`region_identifiers`, empty since Milestone 1, now holds 554 NJ municipal codes under
scheme `nj_cd_code` — the join MOD-IV was always going to supply (#21, #51).
The block below was regenerated from the live tables on 2026-09-10, and
`region_explanations` again on 2026-09-11 — every column in its
real order with its real type, and every key and constraint, restated for reading;
indexes other than keys are left out. The migrations stay authoritative for DDL.
`src/hip/warehouse/models.py` maps only the spine and `region_explanations`; the fact and
derived tables are written in SQL.

`fact_metric_observation.match_method` records how each row's geography was resolved —
`fips`, `zip_code`, `state_code`, `name_county` or `nj_cd_code`, plus `national` for the
nation row and `derived` for computed metrics. See #27: a municipal value matched by name
is a weaker claim than a county value matched by FIPS, and a consumer must be able to
tell them apart without redoing the join.

```sql
CREATE TYPE region_level AS ENUM
  ('state', 'county', 'municipality', 'zip', 'tract', 'parcel', 'nation');

-- Every geography, every level, one table (#7).
CREATE TABLE regions (
  region_id  BIGSERIAL    PRIMARY KEY,
  geoid      VARCHAR      NOT NULL,     -- Census GEOID, or source-native id
  level      region_level NOT NULL,
  name       TEXT         NOT NULL,     -- bare label: 'Boonton'
  state_code VARCHAR      NOT NULL,
  parent_id  BIGINT       REFERENCES regions(region_id),
  geom       GEOMETRY(MultiPolygon, 4269),  -- NULL only for the nation row (#30)
  name_lsad  TEXT         NOT NULL,     -- with legal status: 'Boonton township' (#70)
  UNIQUE (level, geoid),
  -- state, zip and nation have no parent; every other level must have one
  CONSTRAINT ck_regions_parent_by_level
    CHECK ((level IN ('state', 'zip', 'nation')) = (parent_id IS NULL))
);

-- A second identifier per region, by scheme: 554 NJ municipal codes (#21, #51).
CREATE TABLE region_identifiers (
  region_id  BIGINT  NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  scheme     VARCHAR NOT NULL,          -- 'nj_cd_code'
  identifier VARCHAR NOT NULL,
  PRIMARY KEY (region_id, scheme)
);

-- ZIP↔municipality is many-to-many, so it cannot live in parent_id.
CREATE TABLE region_crosswalk (
  from_region_id BIGINT  NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  to_region_id   BIGINT  NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  weight         NUMERIC NOT NULL CHECK (weight > 0 AND weight <= 1),
  method         VARCHAR NOT NULL,      -- 'hud_res_ratio' or 'area' (#37)
  PRIMARY KEY (from_region_id, to_region_id)
);

CREATE TABLE sources (
  source_id TEXT PRIMARY KEY,           -- 'zillow_zhvi', 'census_acs'
  name      TEXT NOT NULL,
  publisher TEXT NOT NULL,
  license   TEXT NOT NULL,
  url       TEXT NOT NULL,              -- canonical root; the packet carries this
  cadence   TEXT NOT NULL,              -- 'monthly', 'annual'
  homepage  TEXT                        -- page for a reader, when it differs (#72)
);

-- One row per file actually ingested (#9, #10, #53).
CREATE TABLE source_releases (
  release_id  BIGSERIAL   PRIMARY KEY,
  source_id   TEXT        NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  layer       TEXT        NOT NULL,     -- the file in the release: 'county', 'cousub' (#75)
  vintage     TEXT        NOT NULL,     -- '2023', 'current', or a derived digest (#73)
  fetched_at  TIMESTAMPTZ NOT NULL,
  file_sha256 TEXT        NOT NULL,
  row_count   BIGINT      NOT NULL,     -- rows, counted from the landed Parquet (#74)
  UNIQUE (source_id, layer, vintage, file_sha256)
);

CREATE TABLE metrics (
  metric_id   TEXT PRIMARY KEY,         -- 'zhvi_sfr', 'acs_median_hh_income'
  label       TEXT NOT NULL,
  unit        TEXT NOT NULL,            -- 'usd', 'usd_month', 'count', 'ratio'
  frequency   TEXT NOT NULL,            -- 'monthly', 'annual'
  direction   TEXT NOT NULL
              CHECK (direction IN ('higher_is_better', 'lower_is_better', 'neutral')),
  description TEXT NOT NULL,
  source_id   TEXT NOT NULL REFERENCES sources(source_id)
);

-- The one fact table (#8).
CREATE TABLE fact_metric_observation (
  region_id    BIGINT  NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  metric_id    TEXT    NOT NULL REFERENCES metrics(metric_id),
  period_start DATE    NOT NULL,
  period_end   DATE    NOT NULL CHECK (period_end >= period_start),
  value        DOUBLE PRECISION NOT NULL,
  release_id   BIGINT  NOT NULL REFERENCES source_releases(release_id) ON DELETE CASCADE,
  match_method VARCHAR NOT NULL,        -- how the geography resolved (#27)
  PRIMARY KEY (region_id, metric_id, period_start)
);
CREATE INDEX ON fact_metric_observation (metric_id, period_start);

-- Source geographies that matched no region, and why (#27, #28).
CREATE TABLE source_match_reject (
  reject_id    BIGSERIAL PRIMARY KEY,
  source_id    TEXT      NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  layer        TEXT      NOT NULL,
  region_name  TEXT      NOT NULL,
  county_name  TEXT,
  observations BIGINT    NOT NULL,
  reason       TEXT      NOT NULL,
  UNIQUE (source_id, layer, region_name, county_name)
);

-- Analytics output: derived, always rebuildable, never a source of truth.
CREATE TABLE fact_metric_change (
  region_id    BIGINT  NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  metric_id    TEXT    NOT NULL REFERENCES metrics(metric_id),
  "window"     VARCHAR NOT NULL,        -- '1y', '3y', '5y', '10y', 'since_2019'
  window_start DATE    NOT NULL,
  window_end   DATE    NOT NULL CHECK (window_end > window_start),
  start_value  DOUBLE PRECISION NOT NULL,
  end_value    DOUBLE PRECISION NOT NULL,
  pct_change   DOUBLE PRECISION NOT NULL,
  cagr         DOUBLE PRECISION,
  PRIMARY KEY (region_id, metric_id, "window")
);

CREATE TABLE region_rankings (
  metric_id  TEXT    NOT NULL REFERENCES metrics(metric_id),
  level      TEXT    NOT NULL,          -- a region_level value, stored as text
  "window"   VARCHAR NOT NULL,          -- as above, or 'latest' for a value ranking
  region_id  BIGINT  NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  value      DOUBLE PRECISION NOT NULL, -- the ranked quantity: pct_change, or the value
  rank       INT     NOT NULL,
  "of"       INT     NOT NULL,          -- cohort size
  percentile DOUBLE PRECISION NOT NULL,
  basis      VARCHAR NOT NULL CHECK (basis IN ('change', 'value')),  -- #52
  CHECK (rank >= 1 AND rank <= "of"),
  PRIMARY KEY (metric_id, level, basis, "window", region_id)
);

-- Generated interpretation: one row per region, window and model (#60, #91).
CREATE TABLE region_explanations (
  region_id     BIGINT      NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  "window"      VARCHAR     NOT NULL,
  model_id      VARCHAR     NOT NULL,
  model_label   TEXT        NOT NULL,
  runtime       VARCHAR     NOT NULL,   -- the provider, for a hosted model: 'gemini'
  body          TEXT        NOT NULL CHECK (length(body) > 0),
  packet_sha256 VARCHAR     NOT NULL,   -- the packet the prose was written from (#61)
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rank          SMALLINT    NOT NULL,   -- preference-list position when written (#91)
  content_sha256 VARCHAR,               -- the packet without its provenance (#114)
  binding       JSONB,                  -- every figure → field, period, release (#112)
  PRIMARY KEY (region_id, "window", model_id)
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
hip load      →  postgres: regions, facts, releases  transactional, all sources at once
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
thrown away and rebuilt from Parquet. `load` writes every source's facts in one transaction —
all of a refresh lands or none of it does — with the geography and the NJ municipal
codes in transactions of their own. `analyze` truncates and rebuilds its tables inside
one transaction rather than updating them incrementally, because they are cheap to
recompute and expensive to reason about when stale. `pack` is pure output: it reads the
warehouse and writes files, touching no database state, so it can be re-run at any time
and its artifacts deleted without consequence.

**Failure behavior.** `validate` failing is the designed stop: the warehouse keeps
serving the previous release and the report names the failing check, the source, and the
row count. `acquire` and `land` do not isolate sources: an exception from one adapter
ends the command, and the sources after it are not attempted — a HUD rate limit aborted a
forced re-acquire that way on 2026-09-06. Both are resumable rather than isolated, since
a re-run skips every release already cached or landed; per-source error handling waits
for scheduled refresh ([TODO.md](TODO.md)). A failure in `load` rolls back the whole fact
load, every source together, so the warehouse keeps the previous refresh intact. A
failure in `analyze` rolls back its single transaction, so the derived tables keep their
previous contents: `/rankings`, `/compare` and packets go on serving the last successful
analysis, stale but consistent. Every fact endpoint keeps working either way. (Until
2026-09-10 this paragraph claimed per-source isolation in `acquire`, per-source rollback
in `load`, and empty derived tables after a failed `analyze`; none was true. An earlier
version still promised 503 from the ranking endpoints, which nothing implements.)

**Degradation when a dependency is unavailable.** No Docker or no Postgres means stages 1
through 5 still run end-to-end — everything up to `load` is Parquet and DuckDB only,
which is deliberate: the expensive, slow work does not require the database to be up.

## Analysis Packets

The contract between deterministic analytics and any consumer (#12). Small, fully
computed, and validated against `schemas/packet-v1.json` before it is written. A county
packet is roughly 28KB: Mercer's, on 2026-09-11, carries 19 metrics, 22 levels, 15
sources and 7 caveats. It was 14KB with 15, 15, 8 and 5 before Milestone 21 added its
sources, and listed 10 sources before packet 1.2 named the release behind each window's
start (#117). Rendered as Markdown for a model, a county packet is about 2,200 tokens.

`src/hip/packets/schema.py` holds the Pydantic models that *are* the schema; the JSON
Schema file is generated from them and committed (#43), and `hip schema` prints it.
Assembly is `build_packet(session, region_id, window)`; the API calls it per request and
`hip pack` calls it in a loop (#42). An abridged example, with Mercer's figures from before
the July 2026 data arrived:

```json
{
  "packet_version": "1.2",
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
      "release_id": 41, "source_id": "zillow_zhvi", "match_method": "fips",
      "start_release_id": 41, "start_match_method": "fips" }
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
- Every figure names its release, both ends of a change window included (#117).
  `release_id` and `match_method` describe the observation behind `end_value`,
  `start_release_id` and `start_match_method` the one behind `start_value`, and
  `sources[]` lists every release either names. A binding cites these (#112).
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

**Surprising but intentional.** The packet is the whole of what a model may see (#12):
the evaluation's scenarios and `hip explain` both hand a model a packet, rendered as JSON
or Markdown, and nothing else. Before any model read one, the report renderer and the
dashboard's report page were its only readers — two independent media that exercised the
contract before an LLM could shape it (#11).

**Fixed at Milestone 7.** `metrics[].release_id` used to name the right source and the
wrong vintage (#47); the loader now keys releases on `(source, layer, vintage)` (#53), so
each ACS year cites its own release. The caveat that reported the defect is still built,
but it now asks the fact table whether provenance is actually collapsed for that region
rather than assuming it from the source's vintage count — so it disappeared on its own
when the data stopped warranting it, and would return if a future source regressed.

## API

FastAPI over Postgres, read-only (#6), served at `http://localhost:8000`. All fifteen
endpoints are implemented; `hip publish` renders every one to static files except
`/compare` and `/regions?q=` search, which do not enumerate (#67).

| Method | Path | Returns |
|--------|------|---------|
| GET | `/health` | ✅ service + database + last successful load timestamp |
| GET | `/regions` | ✅ paged regions filtered by `level`, `state`, `parent_id`, name `q` |
| GET | `/regions/{region_id}` | ✅ one region, its full ancestor chain, child count |
| GET | `/geo/{level}` | ✅ GeoJSON FeatureCollection, simplified by default |
| GET | `/metrics` | ✅ metric catalog with coverage and date range, optionally for one `level` |
| GET | `/regions/{region_id}/metrics` | ✅ observations filtered by `metric_id`, `from`, `to`, each with source and match method |
| GET | `/regions/{region_id}/summary` | ✅ headline changes, rank, caveats — dashboard landing |
| GET | `/regions/{region_id}/packet` | ✅ the analysis packet, assembled per request (#42) |
| GET | `/regions/{region_id}/report` | ✅ the same packet as `text/markdown` |
| GET | `/regions/{region_id}/explanation` | ✅ the preferred model's interpretation, labelled `kind: "interpretation"`, with a `stale` flag and its `binding` — every figure bound to the field and release that licensed it, null for prose written before Milestone 13 (#60, #92, #112, #114) |
| GET | `/regions/{region_id}/explanations` | ✅ every model's reading of the same packet, in preference order, each with its `stale` flag and `binding` (#91, #92, #112) |
| GET | `/rankings` | ✅ ranked regions for `metric_id`, `level`, and `basis` (`change` over a window, or `value`) |
| GET | `/compare` | ✅ aligned series for several `region_ids` |
| GET | `/sources` | ✅ source registry and the releases currently loaded (#71) |
| GET | `/sources/unresolved` | ✅ source geographies with no region, and why |

`/compare` takes one `metric_id` across several regions, not several metrics — the
earlier version of this table said otherwise. `/sources` was the last of the originally
planned endpoints, built on 2026-09-05 for the site-wide attribution footer (#71).
A packet already carried the releases behind its own numbers, which is what the dashboard
needed — but no surface outside a report exposed them, and attribution is a licence
condition rather than a report detail.

Provenance travels with a value wherever a reader meets one on its own:
`/regions/{id}/metrics` returns each observation with its source, vintage and match
method, and every packet and report cites the release behind each figure. The aggregate
endpoints — `/rankings`, `/compare`, and the summary's headlines — return values without
per-row provenance; the metric they name is the route back to its source. (An earlier
version of this paragraph said every response carried it.)

The API is read-only by construction rather than by permission. It connects as the same
`hip` role the pipeline writes with; what keeps it from writing is that no handler does,
and that `tests/test_module_boundaries.py` denies it every module that could (#6). A
read-only database role would make that a guarantee Postgres enforces as well; none is
configured. (An earlier version said one was.)

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
- **A warm Next cache can publish a stale page**, found 2026-09-05. The incremental cache is keyed
  on source, not on data fetched during the build, so a component whose markup is
  unchanged but whose API response has gained a field is served from cache — which is
  how a corrected footer shipped with no `href` on any link while the artifact beside it
  held the right values. `make publish` now deletes `web/.next` first, which costs a cold
  build on every publish.
- **The Markdown export still prints shares as ratios** (#124). The report page shows a
  homeownership rate as 61.9%; its Markdown download says 0.62, because that rendering is
  also every model's prompt, and reformatting it would change what `v3` measured. The two
  come back into step only with a benchmark run against a reformatted prompt.
- **A region page shows one change window** (#125), five years, the only one published
  per region. Counties' ten-year and since-2019 changes are on the New Jersey page;
  municipalities and ZIPs have no other window anywhere.
- **The shared bar's values are copies** (#122) of jasonli.app's tokens, and drift when
  either site changes until that repository's token package exists.
- **The static export is 3× the size of the data it displays** (#68). Measured
  2026-09-06, after Milestone 19: 1,135 regions produce 5,867 artifact files at 96MB and
  13,647 export files at 319MB, because every page embeds its own data and Next writes five RSC payloads per
  page alongside the HTML. Milestone 18's markup — sectioned tables, notes, definitions,
  the grouped footer — took it to 456MB at 13,649 files on 2026-09-12, a third more; a
  rank strip drawn as one element per peer had tripled it, at 564 elements a row on a
  municipal page, before it was redrawn as a background. Pre-rendering therefore breaks on file count before storage or
  bandwidth become a question, and it breaks at Northeast scale rather than national —
  roughly 123,000 export files for nine states, against a 100,000-file paid ceiling.
  Beyond that, region pages have to render in the browser from the published artifacts
  instead of being pre-rendered.
- **The per-page file cost grows when a shared component gains a fetch** (#68, #71). The
  attribution footer sits in the root layout and calls `GET /sources`, which added a
  fifth RSC payload to every route: 2,272 files and 62MB for one footer, taking the
  export from 11,375 files to 13,647. At 68% of Cloudflare Pages' 20,000-file free tier
  the headroom is real but finite, and it is consumed per *route* rather than per
  feature — so the cost of the next shared component is already known, and it is the
  same 2,272 files.
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
- ~~**`make pipeline` always dirties 21 tracked files.**~~ Fixed 2026-09-06 (#73).
  `analyze` wrote a new `hip_derived` release stamped with the run time, so every
  report's provenance table changed on every run even when no number moved. The release
  is now content-addressed, and a second `analyze` plus `pack --report` over an
  unchanged warehouse produces a byte-identical set of reports and packets. The same
  defect was silently marking every stored explanation stale, which is why it turned out
  to be a Milestone 12 blocker rather than cosmetic.
- **MOD-IV is one snapshot, so it has no change metrics.** Its six metrics carry a value
  and a value rank and nothing else; `/rankings?basis=change` returns nothing for them.
  A second vintage would need a second published composite, which NJGIN does not archive.
- **1.4% of parcels carry no `CD_CODE`** and are dropped before aggregation, because the
  composite could not confidently match the polygon to a MOD-IV record. They cannot be
  attributed to any municipality.
- ~~**There is no AI layer** (#11).~~ Superseded 2026-08-14: Milestone 8 added the
  evaluated explanation layer (#56–#60), and Milestone 12 moved it to hosted inference
  (#78). Packets are read by models as well as by the report renderer and the dashboard.
- ~~**Layer-level provenance is still approximate for keyed sources**~~ (#53). Fixed
  2026-09-06 (#75): every keyed staging model now carries `release_layer`, the layer of
  the file the row arrived in, so the loader's exact `(source, layer, vintage)` lookup
  matches instead of falling through. The understatement in the original wording is
  worth keeping on the record — this was not only "ACS county-versus-cousub", it was
  every BLS observation citing Atlantic County's file and 107 HUD releases collapsing
  onto five.
- **A net migration figure cites one of the two files it came from** (#75). Inflow minus
  outflow is genuinely derived from two releases and `fact_metric_observation` holds one
  `release_id`, so the row names inflow. Deterministic and documented rather than
  correct; a faithful answer needs a fact-to-release relation, not a column.
- **`census_tiger` releases record `layer` as a ref key** — `cousub:NJ@2025` rather than
  `cousub` — because `hip load` passes `ReleaseRef.key` where the metric path passes
  `ReleaseRef.layer`. Harmless today: TIGER produces regions rather than facts, so no
  observation resolves against it. Correcting it would create a second row per TIGER
  release rather than updating the existing one, which is why it is recorded instead.
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
  it is a flag, but each added region costs one generation per model per question — 40
  seconds to 3 minutes for a local model on this machine, seconds for a hosted one.
- **Reasoning is measured, never graded.** Only final answers reach the judge. A model
  whose reasoning is excellent and whose answer is wrong scores as wrong, which is the
  intent — but it also means the evaluation says nothing about reasoning quality.
- **Refusal detection is a heuristic** (`hip.eval.normalize.looks_like_refusal`): a
  phrase list plus a length ceiling. Tuned to under-report rather than over-report,
  because crediting a model for a decline it never made is the worse error. The judge
  scores refusal quality properly under `instruction_following`; the heuristic exists so
  the deterministic layer can score the refusal scenario without paying for a judgment.
- **Binding checks figures, not claims** (#112). A figure the packet carries is licensed
  whatever the sentence around it says: Gemma 4 E4B's reading of Mercer County on
  2026-09-11 counted homeownership's -1.8% among several "strong increases", with every
  one of its 14 figures bound. In a benchmark the judge catches that, under
  `factual_accuracy`; in production nothing does. The counted rate is a floor on error,
  not an accuracy measure. Since #120 that includes a change's sign: a bare "36.66%" for
  a decline binds.
- **Between equal numbers, attribution is a best reading** (#112). Where several fields
  hold the number — two metrics that both rank 4 — the binding goes by the unit written
  and the metric the sentence names, and records the rest as `alternatives`; 97 of the
  976 figures bound in `v2`'s answers had some. Licensing is exact, the field it names is
  not always, and the dashboard's tooltip says so.
- **A wrong rank or count under 20 is not caught.** A plain whole number under 20 that
  matches nothing is read as an ordinal ("the 3 points below"), so "ranked 5th" for a
  rank of 4 passes unless 5 is some other value in the packet. Decimals, percentages and
  amounts under 20 are checked (#116).
- **Digit groups separated by a space are two numbers.** "591 891", Mistral Large 3's
  way of writing 591,891 in `v2`, reads as 591 and 891, and the 891 would be refused —
  the one unbound figure in `v2` under binding. A space is too ambiguous a separator to
  join on.
- **Prose written before Milestone 13 carries no binding.** Its figures were never
  checked, and binding them against today's packet would cite numbers they were not
  written from (#114). On 2026-09-11 that is 104 of the 105 stored rows, all stale since
  Milestone 21; the dashboard says their figures are unverified, and the regeneration
  after `v3` replaces them.
- **Raw downloads are never pruned** (#10). On 2026-09-11 `data/raw/` kept 31 superseded
  copies, 264MB, most of it three earlier Zillow ZHVI files at about 76MB a monthly
  release; `source_releases` holds 46 releases no fact cites — TIGER's five build the
  geography and CHAS's directory is a lookup, and most of the rest are files since
  downloaded again. Only `hip analyze`'s orphaned derived releases are deleted (#73). A
  scheduled refresh will want a retention rule; it has to keep every release a fact
  cites, and a stored binding describes its releases itself, so pruning one cannot break
  a published citation.
- **Token counts in the evaluation are estimates** (characters over four), not tokenizer
  output. An exact count needs each model's own tokenizer, which would make the scenario
  — the thing every model must receive identically — differ per model.
- **DeepSeek at its default effort is never sampled deterministically.** Its reference
  says `temperature` "has no effect in thinking mode" and raises `top_p` below 0.95 to
  0.95, so every default-effort DeepSeek generation in `v2` ran at the provider's
  sampling rather than the pinned greedy one. Thinking off is the one DeepSeek
  configuration the pin reaches (#99), so comparing `deepseek-flash` with
  `deepseek-flash-nothink` varies sampling as well as thinking. Kept for `v3` and stated
  in the report since #104.
- **Gemini 3 is sampled against its provider's guidance.** Google recommends temperature
  1.0 for every Gemini 3 model and warns that lower values can cause looping; the harness
  pins 0.0 so that no candidate is sampled differently from the rest. `v2` scored Gemini
  3.7 Flash highest under the pin, so it has not visibly cost anything. Kept for `v3` and
  stated in the report since #104.
- **Qwen is sampled against its model cards' guidance, and with a penalty the others do
  not get.** Qwen recommends temperature 1.0 when thinking and 0.7 when not — in the
  cards for 3.6 and 3.8, since it publishes none for 3.7 — and the harness pins 0.0;
  the report says so (#105). Model Studio also applies `presence_penalty` 1.5 to 3.7
  in non-thinking mode by default, which the harness does not send and so does not
  pin: the two thinking-off Qwen candidates run with a repetition penalty no other
  candidate has. The live measurement on 2026-09-11 showed no looping at 0.0.
- **The benchmark gives every candidate the same 6,000-token output ceiling; production
  gives each hosted cohort its own.** One ceiling is what makes the rows comparable,
  and a reasoning model that needs more returns nothing: DeepSeek V4.1 Flash at its
  default spent all 6,000 reasoning on 3 of its 15 `v3` answers, as V4 Flash did in
  `v2`. `hip explain` gives DeepSeek 24,000, so that row understates what the model does
  on the site. Kept rather than raised, because its thinking-off configuration is the
  one on the list (#118).
- **A report prices from the rates in config when it renders**, not from rates recorded
  with the run. Gemini 3.7 Flash's rates double on 2027-01-01, and updating config then
  would reprice `v2` on its next render. Reasoning effort is read from the generations
  for exactly this reason (#98); the rates are the same hazard, not yet fixed, and so is
  the temperature the sampling note reads for each mode (#104).
- **`reports/evaluation/v1.md` is as rendered at Milestone 8.** The renderer has changed
  since — the title, and Milestone 20's Effort columns — and `v1` has not been
  re-rendered, so regenerating it would change the file without changing a figure.
- **Explanations are generated per region and go stale silently in the warehouse.**
  The stored hashes make staleness *detectable* and the API reports it, but nothing
  regenerates automatically: prose whose numbers moved stays stale until `hip explain`
  runs again, and `hip explain` skips any region whose prose is still current — decided
  on the content hash since Milestone 13, so a re-download that moved no figure is
  re-bound rather than regenerated (#114). (This used
  to say a pipeline run leaves every explanation stale; that was the defect #73 and #88
  fixed, and an unchanged rebuild now leaves them current.)
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
- ~~**ZIP allocation is area-weighted, not population-weighted** (#26).~~ Fixed
  2026-08-12 (Milestone 9, #37): HUD's residential-address ratios weight 2,460 of the
  2,493 crosswalk rows. The area-weighted remainder is recorded below.
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
- **33 ZIP crosswalk rows still use area weighting** (measured 2026-09-10; 35 at
  Milestone 9), where HUD has no residential
  addresses for the pair. `method` distinguishes them, and an allocation mixing the two
  is silently mixing assumptions.
- ~~**HUD Fair Market Rents and CHAS are in SPEC but not fetched.**~~ Both fetched since
  Milestone 21 (#106, #107).
- **Small Area Fair Market Rents are not loaded.** Nine NJ counties are Small Area FMR
  areas, where vouchers pay against ZIP-level rents; the county FMR shown there is the
  metro figure, not the one those vouchers use (#106).
- **The FMR series changes standard at FY2020.** HUD set six NJ counties' FMRs at the
  50th percentile in FY2017-2018 and two in FY2019, and every area at the 40th since, so
  a change over the 10-year or since-2019 window partly measures the methodology
  (#106). The default five-year window is clear of it.
- **CHAS is one vintage, a year behind ACS.** 2018-2022 describes earlier years than the
  newest ACS figures beside it, and shows no change over time (#107).
- **ACS counts seasonal homes as vacant.** `acs_vacancy_rate` follows the Census
  definition, so a shore town's summer houses read as vacancy, and a few very small
  municipalities report rates of 0 or 1 from a handful of sampled units.
- **Municipal permits include Census's imputation.** A place reporting fewer than twelve
  months has the rest imputed, as in the county totals the place figures sum to (#110).
  And a municipality that permitted nothing at the start of a window has no percentage
  change over it: 96 of 562 permitted nothing in 2019, so 466 carry a five-year change.
- **A reload never deletes an observation its source has stopped publishing.** The
  loader upserts (#25), so a row a newer release omits stays in the warehouse, citing the
  source's current release although that file no longer contains it. Measured on
  2026-09-11: 166 ZORI rows, municipal and ZIP, dated 2020-10 to 2026-06, that Zillow's
  current files no longer carry. Found while reconciling Milestone 21's load; not caused
  by it.
- **BLS history is 20 years and needs a key.** Without `BLS_API_KEY` the adapter falls
  back to API v1: three years of history and 25 queries a day, which is one run for New
  Jersey's 21 counties and too short for Milestone 4's change metrics.
- **FHFA is state-level only.** No county HPI is published at a reachable URL, so
  FHFA's two indexes are the warehouse's only `state`-level metrics and cannot
  participate in county rankings.
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
  linux/amd64 on this arm64 Mac, so Docker emulates it. Correct but slower than native.
  The fact tables arrived at Milestone 2 and now hold 351,295 rows, and a warm
  `make pipeline` still measured 22 seconds on 2026-08-28, so emulation has not yet been
  worth fixing.
