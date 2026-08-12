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

> **Status (2026-08-12): v0.4.0, Milestone 4 complete.** New Jersey's geography and its
> housing and economic context are loaded and queryable — 3,365 regions and **329,975
> observations across 14 metrics from 9 public sources, spanning 1971 to 2026**, plus
> 19,338 computed changes and 19,328 rankings. The source file and match method are
> recorded on every value. See [ROADMAP.md](ROADMAP.md) for what is planned and
> [CHANGELOG.md](CHANGELOG.md) for what shipped.

Read [SPEC.md](SPEC.md) for what the platform is meant to do and why, and
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is built.

## Features

Each is listed with the milestone that delivers it, so this section can be checked
against [ROADMAP.md](ROADMAP.md) rather than believed.

- **Config-driven source registry** (M0, built) — 11 public sources and 12 metrics
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
- **Staged public-data pipeline** (M2–M3, built) — eight CLI stages from download to
  analysis packet, each persisting before the next runs. Six are implemented
  (`acquire`, `land`, `stage`, `geocode`, `validate`, `load`); `analyze` and `pack` exit
  non-zero naming the milestone that delivers them.
- **Provenance on every value** (M2, built) — each observation carries the source
  release and how its geography was resolved (`fips`, `zip_code`, `name_county`), so a
  county figure matched on FIPS is distinguishable from a municipal one matched by name.
- **Home values and rents** (M2, built) — Zillow ZHVI and ZORI at county, municipal,
  and ZIP level. County coverage is 21/21 and ZIP 548/598; municipalities reach 403/564
  because Zillow publishes no FIPS below county level, and ambiguous name matches are
  rejected rather than guessed. `/sources/unresolved` names every gap and why.
- **A validation gate that blocks bad loads** (M2, built) — duplicate observations,
  out-of-range values, orphaned regions, and coverage collapse each stop the load before
  it reaches the warehouse. It has already caught a real bug: 318 duplicate rows caused
  by name normalization merging two distinct municipalities.
- **Economic and demographic context** (M3, built) — ACS income, rent, population, home
  value, and renter cost burden; building permits; FHFA HPI; the 30-year mortgage rate;
  county unemployment; and net migration. ACS is FIPS-exact at municipal level, which
  takes municipal coverage to 564/564.
- **Computed housing intelligence** (M4, built) — percentage change and CAGR over
  1y/3y/5y/10y/since-2019, price-to-income and rent-to-income affordability, and rank
  plus percentile per metric and level, all calculated in SQL rather than inferred by a
  model. `/regions/{id}/summary` returns the headline changes with the caveats that
  qualify them.
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
- Free API keys in `.env`: `CENSUS_API_KEY` and `FRED_API_KEY` are required (neither has
  a usable anonymous tier), `BLS_API_KEY` is strongly recommended — without it BLS
  returns 3 years of history instead of 20. Links are in `.env.example`.

```bash
git clone https://github.com/jasonli-git/housing-intelligence.git
cd housing-intelligence
make setup
```

`make setup` syncs the Python environment, installs dashboard dependencies, creates the
local `data/` directories, and copies `.env.example` to `.env` if you have none.

**Build the warehouse.** The first `acquire` downloads ~880MB — 635MB of Census
TIGER/Line (529MB of it the national ZCTA file) plus 245MB of Zillow CSVs. Everything is
cached by content hash and never re-downloaded.

```bash
make db-up         # Postgres 16 + PostGIS, waits for the healthcheck
make migrate       # alembic upgrade head
make pipeline      # acquire → land → stage → geocode → validate → load → analyze
```

**Run it.**

```bash
make api           # http://localhost:8000  (OpenAPI docs at /docs)
make web           # http://localhost:3000
make test          # 86 tests; API tests skip without a loaded warehouse
make lint          # ruff + ruff format --check + mypy --strict
```

Try it:

```bash
curl 'http://localhost:8000/metrics'
curl 'http://localhost:8000/regions?level=county&q=Mercer'
curl 'http://localhost:8000/regions/11/metrics?metric_id=zhvi_sfr&from=2025-01-01'
curl 'http://localhost:8000/sources/unresolved'
curl 'http://localhost:8000/rankings?metric_id=price_to_income&level=county&window=5y'
curl 'http://localhost:8000/regions/11/summary?window=5y'
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

v0.4.0 — Milestones 0 through 4 of 8 complete. Geography, prices, rents, economic
context, and computed change/affordability/rankings are all served; Milestone 5 builds
the dashboard. Milestones and
their status are in [ROADMAP.md](ROADMAP.md); the current working list, including known
rough edges and parked API keys, is in [TODO.md](TODO.md).
