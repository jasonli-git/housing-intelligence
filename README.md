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

> **Status (2026-08-13): v0.8.0, Milestone 7 complete.** New Jersey's geography, its
> housing and economic context, and now its **property tax roll** are loaded, queryable,
> visible, and exportable — 3,365 regions, **3.48M parcels**, and **335,927 observations
> across 23 metrics from 10 public sources, spanning 1971 to 2026**, plus 19,527 computed
> changes and 27,819 rankings, served behind a three-page dashboard and packaged as
> versioned analysis packets. All eight pipeline stages run. The source file and match
> method are recorded on every value. See [ROADMAP.md](ROADMAP.md) for what is planned
> and [CHANGELOG.md](CHANGELOG.md) for what shipped.

Read [SPEC.md](SPEC.md) for what the platform is meant to do and why, and
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is built.

## Features

Each is listed with the milestone that delivers it, so this section can be checked
against [ROADMAP.md](ROADMAP.md) rather than believed.

- **Config-driven source registry** (M0, built) — 13 public sources and 23 metrics
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
- **Staged public-data pipeline** (M2–M6, built) — eight CLI stages from download to
  analysis packet, each persisting before the next runs: `acquire`, `land`, `stage`,
  `geocode`, `validate`, `load`, `analyze`, `pack`. `make pipeline` runs them in order
  and a failing validation gate stops the chain.
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
- **Allocation by households, not acres** (M9, built) — ZIP-level data is allocated
  using HUD residential-address ratios rather than land area, so a half-empty ZIP no
  longer contributes as if it were fully built out. Affordability can also be expressed
  against HUD's published area median income, not only an ACS survey estimate.
- **Dashboard and maps** (M5, built) — county choropleth and ranking table on the
  overview, region detail pages with metric tiles and trend charts, and a table view of
  every series with its source. Drawn as inline SVG from our own GeoJSON: no map
  library, no tile server, no third-party in the render path.
- **Read-only analytics API** (M4–M6, built) — FastAPI endpoints for regions, metrics,
  rankings, comparisons, GeoJSON boundaries, analysis packets, and Markdown reports.
- **Analysis packets** (M6, built) — small versioned JSON documents holding computed
  metrics with their ranks, the peer cohort, caveats, and the source releases behind
  every value: the entire contract any future model is allowed to see. The schema is
  published at [`schemas/packet-v1.json`](schemas/packet-v1.json), generated from the
  code and checked against it by a test. `hip pack` writes one per region.
- **Exportable region reports** (M6, built) — the same packet rendered as Markdown by
  `hip pack --report` or `GET /regions/{id}/report`, and as a print-ready page at
  `/regions/[id]/report` in the dashboard. Two media, one contract, no PDF library.
- **NJ parcels and the property tax roll** (M7, built) — 3.48M parcels acquired from
  NJGIN's ArcGIS service and held in Parquet/DuckDB, aggregated to six municipality
  metrics that describe the housing *stock*: median assessed value, parcel count, median
  year built, median lot size, vacant land share, and apartment share. Matched to Census
  municipalities on the legal form ("Boonton township" against "Boonton town"), which
  reaches 554 of 564 with zero ambiguity where Zillow's name matching ceilings at 403.
- **Ranked by value, not only by change** (M7, built) — "which municipality is most
  expensive" is now a query, not just "which rose fastest". Snapshot sources like MOD-IV
  have no change at all, so without this their data would load and stay invisible.
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

**Build the warehouse.** The first `acquire` downloads ~2GB — 635MB of Census
TIGER/Line (529MB of it the national ZCTA file), 245MB of Zillow CSVs, and 1.16GB of NJ
parcels assembled from 1,741 API requests over roughly 32 minutes. Everything is cached
by content hash and never re-downloaded.

```bash
make db-up         # Postgres 16 + PostGIS, waits for the healthcheck
make migrate       # alembic upgrade head
make pipeline      # acquire → … → analyze → pack, all eight stages
```

**Run it.**

```bash
make api           # http://localhost:8000  (OpenAPI docs at /docs)
make web           # http://localhost:3000
make test          # 146 Python + 26 dashboard tests; API tests skip without a warehouse
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
curl 'http://localhost:8000/regions/11/packet?window=5y'
curl 'http://localhost:8000/regions/11/report?window=5y'
curl 'http://localhost:8000/rankings?metric_id=modiv_median_assessed_value&level=municipality&basis=value'
```

Packets and reports on disk, and the contract they satisfy:

```bash
uv run hip pack --report          # data/packets/5y/ and reports/regions/5y/
uv run hip pack --region 11       # one region
uv run hip schema                 # the published JSON Schema
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

v0.8.0 — Milestones 0 through 7 and 9 complete. Geography, prices, rents, economic
context, computed change and affordability and rankings, the dashboard, versioned
analysis packets with exportable reports, and the NJ parcel and MOD-IV layer are all
built. Milestone 8 — evaluating local models against standardized housing scenarios — is
the last of Version 1. Milestones and their status are in [ROADMAP.md](ROADMAP.md); the
current working list and known rough edges are in [TODO.md](TODO.md).
