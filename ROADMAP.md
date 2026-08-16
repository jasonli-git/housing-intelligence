# Housing Intelligence Platform — Roadmap

**Version 1 is complete — all ten milestones shipped.** The warehouse holds a NJ
geography spine, 335,927 observations across 23 metrics from 10 sources spanning
1971–2026, 19,527 computed changes, and 19,517 change plus 8,302 value rankings — served
over the API, displayed by the dashboard, and packaged as versioned analysis packets,
with 223 Python and 26 dashboard tests passing. All eight pipeline stages run.

Two milestones ran out of numeric order. Milestone 9 was built before Milestone 5,
because it corrects numbers the dashboard displays and fixing them afterwards would have
meant re-checking every chart. Milestone 8 closed last, on 2026-08-14: eight local models
were evaluated against standardized scenarios built from real packets, Gemma 4 E4B was
selected on measured performance rather than reputation, and it now writes the
interpretation panel on every county page.

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
| 7 | ✅ done | **Parcel and MOD-IV layer** — 3.48M NJ parcels in Parquet/DuckDB, six municipality assessment aggregates promoted to the warehouse for 554 of 564 municipalities, value-based rankings and packet `1.1` levels so a snapshot metric is visible at all, 554 NJ municipal codes in `region_identifiers`, and the release-vintage provenance defect fixed |
| 8 | ✅ done | **Model evaluation and optional explanations** — 5 standardized scenarios over 3 real county packets put through 8 local models across 2 runtimes (120 generations, 105 usable), every stated figure checked against its packet, 105 rubric judgments from `claude-opus-5`, and a published report selecting **Gemma 4 E4B** on measured performance. `hip explain` wrote 21 county explanations, served by `/regions/{id}/explanation` and shown as interpretation in the dashboard |
| 9 | ✅ done | **HUD affordability inputs** — USPS crosswalk replacing area weights with residential-address ratios (2,456 of 2,491 rows), HUD area median income and 80% AMI limits, and `price_to_ami`. Built out of order, before Milestone 5 |

## Post-Version 1 (not scheduled)

- **Citation binding for generated text** — resolve every figure in an interpretation back
  to the packet field, source release, period, and match method that licensed it, and do
  it inside `hip explain` so prose and citations are written together rather than
  reattached at render time. Deterministic string-to-packet matching: no second model
  call, no tokens spent on citing, and no opportunity for the model to invent a citation.
  The retention this needs already exists — Milestone 2 puts a source release and match
  method on every value, Milestone 6 carries source, URL, publisher, license, vintage,
  period, and caveats into every packet — so the work is the index, not the schema: a map
  from value to provenance path, replacing the flat `set[float]` in `hip.eval.checks`,
  which can answer whether a number is in the packet but has already discarded which field
  produced it. Two rules have to be decided rather than defaulted: what to do with figures
  that legitimately resolve to more than one field, since rounded and derived forms are
  deliberately in that set and two metrics can share a rank, and whether citation should
  inherit the tolerant matching that the fabrication rate uses. A wrong citation is worse
  than no citation here. Sentences with no figure stay bare, and that is the point — the
  causal claims are exactly what a packet cannot license, so an uncited sentence reads as
  the interpretation it is.
- **Evidence references in the evaluation report** — retain the same ground-truth index
  alongside each benchmark scenario, so the deterministic pass can report which packet
  field supports a stated figure instead of only that some value matched within tolerance,
  and cite it in the published report. The batch Claude pass keeps doing what only it can:
  semantic corroboration, unsupported claims, hallucination, and causal overreach, graded
  against the criteria that already exist. Same index as the entry above, second consumer —
  which is the argument for building them together.
- Northeast expansion, then selected national comparison states
- Parcel-level API endpoints and a parcel map layer, which need the parcel geometry
  Milestone 7 deliberately did not download
- MOD-IV equalization ratios so assessed values approximate market values
- Affordability forecasting and migration-driven demand analysis
- Climate and flood-risk overlays
- Automated monthly housing reports
- Publicly hosted analytics API
- Model-comparison dashboard driven by the Milestone 8 evaluation results
- Scheduled refresh with retry and alerting, replacing manual `hip refresh`
