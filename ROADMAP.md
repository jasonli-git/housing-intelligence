# Housing Intelligence Platform — Roadmap

Version 1 is in progress. Milestones 0 through 3 are complete: the warehouse holds a NJ
geography spine (3,365 regions, 1,902 allocation weights) and 329,975 observations
across 12 metrics from 8 sources, spanning 1971–2026, all served over the API, with 81
tests passing. Milestone 4 is next.

A milestone counts as done when its capability is reachable through the CLI, the API,
or the dashboard on a clean checkout; its tests pass; and
[ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md), and
[README.md](README.md) have been updated to match what actually exists.

## Version 1 Milestones (New Jersey)

| M | Status | Deliverable |
|---|--------|-------------|
| 0 | ✅ done | **Scaffolding** — repo layout, `uv` + `pyproject.toml`, config layer, Docker Compose Postgres/PostGIS, Alembic baseline, dbt project, Next.js app, `hip` CLI, `GET /health`, project docs |
| 1 | ✅ done | **NJ geography spine** — 3,365 regions (1 state, 21 counties, 564 municipalities, 2,181 tracts, 598 ZIPs) with PostGIS geometry, parent chains, and 1,902 area-weighted ZIP allocations; `/regions`, `/regions/{id}`, `/geo/{level}` serve real data |
| 2 | ✅ done | **Home values and rents** — Zillow ZHVI + ZORI through all six implemented stages; 309,350 observations across 21/21 counties, 403/564 municipalities, 548/598 ZIPs; `/metrics`, `/regions/{id}/metrics`, `/sources/unresolved`; dbt staging with 15 tests; a validation gate that blocks bad loads |
| 3 | ✅ done | **Economic and demographic context** — ACS (5 metrics, exact FIPS at county and municipal level), Building Permits, FHFA HPI, FRED, BLS, and IRS migration; 20,625 new observations, a `nation` level for national series, and municipal coverage raised to 564/564 |
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
