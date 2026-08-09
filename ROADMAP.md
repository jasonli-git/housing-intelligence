# Housing Intelligence Platform — Roadmap

Version 1 is in progress at Milestone 0. Nothing has shipped: the repository contains
[SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), and these planning documents,
and no application code. A milestone counts as done when its capability is reachable
through the CLI, the API, or the dashboard on a clean checkout; its tests pass; and
[ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md), and
[README.md](README.md) have been updated to match what actually exists.

## Version 1 Milestones (New Jersey)

| M | Status | Deliverable |
|---|--------|-------------|
| 0 | 🚧 in progress | **Scaffolding** — repo layout, `uv` + `pyproject.toml`, Docker Compose Postgres/PostGIS, dbt project, Next.js app, `hip --version`, `GET /health`, project docs |
| 1 | ⬜ planned | **NJ geography spine** — `regions` loaded with NJ state, counties, municipalities, tracts, and ZIPs with PostGIS geometry and crosswalks; `/regions` and `/geo/{level}` serve real data |
| 2 | ⬜ planned | **Home values and rents** — Zillow ZHVI + ZORI from `hip acquire` to `hip load`; NJ county and municipal series queryable at `/regions/{id}/metrics` with source provenance on every value |
| 3 | ⬜ planned | **Economic and demographic context** — ACS, Census Building Permits, FHFA HPI, FRED, BLS, and IRS migration loaded through the same adapter and dbt pattern |
| 4 | ⬜ planned | **Computed housing intelligence** — change metrics, affordability (price-to-income, rent burden), and rankings in the warehouse; `/rankings`, `/compare`, `/regions/{id}/summary` |
| 5 | ⬜ planned | **Dashboard and maps** — Next.js region explorer, trend charts, county comparison, choropleth maps, ranking tables |
| 6 | ⬜ planned | **Analysis packets and reports** — versioned packet schema, `hip pack`, `/regions/{id}/packet`, and an exportable county report |
| 7 | ⬜ planned | **Parcel and MOD-IV layer** — NJ parcels in Parquet/DuckDB, municipality-level assessment aggregates promoted to the warehouse and surfaced in the dashboard |
| 8 | ⬜ planned | **Model evaluation and optional explanations** — standardized housing scenarios, local model runner, Claude-graded rubric, published evaluation report, and an explanation panel labeled as interpretation |

## Post-Version 1 (not scheduled)

- Northeast expansion, then selected national comparison states
- Parcel-level API endpoints and a parcel map layer
- MOD-IV equalization ratios so assessed values approximate market values
- Affordability forecasting and migration-driven demand analysis
- Climate and flood-risk overlays
- Automated monthly housing reports
- Publicly hosted analytics API
- Model-comparison dashboard driven by the Milestone 8 evaluation results
- Scheduled refresh with retry and alerting, replacing manual `hip refresh`
