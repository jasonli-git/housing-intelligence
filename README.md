# Housing Intelligence Platform

A local-first analytics platform that turns fragmented public housing data into a
queryable warehouse of housing intelligence, starting with New Jersey. It pulls parcel
and MOD-IV records, New Jersey's SR1A deed file and its published tax rates, Zillow ZHVI
and ZORI, Census ACS, Population Estimates and Building Permits, FHFA HPI, FRED, BLS,
IRS migration data, and HUD's income limits, Fair Market Rents and CHAS tables through
one staged pipeline, resolves everything to a shared geography spine, and
computes the facts — value growth, rent growth, affordability change, construction
activity, county rankings — before anything is displayed. It is built for someone who
wants to ask where affordability is worsening fastest in New Jersey and get a defensible
answer with the source file behind every number. It is not a chatbot and not a listings
site: dashboards, maps, rankings, reports, and an API are the product, and an optional AI
layer only explains metrics that were already computed.

> **Status — v0.21.0, 2026-09-20. Versions 1 and 2 complete; nothing in progress.**
>
> **Built and deployed.** New Jersey's geography, housing, economic context, property
> tax roll and recorded sales are loaded, queryable and public: 3,366 regions, 3.48M
> parcels, 1.4M deeds, and 410,587 observations across 37 metrics from 16 public sources
> spanning 1971 to 2026, plus 38,226 computed changes and 53,714 rankings. Every source
> is asked on each refresh whether anything has moved, and a figure that changes is
> recorded rather than overwritten — 313,536 such revisions so far. Every value carries
> its source file and match method. All eight pipeline stages run. The site publishes
> itself — 5,955 static artifacts and 2,274 pre-rendered pages, served with no database
> and no application server — across four page types: the state, 1,135 region pages,
> their reports, and an affordability workspace, reachable in place from the state and
> county pages or at its own address.
>
> **Latest.** Milestone 29 shipped on 2026-09-20: the platform now asks each publisher
> whether anything has moved instead of answering from its own cache forever. It found
> that the deployed site was a Zillow release behind, that MOD-IV had gone behind a
> token, and that Zillow had restated 294,469 of its own published figures — all of
> which had been invisible. Before it, Milestone 25 added New Jersey's recorded sale
> prices and the one property tax rate that is comparable between towns, and Milestone
> 24 moved every ACS window forward a year and added a second population source that is
> never mixed with the first in a ratio. Interpretation is a measured layer, not a
> claim: seventeen models have been evaluated against standardized scenarios, five write
> every county's readings side by side, and since Milestone 13 any figure the packet
> does not carry is refused before it is stored.
>
> Next is Milestone 26. See [ROADMAP.md](ROADMAP.md) for what is planned and
> [CHANGELOG.md](CHANGELOG.md) for what shipped.

Read [SPEC.md](SPEC.md) for what the platform is meant to do and why, and
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is built.

## Screenshots

> **Work in progress — the screenshots have been removed for now.**
>
> All eight predated the "Quiet utility" redesign of 2026-09-17 and Milestones 18, 23
> and 16, so they showed pages the site no longer has. Rather than leave pictures that
> misrepresent the product, the section is empty until they are retaken.
>
> Retaking them is a manual step with tooling that now exists:
> `npm run screenshot:poc` in `web/` captures a page headlessly at a given viewport.
> See [`agent-handoffs/screenshot-automation.md`](agent-handoffs/screenshot-automation.md)
> for why capture is not automated per push, and `TODO.md` for the open item.
>
> Until then, the live site is the current view of the product.

## Features

Each is listed with the milestone that delivers it, so this section can be checked
against [ROADMAP.md](ROADMAP.md) rather than believed.

- **Config-driven source registry** (M0, built) — 15 sources and 32 metrics
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
- **New Jersey depth** (M21, built) — HUD Fair Market Rents for every county, with rent
  affordability against that published standard; ACS homeownership and vacancy rates
  for every county and municipality; HUD CHAS cost burden for owners and renters,
  including severe burden, at county and municipal level; building permits for every
  municipality, resolved by FIPS code; and FHFA's all-transactions price index for the
  state back to 1975. No new key: the HUD token covers both new HUD sources.
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
  `/regions/[id]/report` in the dashboard. Two media, one contract, no PDF library. All
  21 counties are published under [`reports/regions/5y/`](reports/regions/5y/) —
  [Bergen](reports/regions/5y/34003.md) is the one shown above.
