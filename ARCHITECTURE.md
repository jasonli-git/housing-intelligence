# Housing Intelligence Platform — Architecture

How the platform is built and why it is built that way: the storage tiers, the module
boundaries, the warehouse schema, the pipeline stages, and the decisions behind each.
[SPEC.md](SPEC.md) is the source of truth for *what* the system does and for Version 1
scope; this document does not restate it.

> **Status (2026-08-11):** Milestones 0 and 1 are complete. The warehouse holds a real
> NJ geography spine — 3,365 regions across five levels with PostGIS geometry and 1,902
> allocation weights — loaded end to end from Census TIGER/Line through
> `acquire → land → geocode → load`, and served by `/regions`, `/regions/{id}`, and
> `/geo/{level}`. 64 tests pass. Still decision-only, marked per section below: the
> metric fact tables, the `stage`/`validate`/`analyze`/`pack` stages, the analysis
> packet, and every API endpoint beyond geography and health.

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
| 15 | Validation is a distinct gate stage that can block the load, not a set of assertions scattered through ETL. | A failed load is worse than a skipped one, and the gate is where "is this release sane" is answered once. Pandera checks shapes at the DuckDB boundary; dbt tests check the warehouse after load. Costs a stage that will occasionally block on a real-but-unusual upstream change. |
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

## Module Layout

What exists as of 2026-08-11. Empty pipeline packages are real directories holding only
`__init__.py` — they exist so the boundary rule in `tests/test_module_boundaries.py` has
something to enforce against. Planned files are marked with the milestone that adds them.

```text
housing-intelligence/
├── .python-version            # pinned patch version (#18)
├── config/
│   ├── sources.yml            # 10 sources: url, cadence, license, adapter name
│   ├── geography.yml          # in-scope states and levels (#14)
│   └── metrics.yml            # 12 metrics: label, unit, frequency, direction
├── src/hip/
│   ├── cli.py                 # Typer entrypoint; check-config + 8 stage commands
│   ├── config.py              # settings, YAML loading, env resolution, STATE_FIPS
│   ├── duck.py                # DuckDB session + /vsizip path helper (#23)
│   ├── sources/
│   │   ├── base.py            # SourceAdapter, retry, content-addressed cache (#10)
│   │   └── tiger.py           # Census TIGER/Line: 5 layers (#22)
│   ├── landing/shapefile.py   # zip → Parquet via ST_Read, geometry to MultiPolygon
│   ├── transform/             # (M2) dbt staging model execution
│   ├── geography/
│   │   ├── regions.py         # stg_regions: 5 levels, parent chain by geoid
│   │   └── crosswalk.py       # area-weighted ZIP allocation in EPSG:5070 (#26)
│   ├── validate/              # (M2) Pandera schemas and the gate (#15)
│   ├── warehouse/
│   │   ├── db.py              # engine, session_scope, probe() for /health
│   │   ├── models.py          # Region, RegionIdentifier, RegionCrosswalk
│   │   ├── load.py            # one-transaction upsert of the spine (#25)
│   │   └── migrations/        # Alembic; 0001 PostGIS, 0002 geography spine
│   ├── analytics/             # (M4) change metrics, affordability, rankings
│   ├── packets/               # (M6) packet assembly + JSON schema (#12)
│   └── api/
│       ├── main.py            # FastAPI app, CORS for the dashboard origin
│       ├── deps.py            # read-only session dependency
│       └── routers/           # health.py, regions.py
├── dbt/
│   ├── dbt_project.yml        # staging = views, marts = tables
│   ├── profiles.yml           # duckdb (default) and postgres targets
│   └── models/staging|marts/  # (M1–M2) empty
├── web/                       # Next.js 16 + React 19 dashboard
│   └── app/page.tsx           # renders GET /health; the whole UI at M0
├── data/                      # gitignored, machine-local
│   ├── raw/                   # immutable downloads, content-addressed
│   ├── parquet/               # landing tier
│   └── duckdb/                # working analytical database
├── tests/                     # 64 tests; test_api_regions.py skips without a warehouse
├── alembic.ini                # URL comes from hip.config, not from here
├── docker-compose.yml         # postgres + postgis only (#13)
├── Makefile                   # setup, db-up, migrate, api, web, test, lint
└── pyproject.toml
```

**Dependency rule.** Imports flow one direction along the pipeline and never back:

```text
sources → landing → transform → geography → validate → warehouse → analytics → packets
                                                          ↑
                                                        api (reads only)
```

