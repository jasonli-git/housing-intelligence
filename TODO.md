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
- [x] Python project scaffold — `uv`, `pyproject.toml`, `src/hip/` package layout,
      committed `uv.lock`, `py.typed`
- [x] `.gitignore` covering `data/`, `.venv/`, `node_modules/`, `.env`, `*.duckdb`
- [x] `hip` Typer entrypoint: `--version`, `check-config`, and one command per pipeline
      stage (`acquire`, `land`, `stage`, `geocode`, `validate`, `load`, `analyze`,
      `pack`), each exiting 1 with the milestone that delivers it
- [x] Config loading — `config/sources.yml` (10 sources), `config/geography.yml`,
      `config/metrics.yml` (12 metrics) parsed by `hip.config` with
      environment-variable resolution and errors that name file and key path
- [x] Cross-file config check: a metric naming an undefined source, or a source whose
      declared API key variable is unset, is reported by `hip check-config`
- [x] `docker-compose.yml` running Postgres 16 + PostGIS with a healthcheck, plus
      `.env.example` documenting the default port — **written, never run**
- [x] Migration harness with a baseline revision that enables PostGIS, verified in
      Alembic offline mode — **never applied to a live database**
- [x] dbt project with `duckdb` and `postgres` targets; `dbt debug` passes on `duckdb`
      — **`postgres` target unverified**
- [x] `GET /health` returning service status, database connectivity, whether the schema
      is migrated, and the last successful load timestamp
- [x] Next.js app in `web/` server-rendering the `/health` response, verified end to
      end against a running API
- [x] `pytest`, `ruff`, and `mypy --strict` configured and clean, with an AST test that
      fails when the module dependency rule is violated — and a companion test proving
      the checker catches known violations, so it cannot rot into a decorative pass
- [x] `Makefile` with `setup`, `db-up`, `migrate`, `api`, `web`, `test`, `lint`,
      `check-config`, `dbt-debug`, `clean`, matching the commands in
      [README.md](README.md)
- [ ] **Verify the Postgres path once Docker is installed**: `make db-up`,
      `make migrate`, `dbt debug --target postgres`, then confirm `/health` reports
      `connected: true, migrated: true`. This is the only thing standing between
      Milestone 0 and done.

- Note: pinned the Python patch version in `.python-version` (ARCHITECTURE #18). uv
  resolved Python through a `cpython-3.12` symlink and wrote it into `pyvenv.cfg`, while
  CPython resolved it to `cpython-3.12.13`; the mismatch silently disabled `.pth`
  processing, breaking every editable install and surfacing only as
  `ModuleNotFoundError: No module named 'hip'` after unrelated `uv sync` runs. Revisit
  when bumping Python — and be suspicious of this failure mode, it wastes an hour.
- Note: `hip check-config` exits 1 on a clean checkout because three source API keys are
  unset. That is correct behavior, but it means `check-config` cannot be wired into
  `make lint` or CI until the keys exist. Revisit at Milestone 3.
- Note: the local LLM runtime is deliberately unchosen (ARCHITECTURE #11). Milestone 6
  produces analysis packets with no consumer; the runtime gets picked at Milestone 8
  from evaluation results rather than from reputation. Candidates now include Qwen3.5 9B
  and Gemma 4 QAT, which adds a quantization axis to the evaluation — a quantized build
  against its full-precision sibling is a different question from model-vs-model.
- Note: parcel and MOD-IV data will not be loaded into Postgres (ARCHITECTURE #16).
  Revisit at Milestone 7 — if municipality-level aggregates turn out to be too coarse
  for the dashboard, the alternative is a parcel table partitioned by county, which
  changes the backup and load story.
- Note: NJ municipal geography is now an explicit config key
  (`geography.municipality_id_system`, defaulting to `census_mcd`) rather than an
  assumption buried in code, but the decision is still open. It must be settled before
  Milestone 1 loads `regions`, because every fact row will reference the resulting
  `region_id`.
- Note: Zillow's municipality-level ZHVI coverage for NJ is partial — small boroughs are
  frequently absent. Confirm actual coverage during Milestone 2 before the dashboard
  promises municipal series; the fallback is county-level only with municipal coverage
  shown as a data-availability layer.
- Note: `web/` acquired `AGENTS.md` and `CLAUDE.md` from the Next.js scaffold. Neither
  has been reviewed; decide at Milestone 5 whether to keep, edit, or delete them.
- Note: Starlette's `TestClient` emits a deprecation warning asking for `httpx2`. It is
  suppressed in `pyproject.toml` rather than fixed, because swapping the HTTP client is
  not Milestone 0 work. Revisit before it becomes an error.

## Parked / needs user input

- **Docker Desktop** is not installed. This blocks the last Milestone 0 item above and
  all of Milestone 1. Everything up to `hip load` is Parquet and DuckDB only, so work
  can continue without it, but the milestone cannot close.
- **Census API key** — needed at Milestone 3 for ACS pulls above the anonymous rate
  limit. Free, requires an email address.
- **FRED API key** — required at Milestone 3; there is no anonymous access.
- **BLS API key** — optional at Milestone 3, but the anonymous tier is 25 queries per
  day, which is limiting for repeated pulls.
- **Postgres port** — `docker-compose.yml` defaults to 5432 and nothing is listening on
  it today, so the default should work. Override `POSTGRES_PORT` in `.env` if that
  changes.
