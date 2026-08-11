# Housing Intelligence Platform

A local-first analytics platform that turns fragmented public housing data into a
queryable warehouse of housing intelligence, starting with New Jersey. It pulls parcel
and MOD-IV records, Zillow ZHVI and ZORI, Census ACS and Building Permits, FHFA HPI,
FRED, BLS, and IRS migration data through one staged pipeline, resolves everything to a
shared geography spine, and computes the facts — value growth, rent growth, affordability
change, construction activity, county rankings — before anything is displayed. It is
built for someone who wants to ask where affordability is worsening fastest in New Jersey
and get a defensible answer with the source file behind every number. It is not a
chatbot and not a listings site: dashboards, maps, rankings, reports, and an API are the
product, and an optional AI layer only explains metrics that were already computed.

> **Status (2026-08-10): Milestone 0, scaffolding.** The skeleton runs — CLI, config
> layer, `GET /health`, dashboard, migrations, dbt, 30 passing tests — but no housing
> data has been downloaded and no warehouse table exists. See
> [ROADMAP.md](ROADMAP.md) for what is planned and [CHANGELOG.md](CHANGELOG.md) for what
> has been built.

Read [SPEC.md](SPEC.md) for what the platform is meant to do and why, and
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is built.

## Features

Each is listed with the milestone that delivers it, so this section can be checked
against [ROADMAP.md](ROADMAP.md) rather than believed.

- **Config-driven source registry** (M0, built) — 10 public sources and 12 metrics
  defined in YAML with license, cadence, and update frequency. `hip check-config`
  validates them and catches a metric naming an undefined source, or a source whose
  API key is missing, before any fetch is attempted.
- **Enforced module boundaries** (M0, built) — a test parses every module's imports and
  fails the build if the API reaches into the pipeline, or if an import flows backward
  along it. The read-only API is structural, not a convention.
- **NJ geography spine** (M1) — one `regions` table covering state, county,
  municipality, ZIP, and tract with PostGIS geometry, parent roll-up, and weighted
  crosswalks for geographies that do not nest.
- **Staged public-data pipeline** (M2–M3) — eight CLI stages from download to analysis
  packet, each persisting before the next runs, with immutable content-addressed raw
  snapshots so any rebuild is reproducible without re-fetching.
- **Provenance on every value** (M2) — each metric observation carries the source
  release, vintage, and file checksum it came from; deleting a release removes exactly
  what it contributed.
- **Computed housing intelligence** (M4) — value and rent growth, income and population
  change, permit activity, price-to-income and rent-burden affordability, and county and
  municipal rankings, all calculated in SQL rather than inferred by a model.
- **Dashboard and maps** (M5) — region explorer, trend charts, side-by-side county
  comparison, choropleth maps, and ranking tables.
- **Read-only analytics API** (M4–M6) — FastAPI endpoints for regions, metrics,
  rankings, comparisons, GeoJSON boundaries, and analysis packets.
- **Analysis packets** (M6) — small versioned JSON documents holding computed metrics,
  peer comparisons, caveats, and source metadata; the entire contract any future model
  is allowed to see.
- **Model evaluation** (M8) — the same housing scenarios run against candidate local
  models, graded on factual accuracy, hallucination rate, and usefulness, with the
  selection justified by measured results.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | Python 3.12.13, TypeScript | Python for data work, TypeScript for the dashboard |
| CLI | Typer | One command per pipeline stage; the only write path |
| Raw storage | Parquet | Immutable columnar landings, readable without a database |
| Transform | DuckDB + dbt-core | Out-of-core SQL over Parquet, with lineage and tests |
| Warehouse | PostgreSQL 16 + PostGIS | Concurrent readers, constraints, spatial queries |
| API | FastAPI + SQLAlchemy | Read-only, typed, OpenAPI for free |
| Dashboard | Next.js 16 + React 19 | Charts, maps, and comparison views over the API |
| Packaging | `uv`, Docker Compose | Locked Python env; Postgres is the only container |

The reasoning behind each of these, and what was rejected, is in the Decisions Log in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

**Prerequisites**

- [`uv`](https://docs.astral.sh/uv/) — installs the pinned Python 3.12.13 itself
- Node.js 20+ for the dashboard
- Docker Desktop, for Postgres + PostGIS. **Not yet installed on this machine**, so
  every database-dependent step below is unverified.

```bash
git clone https://github.com/jasonli-git/housing-intelligence.git
cd housing-intelligence
make setup
```

`make setup` syncs the Python environment, installs dashboard dependencies, creates the
local `data/` directories, and copies `.env.example` to `.env` if you have none.

**Verified today** — these need no database:

```bash
make test          # 30 tests
make lint          # ruff + ruff format --check + mypy --strict
make check-config  # exits 1 until the source API keys in .env are filled in
make api           # http://localhost:8000  (OpenAPI docs at /docs)
make web           # http://localhost:3000  — renders the API health response
```

**Needs Docker** — written but never run:

```bash
make db-up         # Postgres 16 + PostGIS, waits for the healthcheck
make migrate       # alembic upgrade head — creates the PostGIS extension
make dbt-debug     # checks both the duckdb and postgres targets
```

With the warehouse down, `make api` and `make web` still work and report the degraded
state — that path is verified. `make` on its own lists every target.

**API keys.** `CENSUS_API_KEY` and `FRED_API_KEY` are required from Milestone 3;
`BLS_API_KEY` is optional but raises a 25-query daily limit. All three are free.
`.env.example` links to each signup page.

## Project Status

Pre-release, Milestone 0 of 8, no version tagged. The scaffolding is built and tested;
closing the milestone requires running the Postgres path once Docker is available.
Milestones and their status are in [ROADMAP.md](ROADMAP.md); the current working list,
including known rough edges, is in [TODO.md](TODO.md).
