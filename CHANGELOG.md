# Changelog

All notable changes to the Housing Intelligence Platform. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

No version has been released. Milestone 0 is built but not closed — see
[ROADMAP.md](ROADMAP.md). A version entry is written when a milestone completes, so the
work below stays under Unreleased until the Postgres path has been run.

## [Unreleased]

### Added
- Product specification defining Version 1 scope, the ten core principles, and the
  Version 1 non-goals (`SPEC.md`).
- Architecture record: the Parquet → DuckDB → PostgreSQL storage tiers, the module
  dependency rule, the curated warehouse schema, the eight-stage pipeline, the analysis
  packet contract, the API surface, and twenty numbered decisions with their rejected
  alternatives (`ARCHITECTURE.md`).
- Version 1 milestone plan, nine milestones from scaffolding through model evaluation
  (`ROADMAP.md`), and the Milestone 0 working list (`TODO.md`).
- Python package scaffold: `uv`-managed environment, `src/hip` layout with one package
  per pipeline stage, `Makefile`, and `docker-compose.yml` for Postgres 16 + PostGIS.
- Config layer: `config/sources.yml` (10 public sources), `config/geography.yml`, and
  `config/metrics.yml` (12 metrics), loaded with `${VAR:-default}` environment
  resolution and validation errors that name the file and key path. `hip check-config`
  also cross-checks the files against each other — a metric naming an undefined source,
  or a source whose declared API key is unset, is reported rather than discovered at
  fetch time.
- `hip` CLI with a command per pipeline stage. Stages are not implemented; each exits
  non-zero naming the milestone that delivers it, so a stub cannot pass for a real run.
- `GET /health` reporting service version, warehouse connectivity, whether the schema is
  migrated, and the last successful load — distinguishing unreachable, unmigrated, and
  migrated-but-empty, which are three different problems with three different fixes.
- Alembic harness with a baseline revision enabling PostGIS, so Milestone 1 adds tables
  rather than inventing the mechanism.
- dbt project with `duckdb` (default) and `postgres` targets; staging materializes as
  views, marts as tables.
- Next.js 16 dashboard shell that server-renders the health response and degrades to a
  readable message when the API is down.
- Test suite of 30 tests covering config loading, CLI surface, health degradation paths,
  and the module dependency rule. The boundary test parses the AST of every module and
  fails on a backward pipeline import, on `api` importing anything beyond `warehouse`
  and `packets`, or on anything importing `api` — with a companion test asserting the
  checker catches known violations, so it cannot rot into a decorative pass.

### Known gaps
- The Postgres path is unrun: no `docker compose up`, no `alembic upgrade head` against
  a live database, no dbt `postgres` target check. Docker is not installed.
- No warehouse table exists yet. No source has been downloaded.
