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

> **Status (2026-08-09): no application code exists yet.** This repository currently
> holds the specification and planning documents. Milestone 0 (scaffolding) is in
> progress — see [ROADMAP.md](ROADMAP.md) for what is planned and
> [CHANGELOG.md](CHANGELOG.md) for what has shipped, which is so far nothing.

Read [SPEC.md](SPEC.md) for what the platform is meant to do and why, and
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is built.

## Features

None of these are built yet. Each is listed with the milestone that delivers it, so this
section can be checked against [ROADMAP.md](ROADMAP.md) rather than believed.

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
| Language | Python 3.12+, TypeScript | Python for data work, TypeScript for the dashboard |
| CLI | Typer | One command per pipeline stage; the only write path |
| Raw storage | Parquet | Immutable columnar landings, readable without a database |
| Transform | DuckDB + dbt-core | Out-of-core SQL over Parquet, with lineage and tests |
| Warehouse | PostgreSQL 16 + PostGIS | Concurrent readers, constraints, spatial queries |
| API | FastAPI + SQLAlchemy | Read-only, typed, OpenAPI for free |
| Dashboard | Next.js + React | Charts, maps, and comparison views over the API |
| Packaging | `uv`, Docker Compose | Locked Python env; Postgres is the only container |

The reasoning behind each of these, and what was rejected, is in the Decisions Log in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

**Prerequisites** — install these now; they are what Milestone 0 will build against.

- Docker Desktop (runs Postgres + PostGIS; nothing else is containerized)
- [`uv`](https://docs.astral.sh/uv/) for Python 3.12+
- Node.js 20+ for the dashboard

**What works today.** The repository contains documents only:

```bash
git clone https://github.com/jasonli-git/housing-intelligence.git
```

**After Milestone 0 lands**, setup becomes the commands below. They do not work yet — the
`Makefile`, `pyproject.toml`, and `web/` package they depend on are the deliverables of
that milestone, tracked in [TODO.md](TODO.md).

```bash
make setup      # uv sync, install web deps
make db-up      # docker compose up postgres + postgis
make api        # FastAPI on http://localhost:8000  (docs at /docs)
make web        # Next.js on http://localhost:3000
make test       # pytest + dbt tests
```

## Project Status

Pre-release, Milestone 0 of 8 in progress, no version tagged. Milestones and their status
are in [ROADMAP.md](ROADMAP.md); shipped work is recorded in
[CHANGELOG.md](CHANGELOG.md).
