# Housing Intelligence Platform — TODO

Working list for the current milestone. Longer-horizon items live in
[ROADMAP.md](ROADMAP.md).

## Milestone 0 — Scaffolding

- [x] Product specification written and agreed ([SPEC.md](SPEC.md))
- [x] Architecture decided and recorded, including the storage tiers, the module
      boundary rule, the warehouse schema, and the eight pipeline stages
      ([ARCHITECTURE.md](ARCHITECTURE.md))
- [x] Milestone plan for Version 1 ([ROADMAP.md](ROADMAP.md))
- [x] Documentation set complete: TODO, [CHANGELOG.md](CHANGELOG.md),
      [README.md](README.md)
- [ ] Python project scaffold — `uv`, `pyproject.toml`, `src/hip/` package layout,
      committed `uv.lock`
- [ ] `.gitignore` covering `data/`, `.venv/`, `node_modules/`, `.env`, `*.duckdb`
- [ ] `hip` Typer entrypoint: `--version` plus one no-op subcommand per pipeline stage
      (`acquire`, `land`, `stage`, `geocode`, `validate`, `load`, `analyze`, `pack`)
- [ ] Config loading — `config/sources.yml`, `config/geography.yml`,
      `config/metrics.yml` parsed by `hip.config` with environment-variable resolution
      and a validation error that names the offending key
- [ ] `docker-compose.yml` running Postgres 16 + PostGIS, with `.env.example` and a
      documented default port
- [ ] Migration harness with an empty baseline revision, so Milestone 1 adds tables
      rather than inventing the mechanism
- [ ] dbt project initialized with `duckdb` and `postgres` targets; `dbt debug` passes
      against both
- [ ] `GET /health` returning service status, database connectivity, and the last
      successful load timestamp
- [ ] Next.js app in `web/` rendering the `/health` response, proving the API boundary
      end to end
- [ ] `pytest`, `ruff`, and `mypy` configured with a test that fails when the module
      dependency rule in [ARCHITECTURE.md](ARCHITECTURE.md) is violated
- [ ] `Makefile` with `setup`, `db-up`, `api`, `web`, `test`, `lint` targets, matching
      the commands printed in [README.md](README.md)

- Note: the local LLM runtime is deliberately unchosen (ARCHITECTURE #11). Milestone 6
  produces analysis packets with no consumer; the runtime gets picked at Milestone 8
  from evaluation results rather than from reputation.
- Note: parcel and MOD-IV data will not be loaded into Postgres (ARCHITECTURE #16).
  Revisit at Milestone 7 — if municipality-level aggregates turn out to be too coarse
  for the dashboard, the alternative is a parcel table partitioned by county, which
  changes the backup and load story.
- Note: NJ municipal geography needs its identifier settled before Milestone 1. Census
  County Subdivision (MCD) FIPS codes and NJ's own municipal codes do not agree on
  boundaries in every case. Whichever is chosen becomes `regions.geoid` for the
  `municipality` level and is hard to change afterward.
- Note: Zillow's municipality-level ZHVI coverage for NJ is partial — small boroughs are
  frequently absent. Confirm actual coverage during Milestone 2 before the dashboard
  promises municipal series; the fallback is county-level only with municipal coverage
  shown as a data-availability layer.
- Note: ARCHITECTURE.md is written ahead of the code and says so at the top. Every
  milestone must rewrite the sections it touches against what was actually built, not
  append to them.

## Parked / needs user input

- **Docker Desktop** must be installed before Milestone 0's `db-up` target can be
  verified.
- **Census API key** — needed at Milestone 3 for ACS pulls above the anonymous rate
  limit. Free, requires an email address.
- **FRED API key** — required at Milestone 3; there is no anonymous access.
- **BLS API key** — optional at Milestone 3, but the anonymous tier is limited enough to
  make repeated pulls painful.
- **Postgres port** — the compose file will default to 5432; confirm nothing else on the
  machine already holds it, or pick an alternative before Milestone 0 closes.
