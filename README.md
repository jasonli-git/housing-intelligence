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

> **Status (2026-08-11): v0.1.0, Milestone 1 complete.** New Jersey's geography is
> loaded and queryable — 3,365 regions across five levels with PostGIS boundaries and
> 1,902 ZIP allocation weights, built end to end from Census TIGER/Line. No housing
> metrics yet; those start at Milestone 2. See [ROADMAP.md](ROADMAP.md) for what is
> planned and [CHANGELOG.md](CHANGELOG.md) for what shipped.

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
- **NJ geography spine** (M1, built) — one `regions` table covering state, county,
  municipality, ZIP, and tract with PostGIS geometry and parent roll-up, plus
  area-weighted crosswalks for ZIPs, which nest in nothing. County and municipality
  counts match New Jersey's real ones (21 and 564), not just whatever the source
  returned.
- **Reproducible acquisition** (M1, built) — raw downloads are immutable and
  content-addressed, cached by hash so a re-run touches no network, and every load
  records the exact file it came from. Re-running the pipeline is a no-op, verified:
  `region_id` values are stable across reloads because facts will reference them.
- **Staged public-data pipeline** (M2–M3) — eight CLI stages from download to analysis
  packet, each persisting before the next runs. Four are implemented (`acquire`,
  `land`, `geocode`, `load`); the rest exit non-zero naming the milestone that
  delivers them.
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
- Docker Desktop, for Postgres + PostGIS (`brew install --cask docker-desktop`)

```bash
git clone https://github.com/jasonli-git/housing-intelligence.git
cd housing-intelligence
make setup
```

`make setup` syncs the Python environment, installs dashboard dependencies, creates the
local `data/` directories, and copies `.env.example` to `.env` if you have none.

**Build the warehouse.** The first `acquire` downloads 635MB of Census TIGER/Line data,
529MB of which is the national ZCTA file; it is cached by content hash and never
re-downloaded.

```bash
make db-up         # Postgres 16 + PostGIS, waits for the healthcheck
make migrate       # alembic upgrade head
make pipeline      # acquire → land → geocode → load  (~2 min after the download)
```

**Run it.**

```bash
make api           # http://localhost:8000  (OpenAPI docs at /docs)
make web           # http://localhost:3000
make test          # 64 tests; API tests skip without a loaded warehouse
make lint          # ruff + ruff format --check + mypy --strict
```

Try it:

```bash
curl 'http://localhost:8000/regions?level=county&state=NJ'
curl 'http://localhost:8000/geo/county?state=NJ'
```

`make` on its own lists every target. With the warehouse down, the API and dashboard
still run and report the degraded state rather than failing.

**If `uv run hip` ever fails with `ModuleNotFoundError: No module named 'hip'`**, run
`make venv-fix`. `uv` marks its `.pth` files hidden on macOS and CPython skips hidden
`.pth` files; `make` targets are immune because they export `PYTHONPATH`.

**API keys.** `CENSUS_API_KEY` and `FRED_API_KEY` are required from Milestone 3;
`BLS_API_KEY` is optional but raises a 25-query daily limit. All three are free.
`.env.example` links to each signup page.

## Project Status

v0.1.0 — Milestones 0 and 1 of 8 complete. New Jersey's geography spine is loaded and
served; housing metrics begin at Milestone 2 with Zillow ZHVI and ZORI. Milestones and
their status are in [ROADMAP.md](ROADMAP.md); the current working list, including known
rough edges and parked API keys, is in [TODO.md](TODO.md).
