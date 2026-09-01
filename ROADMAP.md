# Housing Intelligence Platform — Roadmap

**Version 1 is complete — all ten milestones shipped.** The warehouse holds a NJ
geography spine, 335,927 observations across 23 metrics from 10 sources spanning
1971–2026, 19,527 computed changes, and 19,517 change plus 8,302 value rankings — served
over the API, displayed by the dashboard, and packaged as versioned analysis packets,
with 223 Python and 26 dashboard tests passing. All eight pipeline stages run.

**Version 2 is planned and not started.** It moves the platform off `localhost` and
past New Jersey: publication as static artifacts on a public domain, interpretation
written by a hosted model rather than a local one, geography expanded to the Northeast
and then to every US county, and a design language to present it in. Everything it
runs on — the warehouse schema, the analytics layer, the packet contract — is what
Version 1 built.

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

## Version 2 Milestones (public hosting and expansion)

**Planned as of 2026-08-30; none started.** Version 2 changes four things and
deliberately not a fifth: where the platform runs (a public domain rather than
`localhost`), how much geography it covers (Northeast, then national at county level),
what writes the interpretation (a hosted model rather than a local one), and what the
result looks and behaves like (a design language of its own, rather than the system
defaults the dashboard reaches for today). The warehouse schema, the analytics layer,
and the packet contract are not in scope — SPEC
principle "each future capability should reuse the same warehouse and analytics layer"
holds, and a Version 2 that rewrites the fact table has gone wrong.

| M | Status | Deliverable |
|---|--------|-------------|
| 10 | ⬜ planned | **Portable build environment** — `HIP_DATA_DIR` honored by every stage, `reports_dir` decoupled from it, the Postgres volume relocatable off the boot disk, and per-stage wall-clock and bytes recorded alongside the RAM figures already in the README, so a full build runs from an external SSD and its cost is measured rather than estimated |
| 11 | ⬜ planned | **Static publication** — `hip publish` rendering every API response and dashboard page as immutable files under a content-addressed manifest, `make publish` deploying them, and New Jersey served from the custom domain with no database and no application server in production |
| 12 | ⬜ planned | **Hosted inference** — a `HostedRunner` implementing `ModelRunner`, hosted candidates measured against Gemma 4 E4B on the Milestone 8 scenarios and rubric, an ordered preference list of benchmarked models resolved at generation time with the local runtime last, version-pinned model identifiers, per-candidate token rates recorded in config so the evaluation report can carry a quality-per-dollar column, staleness compared at display precision rather than on raw floats, and batch submission for the regeneration pass |
| 13 | ⬜ planned | **Citation binding** — every figure in an interpretation resolved to the packet field, source release, period, and match method that licensed it, produced inside `hip explain`, with the same ground-truth index reused by the evaluation report |
| 14 | ⬜ planned | **Northeast expansion** — CT, MA, ME, NH, NY, PA, RI, VT loaded at all five levels, the first run of the pipeline at roughly seven times current volume, and a per-state coverage report showing what each source did and did not resolve |
| 15 | ⬜ planned | **National county coverage** — all 50 states, DC, and PR at `state` and `county` level only, on federal sources that key on exact FIPS, giving national coverage without a national municipality model |
| 16 | ⬜ planned | **Three-dimensional national map** — county choropleth extruded by a magnitude metric and colored by a ratio metric, replacing the inline-SVG map as the landing view |
| 17 | ⬜ planned | **Consumer entry point** — search by place name or ZIP, and an income-to-affordability view built on the existing `price_to_income` and `price_to_ami` metrics |
| 18 | ⬜ planned | **Design system and identity** — a typeface pairing and a wordmark replacing the system font stack, the interaction and focus states the stylesheet currently declares none of, metric and window chosen by the reader rather than fixed as module constants, and a named component layer replacing per-page inline grids. Built before 16 and 17 |

The done criterion from Version 1 is unchanged: a milestone counts as done when its
capability is reachable through the CLI, the API, or the dashboard on a clean checkout;
its tests pass; and [ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md),
and [README.md](README.md) have been updated to match what actually exists. Milestone 11
adds one condition to that list, because it is the first milestone whose output is not
on this machine: the published artifact must be reachable at its public URL.

### Why this order

**Cost before scale.** Milestones 10 through 13 are all at New Jersey's current size —
3,365 regions, 335,927 observations. Each removes a cost that would otherwise be
multiplied by every state added afterwards. Publishing is proven at 21 counties before
it is attempted at 3,144; inference is moved off the local runtime before the
region count grows sevenfold. Expanding first and optimizing afterwards means paying
the unoptimized bill on the larger dataset and rebuilding the pipeline under a live
site.