- **NJ parcels and the property tax roll** (M7, built) — 3.48M parcels acquired from
  NJGIN's ArcGIS service and held in Parquet/DuckDB, aggregated to six municipality
  metrics that describe the housing *stock*: median assessed value, parcel count, median
  year built, median lot size, vacant land share, and apartment share. Matched to Census
  municipalities on the legal form ("Boonton township" against "Boonton town"), which
  reaches 554 of 564 with zero ambiguity where Zillow's name matching ceilings at 403.
- **Ranked by value, not only by change** (M7, built) — "which municipality is most
  expensive" is now a query, not just "which rose fastest". Snapshot sources like MOD-IV
  have no change at all, so without this their data would load and stay invisible.
- **A model chosen by measurement** (M8, built) — **Gemma 4 E4B** (Q4_K_M via Ollama)
  was selected from eight candidates across two runtimes on observed performance on this
  task: 3.21/4.00 weighted rubric score, 0.0% of stated figures unsupported, 3/3 correct
  refusals, 28.6 tok/s. The published report at
  [`reports/evaluation/v1.md`](reports/evaluation/v1.md) shows the evidence, including the
  matched anchor pair that makes the cross-runtime comparison legitimate and the three
  candidates that proved unusable on this hardware; the
  [excerpt below](#model-evaluation--run-v1) has the headline tables.
- **Model evaluation harness** (M8, built) — five standardized scenarios built from
  real analysis packets, run against eight local candidates across two runtimes through
  one `ModelRunner` protocol, with sampling pinned identically on both sides. Every
  stated figure is verified against the packet deterministically, so hallucination rate
  is counted rather than graded; Claude scores only what a reader can judge. A model
  that fabricates figures above a 5% rate is ineligible however well it writes.
- **Explanations labeled as interpretation** (M8, built) — `hip explain` generates a
  short narrative per region with the resolved model and stores it with the model name,
  the runtime or provider that produced it, and a hash of the packet it was written
  from.
  `GET /regions/{id}/explanation` serves it with `kind: "interpretation"` and a `stale`
  flag; the dashboard panel is styled to be unmistakable as commentary. The platform is
  fully usable with none of this generated — a missing explanation renders nothing.
- **Every figure in an explanation traced to its source** (M13, built) — before storing
  a model's prose, `hip explain` binds each figure in it to the packet field, source
  release, period and match method that licensed it, and refuses prose that states a
  figure the packet does not carry. The dashboard marks every cited figure and lists
  where each came from; a reading written before binding existed says its figures are
  unverified. The evaluation counts fabrication with the same code, so a benchmark's
  fabrication rate and the rate at which the site would refuse a model's prose are one
  number.
- **Answers, not only figures** (M17, built) — every region page opens with a verdict
  that quotes the ranks it rests on, whether paychecks kept up, and a housing profile;
  every rank says whether it ranks change or value. A cost-to-own section works out the
  monthly payment on the typical home at the national rate, the reader's down payment
  and the typical property tax bill — a new metric from MOD-IV for municipalities and
  counties — beside the typical rent. `/afford` takes an income and marks every county
  and municipality within reach at 30% of it; search on the New Jersey page names each
  result's legal type and county; region pages compare now with any earlier year. All of
  it is computed from published figures by fixed rules, and says so.
- **Measured build cost, and storage that can move** (M10, built) — `hip footprint`
  reports bytes per storage tier, per warehouse table and per state, including the
  Postgres size that lives inside Docker's disk image where `du` cannot see it. Seven
  per-stage scenarios extend the existing `mac-sitrep` profile rather than adding a
  second timing harness that would put rival numbers in one README. `HIP_DATA_DIR`,
  `HIP_REPORTS_DIR` and `HIP_PGDATA` are independent settings with `~` expansion, so
  the data, the reports and the database can each be moved to another disk.
- **It notices when the data moves** (M29, built) — the platform used to answer every
  source from its own cache forever. On 2026-09-20, with the site already live, Zillow
  had republished on the 16th and the warehouse held the 6th, and a full pipeline run
  reported "172 cached, 0 downloaded" without asking anyone. Now a vintage that names
  one release is answered from disk, and everything else is revalidated with a
  conditional request where a 304 costs nothing — so `make refresh` asks sixteen
  publishers what changed in a few seconds and rebuilds only if something did. One
  publisher failing no longer ends the run, which is how the first refresh discovered
  that MOD-IV had gone behind a token and kept going. And a published figure that
  changes is now recorded in `fact_revision` instead of silently overwritten: that first
  run caught **313,536** revisions, 294,469 of them Zillow restating its own history.
- **What buyers actually paid, and the tax rate you can compare** (M25, built) — two
  New Jersey sources the platform had never read. `nj_sr1a` is the state's SR1A Sales
  File: 1.4M recorded deeds carrying the Division of Taxation's own usable/non-usable
  determination, so `sr1a_median_sale_price` excludes inheritances, sales between
  relatives and sheriff's sales because the state says to, not because a threshold here
  guessed. It is the first **transaction** price on a page that already carried a
  modelled index and a self-reported survey value — Burlington County reads $375,000
  transacted, $426,786 modelled and $354,000 self-reported, each with its own period.
  `nj_tax_rates` supplies the **effective tax rate**, ingested from the state rather
  than derived, which is the figure ARCHITECTURE #141 wanted and rejected for lack of
  exactly these inputs; the Director's Ratio lands beside it as a check. The milestone
  also completed the CD-code crosswalk to 564 of 564, so ten municipalities including
  Parsippany-Troy Hills gained every municipal figure they had been missing.
- **Two population figures that are never mixed** (M24, built) — `census_pep` carries
  the headline population at state, county and municipal level from the Census
  Population Estimates Program, a July-1 point estimate; `acs_population` stays the
  5-year survey average and the denominator of every computed ratio. Mercer County reads
  385,864 from ACS 2020–2024 and 399,289 from PEP Vintage 2025 — two honest answers to
  two different questions, and a test stops a ratio being computed over one of each.
  ACS vintages now follow `ACS_END_YEAR` rather than a list hard-coded since Milestone 3.
- **Published as static files** (M11, built) — `hip publish` replays the API's own ASGI
  app and records its answers as 5,917 static artifacts; the dashboard pre-renders 2,272
  pages. Production runs with no database and no application server. Replaying the app
  rather than re-querying the warehouse is what makes the bytes on disk the same bytes
  the API serves.
- **Hosted inference behind a preference list** (M12, built) — generation runs against
  hosted providers in a configured order that ends on this machine, so no vendor decision
  can stop it. Every candidate is pinned, and `hip eval models --probe` calls each one
  because a listed model is not always a callable one.
- **Substitution detection** (M22, built) — a provider answering with a different model
  than the one requested is caught at runtime and recorded, since not every provider
  offers a pinnable checkpoint.
- **Five models reading the same packet** (M19, built) — every county page carries five
  interpretations side by side, switchable by the reader, each labeled with the model
  that wrote it. The reachable subset of bring-your-own-model comparison, since
  pre-generated explanations need no server.
- **Reasoning effort as a measured variable** (M20, built) — effort is configured per
  candidate and recorded with every generation, so a model's cost and quality are
  compared at a stated setting rather than at whatever the provider defaults to.
- **A design of its own** (M18, built) — Public Sans and JetBrains Mono, a bar shared
  with [jasonli.app](https://jasonli.app), caveats set beside the figures they qualify,
  tabular figures, a print stylesheet, and a palette validated for colour-vision
  deficiency in both light and dark themes.
- **A hand-drawn globe** (M16, built) — every region read off a navigable globe of the
  United States, drawn as SVG with no map library. Every state is on it so the map can be
  panned; only New Jersey carries figures, and the map says so. Two channels — height and
  colour — are explained in its own legend.
- **Answers first, tables one click away** (M23, built) — region pages open with the
  verdict, the monthly cost to own and to rent with the payment split into money gone and
  money kept, where the region stands out by change and by value, and its housing as
  cards, then one expander holding every table, the trends and the interpretation. Every
  metric has a plain definition and a line on why it matters; search sits in the bar on
  every page; `/afford` answers whether one place is within reach of an income; the report
  prints the cost cards and reads as a sheet of paper.

## Sample output

`reports/` is machine-local output, but two sets are published so the claims above can be
read without building the warehouse first: the
[21 county reports](reports/regions/5y/) and the model-evaluation reports for
[`v1`](reports/evaluation/v1.md), [`v2`](reports/evaluation/v2.md) and
[`v3`](reports/evaluation/v3.md). All stay rebuildable — the commands below overwrite
them — and the excerpts here link to the full text.

**The region-report excerpt below is dated, and the linked file is the live version.**
Its figures were published on 2026-08-14 and are copied here by hand, so a source release
that revises history will move the numbers in the linked report without moving the ones
quoted here. The two kinds of output age differently: a region report is pipeline output
and changes whenever a source publishes, while each evaluation run is a record of one
experiment against packets as they stood on its own date, and does not change when data
refreshes.

### Region report — Bergen County, 5y window, as published 2026-08-14

Written by `uv run hip pack --report` to
[`reports/regions/5y/34003.md`](reports/regions/5y/34003.md), and served unchanged by
`GET /regions/8/report?window=5y`. The other 20 counties are in the
[same directory](reports/regions/5y/).

`region_id` is a surrogate key, not a GEOID: Bergen is region 8 and GEOID 34003, and the
two are not derivable from one another. An earlier version of this line said region 11,
which is Mercer. Look an id up with `/regions?level=county&q=Bergen` rather than
guessing it — the `curl` examples further down do exactly that.

> **Where this region stands out**
>
> - **Unemployment rate** — rank 1 of 21 (best end), -45.5%
> - **Home value to area median income** — rank 2 of 21 (best end), +5.9%
> - **Home value to household income** — rank 2 of 21 (best end), +3.4%
> - **Annual rent to household income** — rank 2 of 16 (best end), +2.5%
> - **Area median income (HUD)** — rank 3 of 21 (best end), +24.3%
> - **Renters paying over 30% of income on housing** — rank 19 of 21 (worst end), +4.4%

Six of the report's 15 metrics. Each carries its own window, because each source
publishes on its own cadence and none are stretched to match:

| Metric | Start | Latest | Change | Annualised | Rank | Window |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Median gross rent | $1,506 | $1,863 | +23.7% | 5.5%/yr | 7 / 21 | 2019-12-31 → 2023-12-31 |
| Median household income | $101,144 | $123,715 | +22.3% | 5.2%/yr | 10 / 21 | 2019-12-31 → 2023-12-31 |
| Area median income (HUD) | $104,200 | $129,500 | +24.3% | 5.6%/yr | 3 / 21 | 2020-12-31 → 2024-12-31 |
| Home value to household income | 5.16 | 5.34 | +3.4% | 0.8%/yr | 2 / 21 | 2019-12-31 → 2023-12-31 |
| Unemployment rate | 6.6% | 3.6% | -45.5% | -11.4%/yr | 1 / 21 | 2020-12-31 → 2025-12-31 |
| Home value index, single-family | $598,242 | $791,116 | +32.2% | 5.7%/yr | 17 / 21 | 2021-06-30 → 2026-06-30 |

Rank 1 is the better end of the cohort as the metric defines better, not always the
largest rise. The [full report](reports/regions/5y/34003.md) adds the remaining nine
metrics, a current-values table ranked by value, and the caveats that qualify each figure.

### Model evaluation — three runs, and what changed between them

Every run is written by `uv run hip eval report` from artifacts in `data/eval/`, and
every figure below recomputes from them. The full reports carry the per-model tables,
the anchor pair that makes cross-runtime comparison legitimate, throughput and peak
memory, and the criteria each score was graded against.

| Run | Date | Scope | Selected | Score | Unsupported figures |
|---|---|---|---|---:|---:|
| [`v1`](reports/evaluation/v1.md) | 2026-08-14 | 120 generations, 8 local models | Gemma 4 E4B (Q4_K_M, local) | 3.21/4.00 | 0.0% |
| [`v2`](reports/evaluation/v2.md) | 2026-09-06 | 105 generations, 7 models, hosted providers enter | Gemini 3.7 Flash (hosted) | 3.56/4.00 | 0.0% |
| [`v3`](reports/evaluation/v3.md) | 2026-09-11 | 165 generations, 11 models, reasoning effort measured | Gemini 3.7 Flash, low thinking | 3.77/4.00 | 0.0% |

**The story the three runs tell.** `v1` asked which model this machine could run, and
answered with a 4-billion-parameter local one — chosen on measured performance, not
reputation. `v2` opened the question to hosted providers and the score moved 3.21 to
3.56 while throughput went from 28.6 to 387.4 tokens a second, which is what made
regenerating a whole state affordable. `v3` stopped treating reasoning as a property of
a model and started treating it as a setting: the same Gemini tier at *low* thinking
scored higher than at its default, 3.77 against 3.56, and the run cost about $6.

**What did not move is the point.** No selected model has ever stated a figure its packet
did not carry. The deterministic bar comes first and is counted, not graded — any model
fabricating more than 5% of its figures is ineligible however well it reads — and the
rubric only orders the models that clear it.

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

For the Milestone 8 evaluation, run `make setup-eval` instead: it adds the optional
`mlx` and `eval` groups. Note that `uv sync` makes the environment match exactly the
groups it is given, so a later plain `make setup` **uninstalls** them again.

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
make test          # 468 Python + 197 dashboard tests; API tests skip without a warehouse
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
uv run hip footprint              # bytes per storage tier and rows per state
uv run hip footprint --json       # the same, for capturing into a document
```

Evaluate candidate models and generate explanations (needs `make setup-eval`; the local
cohorts additionally need Ollama running, and Apple silicon for MLX):

```bash
uv run hip eval models                # candidates, and whether each runtime serves them
uv run hip eval scenarios --run v3    # a new run's question set, from real packets
uv run hip eval run --run v3          # every scenario through every model, or --model
uv run hip eval cost --run v3         # what judging would cost, without spending it
uv run hip eval judge --run v3        # rubric grading, billed
uv run hip eval report --run v3       # reports/evaluation/v3.md
uv run hip explain --region 11        # write an explanation the API can serve
uv run hip explain --level county --all --prune   # every listed model; retire the rest
```

Every `hip eval` command names its run, and a run's scenario set is frozen once anything
has been generated against it. Scenarios give models the packet as Markdown, as
`hip explain` does. Hosted candidates are billed per token, and so is the judge.

For a hosted cohort, `hip eval models` asks the provider what it actually serves and
marks a pinned ref that has been withdrawn, which is cheaper to discover here than as
fifteen identical 404s inside a run. `hip explain` resolves its model through the
ordered preference list in `config/evaluation.yml` — the first benchmarked candidate
that is currently reachable, ending at a local model so no vendor decision can stop the
command — and skips regions whose stored prose was written from these exact numbers.
`--all` and `--model` hold every model to the same benchmark; a model that cannot be
used is skipped and named in the closing summary, and the exit status is 0 when every
requested model's prose is current, 3 when some is, and 1 when none is. Local cohorts
run one model at a time because two do not fit in 16GB; hosted cohorts fan out, which is
the reason hosted inference is on the roadmap at all.

**Keeping it current.** `make refresh` asks every publisher whether anything has moved
and rebuilds only if something did. A ref whose vintage names one release — ACS 2024,
SR1A's closed years — is answered from disk without a request. A ref whose vintage is
`current` or a year-to-date file is revalidated with `If-Modified-Since` / `If-None-Match`,
and a 304 is a cache hit, so a run where nothing moved costs a handful of conditional
requests and a few seconds rather than re-downloading 245MB. Publishers that send no
validator at all — FHFA, and the JSON APIs behind Census, FRED, BLS and HUD — fall back
to age, re-fetched after a week (a month for MOD-IV and HUD CHAS, where a re-fetch is
1,741 and 571 requests).

It exits **0** when everything is current, **3** when the pipeline completed with some
source unreachable, and **1** when the pipeline itself failed — the split a scheduler
needs, because fifteen sources moving while one publisher is down is a successful
refresh whose numbers should still deploy. One source failing no longer ends the run.

**Scheduling is yours to install**, deliberately: nothing here writes a cron or launchd
entry. A daily run is enough for a platform whose fastest source publishes weekly —

```cron
0 6 * * *  cd /path/to/housing-intelligence && uv run hip refresh >> /tmp/hip-refresh.log 2>&1
```

— and on macOS a `launchd` agent with `StartCalendarInterval` is the equivalent. Deploy
on exit 0 or 3; investigate on 1.

**Schedule the command, not `make refresh`.** `make` collapses any failing recipe to its
own exit status 2, so scheduling the make target throws away the distinction above: a run
that completed with one publisher down and a run whose pipeline broke both arrive as 2.
`make refresh` is for running it by hand. `make prune-raw` shows which superseded downloads are
safe to delete and needs `--apply` to do it, because a cadence makes `data/raw/` grow
without bound: one refresh took it from 264MB of superseded copies to 511MB.

`make` on its own lists every target. With the warehouse down, the API and dashboard
still run and report the degraded state rather than failing.

**If `uv run hip` ever fails with `ModuleNotFoundError: No module named 'hip'`**, run
`make venv-fix`. `uv` marks its `.pth` files hidden on macOS and CPython skips hidden
`.pth` files; `make` targets are immune because they export `PYTHONPATH`.

**API keys.** `CENSUS_API_KEY` and `FRED_API_KEY` are required from Milestone 3;
`BLS_API_KEY` is optional but raises a 25-query daily limit. All three are free.
`ANTHROPIC_API_KEY` is the one paid key and is read by `hip eval judge` alone — every
other stage runs without it. `.env.example` links to each signup page.

## Publishing

The platform has no request-time compute, so production is a set of files rather than a
running service. `make publish` builds them; `make deploy` sends them.

```bash
make publish   # dist/artifacts (5,917 files, 109 MB) + dist/site (13,657 files, 600 MB)
make deploy    # artifacts -> object storage, site -> static host
```

Two directories because they go to two hosts, and that split is forced by measurement
rather than taste (ARCHITECTURE #68): the export is three times the size of the data it
displays, and static hosts cap files per deployment where object stores do not.

`make deploy` runs `make check-dist` first, which refuses to ship a tree that is
incomplete or that has `localhost` baked into its links — a static export has no runtime
in which to correct a wrong artifact origin, so it would otherwise publish 1,135 dead
download links silently.

**When to deploy.** On a change to published content — a data refresh, regenerated
explanations, a dashboard change — not on every push. Most commits change code, docs or
tests that alter no published byte, and `make deploy` is not a reflex action: its
artifact half is an `rclone sync`, which deletes anything at the destination that `dist/`
no longer contains. Verify a deploy in a browser rather than with `curl`, because both
origins answer scripts with Cloudflare's bot challenge by design (ARCHITECTURE #94).

**One-time setup.** Deployment targets Cloudflare, but nothing about the artifacts is
Cloudflare-specific — they are ordinary files at ordinary paths, and any object store
and static host will serve them.

1. Create an R2 bucket, and connect a custom domain to it for public reads.
2. Create an R2 API token with **Object Read & Write**, scoped to that bucket alone.
3. Configure an `rclone` remote named `r2` (type `s3`, provider `Cloudflare`) with those
   keys and the bucket's S3 endpoint. `no_check_bucket = true` is required: a token
   scoped to one bucket cannot list buckets, and rclone's default existence check fails
   with a 403 that reads like bad credentials.
4. Set `ARTIFACT_URL`, `R2_BUCKET`, and `PAGES_PROJECT` in the Makefile. They live
   there rather than in `.env` because none is secret — the artifact URL is embedded in
   1,135 public pages — and `.env` is gitignored, so a fresh clone would silently build
   with `localhost`.

Deploys are direct uploads, not a Git integration, and cannot be otherwise: the build
fetches 1,135 regions from a local API backed by a warehouse that is gitignored by design
(#10). A hosted builder has nothing to build from.

## Project Status

v0.21.0 — **Versions 1 and 2 are complete; Version 3 is under way.**

Version 1 built the platform: geography, prices, rents, economic context, computed change
and affordability and rankings, the dashboard, versioned analysis packets with exportable
reports, the NJ parcel and MOD-IV layer, and the evaluated local-model explanation layer.
The AI layer is optional throughout — with no explanations generated, every page and
endpoint still works.

Version 2 moved it off `localhost` and made New Jersey excellent before going anywhere
else: static publication on a public domain, hosted inference in place of local
generation, citation binding, deeper New Jersey sources, a three-dimensional map of its
564 municipalities, a consumer entry point, and a design system. Expansion to the
Northeast and to every US county was deferred past Version 2 on 2026-09-07.

Version 3 is depth on what is already held, and nearly every item was a column, a file or
a vintage already on this machine and unused. Three of its six milestones have shipped —
**24** fresher figures, **25** recorded sale prices and a comparable tax rate, **29**
scheduled refresh, brought forward out of order once the site was public and had started
to decay. **26**, **27** and **28** remain, with the map's standing check.

The notes below are a running commentary on individual milestones rather than a complete
list; [CHANGELOG.md](CHANGELOG.md) is the full record and [ROADMAP.md](ROADMAP.md) has
every milestone's status.

**Milestone 10 — build cost and data placement (2026-09-02).** `hip footprint` reports
bytes per storage tier, per warehouse table, and per state, including the Postgres size
that lives inside Docker where `du` cannot reach it. Storage locations became settings
rather than paths derived from one another, so the data root, the reports directory, and
the Postgres data directory each relocate independently. Nothing user-facing changed;
what changed is that the cost of adding a state is now measured instead of estimated.

**Milestone 11 — static publication (2026-09-05).** `hip publish` renders the enumerable
API surface to files whose paths mirror the endpoints, produced by replaying the API's own
ASGI app so the bytes on disk are the bytes the API serves. The dashboard is a static
export over the same 1,135 regions. `make publish` builds both halves; `make deploy` sends
artifacts to object storage and the site to a static host. Production runs no database and
no application server.

**Milestone 12 — hosted inference (2026-09-06).** Generation runs on hosted models by
default and resolves through an ordered preference list at generation time: the first
benchmarked candidate that is currently reachable, ending at the local runtime, so no
vendor decision can stop `hip explain` from running. Six hosted candidates across three
regulatory regimes were measured against the local baseline on the Milestone 8 scenarios
and rubric; Gemini 3.7 Flash was selected at 3.56/4.00 with no fabricated figures. The
local model was not outclassed — it beat three of the six.

**Milestone 19 — multi-model interpretation (2026-09-06).** Every county page carries
five models' readings of the same packet, switchable by the reader and each attributed to
the model and provider that wrote it. The numbers underneath are identical bytes, so the
differences are the models' own — which demonstrates SPEC's requirement that a reader can
tell interpretation from measurement rather than merely asserting it.

**Milestone 22 — substitution detection (2026-09-10).** DeepSeek retires models by routing
their names to a successor, so a request for a retired model returns HTTP 200 and a good
answer from a different one. Nothing failed, so the preference list never fell through,
and a regeneration would have stored the retired name above another model's prose. Every
hosted response is now checked against the model requested, a mismatch is recorded as a
substitution, and `hip explain` checks each hosted tier before using it — which also
closed a gap from Milestone 12, whose fall-through had never covered a withdrawn model.

**Milestone 20 — reasoning effort as a measured variable (2026-09-10).** How hard a model
thinks is now part of its configuration rather than a vendor default nobody chose. `v2`
compared seven models each at its own default — DeepSeek thinks at high effort unless
told otherwise, Mistral not at all — so part of what it measured was the defaults. A
lower-effort setting is now its own candidate, sent in each provider's own shape and
recorded on every answer, and a model writes prose only at the setting its benchmark
measured. On one county packet, turning DeepSeek's thinking off cut its output from
5,693 tokens to 512 for an answer of the same length; whether quality holds is the next
benchmark's question.

**Milestone 21 — New Jersey depth (2026-09-11).** Five sources the warehouse was missing,
two of them new HUD sources on the token it already held. Every county now has HUD's Fair
Market Rent and a rent-affordability ratio against it, where the Zillow-based ratio
reached 19; every county and municipality has ACS homeownership and vacancy rates, the
first ownership measure the warehouse has held; HUD's CHAS tables give owner, renter and
severe cost burden for all 21 counties and 563 of 564 municipalities; building permits
reach every municipality by exact FIPS code, summing to the county totals to the unit;
and FHFA's all-transactions index takes the state's price history back to 1975. Eight
metrics, 13,638 observations, and a county packet about a third larger.

**Milestone 13 — citation binding (2026-09-11).** Every figure in a model's explanation is
bound to the packet field, source release, period and match method that licensed it
before the prose is stored, and prose stating a figure the packet does not carry is
refused. Until now the figure check ran only in the benchmark, so published prose was
vouched for by fifteen sample answers per model. The evaluation counts fabrication with
the same code; packets now cite the release behind the start of every change window as
well as its end; and staleness is decided on what a packet says rather than on when its
files were fetched, so a re-download that moves no figure re-cites stored prose instead
of paying a model to rewrite it.

**Run `v3` — the re-benchmark (2026-09-11).** Eleven configurations of seven models,
including two new Qwen snapshots and thinking-off and low-thinking settings, measured on
the packets Milestones 21 and 13 produced. Gemini 3.7 Flash at low thinking was selected
at 3.77/4.00, and no model stated a figure the packet does not carry beyond one heading
in 91. Five models now write every county's readings, in the order the benchmark set;
the EU tier left because it scored below the local model, and a model that leaves the
order has its readings removed with `hip explain --prune`. The whole run cost about $6.

Milestones and their status are in [ROADMAP.md](ROADMAP.md); the current working list and
known rough edges are in [TODO.md](TODO.md). Work not scheduled for Version 2 is listed at
the end of the roadmap.

> **Some figures in Resource Requirements below may be out of date.** They were
> generated from `v0.9.0` on 2026-08-28; 29 releases have shipped since, through
> `0.21.0`, and the pipeline has gained sources and a revision table. Re-measuring
> needs a `mac-sitrep` run and is not yet automated. Treat the numbers as indicative
> until they are refreshed. **The Storage Footprint below is current** — it is measured
> by `hip footprint`, which is a command this repository owns.

<!-- sitrep:requirements:start -->
<!-- generated by sitrep — do not edit by hand -->

### Resource Requirements

Measured, not estimated — 3 runs of `make pipeline`.

| | Measured |
|---|---|
| **Recommended RAM** | 2.0 GB |
| Peak RAM | 889 MB _(885 MB – 899 MB)_ |
| **CPU load** | **Moderate** — 8.2% of a 10-core machine |
| CPU time | 18 s _(18 s – 18 s)_ |
| Peak CPU | 901% _(868% – 915%)_ of one core <sub>(per 50 ms window)</sub> |
| Wall clock | 22 s _(22 s – 22 s)_ |
| Disk read | 59 MB _(57 MB – 690 MB)_ |
| Disk write | 72 MB _(70 MB – 72 MB)_ |
| Peak swap-out rate | 0 — no swapping |

Measured on Mac16,10 · Apple M4 · 16 GB · 10 cores · macOS 26.6.2 (25G83).

> Not measured on this machine: `thermal.temperature`, `thermal.fan`, `network.per_process`, `process.other_users`, `power.package` — see `sitrep doctor`.

<sub>Generated by [mac-sitrep](https://github.com/jasonli-git/mac-sitrep) 1.1.1 from `v0.9.0` on 2026-08-28.</sub>

<!-- sitrep:requirements:end -->

The figures above are a **warm** run, and Milestone 29 changed what that means.
`hip acquire` no longer answers every cached release without asking: a ref whose vintage
is `current` or a year-to-date file is revalidated against the publisher, so a warm run
now makes a handful of conditional requests — seven, as of 2026-09-20 — and downloads
nothing when they all answer 304. Cold-run cost is not measured.

### Storage Footprint

What the platform still occupies after a run, which is the number that multiplies when
geography expands. `mac-sitrep` measures I/O volume during a run; this measures what is
left behind. Postgres is included because it lives inside Docker's disk image, where
neither sitrep nor `du data/` can see it.

Measured 2026-09-20 with `uv run hip footprint`, New Jersey loaded:

| Tier | Size |
|---|---|
| raw | 2.5 GB |
| parquet | 932.9 MB |
| duckdb | 85.2 MB |
| packets | 7.2 MB |
| **filesystem** | **3.5 GB** |
| postgres | 368.4 MB |
| **total** | **3.8 GB** |

Inside Postgres, the three tables that scale:

| Table | Size | Rows |
|---|---|---|
| `fact_metric_observation` | 179.4 MB | 410,587 |
| `regions` | 86.0 MB | 3,366 |
| `fact_revision` | 56.1 MB | 313,536 |

`regions` carries PostGIS geometry, so it grows with region count rather than with
observation count — the reason a state's cost is dominated by how finely it is
subdivided rather than by how much history it has.

`fact_revision` is new in Milestone 29 and is the one table that grows without any
geography being added: it records a row each time a publisher restates a figure it has
already published, and Zillow's first restatement under it produced 294,469 of them. Its
growth is a function of refresh cadence, not of coverage.

**`raw` grows the same way**, for the same reason: every refresh writes a new
content-addressed copy beside the old one. `make prune-raw` shows what nothing points at
any more and `ARGS=--apply` removes it — a single run on 2026-09-20 recovered 1.4 GB.

New Jersey holds 3,365 regions and 335,263 observations; the `US` nation-level row
accounts for the remaining 664.
