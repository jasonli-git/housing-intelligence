# Housing Intelligence Platform — Roadmap

Version 1 is in progress. Milestones 0 through 6 and 9 are complete: the warehouse holds
a NJ geography spine, 332,609 observations across 17 metrics from 9 sources spanning
1971–2026, and 19,527 computed changes with 19,517 rankings — served over the API,
displayed by the dashboard, and packaged as versioned analysis packets, with 131 Python
and 24 dashboard tests passing. All eight pipeline stages now run. Milestone 9 was built
out of numeric order, before Milestone 5, because it corrects numbers the dashboard
displays; fixing them afterwards would have meant re-checking every chart. Milestone 7
is next.

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
| 4 | ✅ done | **Computed housing intelligence** — pct change and CAGR over 1y/3y/5y/10y/since-2019, price-to-income and rent-to-income as computed metrics, rank and percentile per metric and level; `/rankings`, `/compare`, `/regions/{id}/summary` with caveats attached |
| 5 | ✅ done | **Dashboard and maps** — county choropleth drawn as inline SVG from our own GeoJSON, ranking table, region detail with metric tiles, trend charts with crosshair tooltips, and a table view of every series with its source |
| 6 | ✅ done | **Analysis packets and reports** — packet `1.0` published as a generated JSON Schema, `hip pack` writing 21 county packets and their Markdown reports, `/regions/{id}/packet` and `/regions/{id}/report`, and a print-ready report page in the dashboard |
| 7 | ⬜ planned | **Parcel and MOD-IV layer** — NJ parcels in Parquet/DuckDB, municipality-level assessment aggregates promoted to the warehouse and surfaced in the dashboard |
| 8 | ⬜ planned | **Model evaluation and optional explanations** — standardized housing scenarios, local model runner, Claude-graded rubric, published evaluation report, and an explanation panel labeled as interpretation |
| 9 | ✅ done | **HUD affordability inputs** — USPS crosswalk replacing area weights with residential-address ratios (2,456 of 2,491 rows), HUD area median income and 80% AMI limits, and `price_to_ami`. Built out of order, before Milestone 5 |

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