`api` may import `warehouse` read models and `packets`, and nothing else from the
pipeline — it must not be able to import `sources` or `transform`, which is what keeps
decision #6 true by construction rather than by discipline. Nothing imports `api`.
`web/` reaches the API over HTTP only and shares no code with Python. `config` and
`duck` are infrastructure leaves importable from anywhere (#23); every other cross-stage
import is a boundary violation. `cli` sits outside the chain and orchestrates all of it,
which is why every write path lives there.

## Warehouse Schema

**Built as of Milestone 1:** `regions`, `region_identifiers`, `region_crosswalk`,
`sources`, and `source_releases` all exist and are populated — see
`src/hip/warehouse/migrations/versions/0002_regions.py`, which is authoritative for DDL,
and `src/hip/warehouse/models.py` for the ORM mapping. The block below is the shape;
where it and the migration disagree, the migration wins. `metrics`,
`fact_metric_observation`, `fact_metric_change`, and `region_rankings` are **not built**
— they arrive with Milestones 2 and 4.

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
  method         TEXT NOT NULL,          -- 'hud_usps', 'area', 'population'
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

**Implemented as of Milestone 1:** `acquire`, `land`, `geocode`, and `load` run the
geography spine end to end. `stage`, `validate`, `analyze`, and `pack` remain stubs that
print the milestone delivering them and exit 1, so a stub can never be mistaken for a
successful run — a no-op exiting 0 would make an empty warehouse look like a clean
pipeline. `src/hip/cli.py` keeps the stub list in `_STAGE_MILESTONE`, and a test asserts
implemented stages have been removed from it, so the map cannot go stale.

`geocode` currently does its work in DuckDB directly rather than through dbt models;
`stage` is where dbt enters at Milestone 2, once there are source attributes worth
modelling rather than geometry to intersect.

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
hip pack      →  data/packets/<region_id>.json       analysis packets (#12)
```

**What each stage guarantees.** `acquire` is the only stage that touches the network; it
is idempotent by content hash, so re-running it after a partial failure re-fetches only
what is missing, and an unchanged upstream file produces no new release. `land` is pure
transcoding — no business logic — so a bug there is always re-runnable from `data/raw/`
without network access. `stage` and `geocode` operate entirely inside DuckDB and can be
thrown away and rebuilt from Parquet. `load` wraps each release in one transaction: a
release is fully present or fully absent, never half-loaded. `analyze` truncates and
rebuilds its tables rather than incrementally updating them, because they are cheap to
recompute and expensive to reason about when stale.

**Failure behavior.** `validate` failing is the designed stop: the warehouse keeps
serving the previous release and the report names the failing check, the source, and the
row count. A failure in `acquire` or `land` affects only that source — the CLI processes
sources independently and reports a per-source exit summary, so one dead upstream URL
does not block a refresh of the other eight. A failure in `load` rolls back to the prior
release for that source only. A failure in `analyze` leaves the derived tables empty
rather than stale, and the API returns 503 for ranking endpoints while facts endpoints
keep working.

**Degradation when a dependency is unavailable.** No Docker or no Postgres means stages 1
through 5 still run end-to-end — everything up to `load` is Parquet and DuckDB only,
which is deliberate: the expensive, slow work does not require the database to be up.

## Analysis Packets

The contract between deterministic analytics and any future model (#12). Small, fully
computed, and schema-validated before it is written.

```json
{
  "packet_version": "1.0",
  "region": { "region_id": 3411, "name": "Mercer County", "level": "county",
              "state_code": "NJ" },
  "period": { "start": "2019-01-01", "end": "2025-12-01" },
  "metrics": [
    { "metric_id": "zhvi_sfr", "label": "Home value index", "unit": "usd",
      "start_value": 264100, "end_value": 388300, "pct_change": 47.0,
      "release_id": 812 }
  ],
  "comparisons": { "peer_level": "county", "peer_scope": "NJ",
                   "rank": { "zhvi_sfr": 6, "of": 21 } },
  "caveats": ["ACS 5-year estimates overlap; year-over-year change is not independent."],
  "sources": [ { "source_id": "zillow_zhvi", "vintage": "2026-06",
                 "publisher": "Zillow Research" } ]
}
```

Every number in a packet is read from the warehouse, never computed at packet-assembly
time — if a value is not in `fact_metric_observation` or `fact_metric_change`, it does
not go in the packet. `caveats` is populated from metric metadata and from the crosswalk
method used, so the limitations travel with the data instead of living in a doc a model
will never read. Packets carry `release_id` and vintage so an explanation can be traced
back to the exact files behind it.

**Surprising but intentional.** Nothing consumes these in Version 1 (#11). They are
written, validated, and tested as fixtures with no reader, which looks like dead code and
is the point: the contract gets to stabilize before a model shapes it.

## API

FastAPI over Postgres, read-only (#6), served at `http://localhost:8000`. Endpoints
marked ✅ are implemented; the rest arrive with the milestones that produce their data.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/health` | ✅ service + database + last successful load timestamp |
| GET | `/regions` | ✅ paged regions filtered by `level`, `state`, `parent_id`, name `q` |
| GET | `/regions/{region_id}` | ✅ one region, its full ancestor chain, child count |
| GET | `/geo/{level}` | ✅ GeoJSON FeatureCollection, simplified by default |
| GET | `/regions/{region_id}/metrics` | observations filtered by `metric_id`, `from`, `to` |
| GET | `/regions/{region_id}/summary` | headline changes, rank, caveats — dashboard landing |
| GET | `/regions/{region_id}/packet` | the analysis packet for a region |
| GET | `/rankings` | ranked regions for `metric_id`, `level`, window |
| GET | `/compare` | aligned series for several `region_ids` and `metric_ids` |
| GET | `/sources` | source registry and the releases currently loaded |

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
- **Parcel data is not queryable through the API** (#16). It exists in Parquet and DuckDB
  and reaches Postgres only as municipality-level aggregates.
- **There is no AI layer** (#11). Packets are produced and go nowhere until Milestone 8.
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
- **dbt is configured but unused.** `geocode` does its spatial work directly in DuckDB.
  dbt earns its place at Milestone 2, when there are source attributes to model.
- **The Postgres container runs under emulation.** `postgis/postgis:16-3.4` resolves to
  linux/amd64 on this arm64 Mac, so Docker emulates it. Correct but slower than native;
  irrelevant at 3,365 rows, worth revisiting when the fact tables arrive.