**Milestone 10 is small and blocks everything.** `data/` is 2.9GB today against 32GB
free on the boot disk, and Northeast expansion adds TIGER `cousub` and `tract`
downloads for eight more states. The work itself is a config seam and a Docker volume,
but nothing after it fits without it. One defect is already known and is the reason
this is a milestone rather than a chore: `Settings.reports_dir` derives from
`data_dir.parent` ([src/hip/config.py:140](src/hip/config.py:140)), so relocating the
data root silently relocates `reports/` with it — and `reports/regions/5y/*.md` are
tracked in git and linked from the README.

**Milestone 12 precedes 14 because of wall-clock, not price.** Gemma 4 E4B took
9,140ms per generation in the Milestone 8 measurements. Twenty-one counties is three
minutes. Every Northeast county is about thirty; every US county is about eight hours,
serially, on a machine that cannot hold two models at once. Hosted inference is
concurrent, which is the property that matters. The token bill is the smaller argument:
at the measured prompt size a full county-level regeneration is single-digit dollars,
and it is the only recurring cost in the Version 2 architecture that is not rounding
error — which is why display-precision staleness gating is in the same milestone rather
than deferred as an optimization. Zillow revises its indexes retroactively every month,
so hashing raw floats marks nearly every region stale on every run and pays to rewrite
prose that reads identically.

**The preference list in Milestone 12 is a durability mechanism, not a tuning knob.**
Pinning generation to one hosted model reintroduces, as a vendor dependency, exactly
the single point of failure that running locally never had. The list resolves at
generation time to the first available candidate and ends at the local runtime, so no
vendor decision can stop `hip explain` from running. Two rules keep it from becoming a
back door around Milestone 8's discipline: only benchmarked models are eligible for the
list, and hosted identifiers are pinned to explicit versions rather than to moving
aliases — a withdrawn pin fails loudly and falls through, where a repointed alias would
change published prose with nothing in the output to show it had happened.

**Milestone 18 is scheduled before 16 and 17, out of numeric order.** Version 1 set the
precedent and the reasoning is the same: Milestone 9 was built before Milestone 5
because it corrected numbers the dashboard displayed, and fixing them afterwards would
have meant re-checking every chart. Establishing a design language after building the
three-dimensional map and the consumer entry point would mean rebuilding both of them
in it.

The problem is specific rather than cosmetic, and three findings define it.
`web/app/globals.css` declares no `:hover`, `:focus`, `:focus-visible`, `:active`, or
`transition` rule anywhere, so nothing on the page responds to being pointed at and
keyboard focus falls back to whatever the browser supplies. The landing page's metric
and window are module constants — `const METRIC = "zhvi_sfr"` in
[web/app/page.tsx](web/app/page.tsx) — so a reader cannot ask it a different question,
and a dashboard nothing can be asked of reads as a screenshot of one. And the type is
the system stack, which is the single largest reason a competent page still looks like
every other data page.

**What Milestone 18 must not discard matters as much as what it changes.** The palette
is a validated instrument rather than a default: warm neutrals instead of slate, three
categorical slots cleared against CVD and normal-vision contrast floors in both themes,
a documented relief rule for the aqua that measures 2.74:1, and dark steps selected for
the dark surface rather than inverted into it. `font-variant-numeric: tabular-nums` is
load-bearing on every table and tile. The print stylesheet is a first-class output, not
an afterthought. The interpretation panel's dashed border and indentation are how a SPEC
requirement is kept on screen rather than merely asserted. A revamp that restyles those
away is a regression wearing a new typeface.

**Milestone 13 follows 12 rather than preceding it.** Citation binding is deterministic
and model-independent, so either order works mechanically. It is scheduled second
because Milestone 12 measures the hosted candidates' fabrication rate against the
0.0% Gemma 4 E4B achieved, and that number is the argument for how strict the binding
has to be. It is scheduled before any expansion because it is the guardrail on prose
published under a personal domain, and because the retention it needs already exists —
the work is the index, not the schema.

**Milestones 14 and 15 are different axes and can be reordered.** 14 adds depth
(all five levels, few states); 15 adds breadth (two levels, every state). 15 is the
easier engineering — 3,144 regions matched on exact FIPS, no name matching — and it is
the milestone that unblocks 16. Northeast is scheduled first because it follows SPEC
principle 3's stated progression and because it exercises the volume increase at a size
where a bad load is still cheap to reload. Swapping them buys the map sooner at the
cost of testing scale later; both are defensible and the choice is open until 13 ships.

### Decisions this version needs from the user

- **Hosted inference — settled 2026-09-01, [SPEC.md](SPEC.md) amended to v1.1.**
  Hosted by default, local runtime retained as a working fallback. An earlier version
  of this section said Milestone 12 contradicted the specification; that was wrong.
  Principle 8 already required the AI layer to be replaceable and named Gemini and
  DeepSeek among the providers the platform must not depend on, so the amendment was
  narrow rather than a change of philosophy: the evaluation obligation was widened from
  local models to every candidate, the diagrams were relabelled, and the loss of
  reproducible generation was written down as an accepted trade. Every other constraint
  is unchanged — packets only, explanation not chat, model choice from measurement, and
  the API still never runs a model ([ARCHITECTURE.md](ARCHITECTURE.md) #6).
- **Milestone 16 reverses the no-map-library decision.** The current choropleth is
  inline SVG rendered from our own GeoJSON, chosen deliberately. An extruded map means
  a WebGL renderer and a vector-tile format for anything below county level. It is a
  real reversal and gets its own Decisions Log row superseding the original, not a
  quiet dependency addition.

### Known constraints carried into Version 2

Written down now because each one shapes a milestone and none is a bug to be fixed
later.

- **`cousub` is the municipality layer**
  ([src/hip/sources/tiger.py:37](src/hip/sources/tiger.py:37), and
  `municipality_id_system: census_mcd`). New Jersey is a strong-MCD state where county
  subdivisions are real incorporated municipalities, and so is every state in
  Milestone 14. Much of the South and West is not: county subdivisions there are
  statistical divisions with no government, and Zillow's city-level data keys to Census
  *places* rather than to MCDs. Milestone 15 avoids the problem by stopping at county
  level. Anything below county level outside the strong-MCD states needs the geography
  decision listed under Post-Version 2, and `config/geography.yml` already warns that
  the identifier system is expensive to change once fact rows reference it.
- **Parcel and MOD-IV coverage does not generalize.** There is no free national parcel
  dataset; every state publishes its own format under its own license. The 3.48M NJ
  parcels stay a single-state depth layer, and no Version 2 milestone extends them.
- **Zillow is licensed for non-commercial use with attribution.** Public hosting as a
  portfolio piece is within that; monetizing the result is not.
- **Cloudflare Pages caps files per deployment.** Milestone 11 must confirm the current
  limit before choosing between one rendered file per region and a queryable data layer
  for the long tail. At national municipality scale the per-region approach does not
  fit, which is a constraint on the artifact layout rather than on the schedule.

## Post-Version 2 (not scheduled)

Citation binding, evidence references in the evaluation report, Northeast expansion,
automated monthly reports, and the publicly hosted analytics API have moved into the
Version 2 table above. What remains unscheduled:

- **Geography model for non-MCD states** — whether `place` becomes a sixth level
  alongside `municipality`, whether the identifier system is chosen per state in
  `config/geography.yml`, or whether municipality-level analysis simply stops at the
  strong-MCD states. The schema change is small — a `region_level` enum value and a
  config key — and the migration is not, because `region_id` is referenced by every
  fact row. Needs deciding before any expansion past Milestone 14, not before.
- **State expansion past the Northeast**, in strong-MCD order — WI, MI, MN, ND, SD
  extend Milestone 14 with no geography change at all; everything else waits on the
  entry above.
- **Climate and flood-risk overlays** — the highest consumer value of anything on this
  list, and FEMA's National Flood Hazard Layer is free. Held back only because it adds
  a source family with different geometry semantics than any current source.
- **Model-comparison dashboard driven by the Milestone 8 evaluation results** — the
  data already exists in `data/eval/v1`, so this is a presentation milestone whose cost
  is close to zero. A natural companion to Milestone 16 rather than a milestone of its
  own.
- **Scheduled refresh with retry and alerting, replacing manual `make pipeline`** —
  becomes necessary rather than convenient once a published site is expected to reflect
  a monthly cadence. Deferred because a manual run is honest at one state and
  misleading only at scale. (Earlier versions of this list said `hip refresh`; no such
  command exists — the eight stages are invoked individually or through
  `make pipeline`.)
- **Parcel-level API endpoints and a parcel map layer**, which need the parcel geometry
  Milestone 7 deliberately did not download
- **MOD-IV equalization ratios** so assessed values approximate market values
- **Migration-driven demand analysis**
- **Affordability forecasting** — listed in SPEC's long-term direction and deliberately
  left unscheduled. Every other output the platform publishes is measured and traceable
  to a source release; a forecast would be the only one that is neither, on a site whose
  entire claim is provenance. If it is built, it needs its own accuracy evaluation in
  the same way the interpretation layer got one, and that is a milestone rather than a
  feature.
