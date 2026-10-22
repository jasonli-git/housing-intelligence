# Housing Intelligence Platform

Free, sourced answers about housing costs in New Jersey: what homes cost and rent, what a
household can afford, what the tax bill is, how homes sell, and what comes with a place —
flood risk, water, schools, commutes. Live at
**[housing.jasonli.app](https://housing.jasonli.app)**.

It is built on <!-- fill:sources -->57<!-- /fill --> public sources pulled through one staged pipeline into a warehouse,
resolved to a shared geography, and computed before anything is shown. Every figure
carries its source file, date, licence and margin of error. It is not a listings site
and not a chatbot: pages, maps, tools, reports and an API are the product, and an
optional AI layer only explains figures that were already computed.

> **Status — <!-- fill:version -->v0.50.0 (2026-10-08)<!-- /fill -->, updated
> 2026-10-22.** Versions 1 and 2 are complete and Version 3 is under way. New Jersey is
> published in full: the state, <!-- fill:counties -->21<!-- /fill --> counties,
> <!-- fill:towns -->564<!-- /fill --> towns and <!-- fill:zips -->598<!-- /fill --> ZIP
> codes, plus five tools.
>
> **Latest.** The housing atlas maps every town and ZIP code (#428); a fuller page for
> every property in the tax lookup (#427); a starter-home value and a sale price to
> income ratio covering towns Zillow does not (#228, #233); the warehouse runs natively
> on Apple silicon (#230).
>
> **Next.** Clearing TODO and the open Director Notes; then the hosting move for a second
> state, on hold until they are cleared. See [ROADMAP.md](ROADMAP.md) and
> [CHANGELOG.md](CHANGELOG.md).

[SPEC.md](SPEC.md) says what the platform is for, [ARCHITECTURE.md](ARCHITECTURE.md) how
it is built and why, [ROADMAP.md](ROADMAP.md) where it is going and
[TODO.md](TODO.md) what is open now.

## Screenshots

Taken from the build each deploy ships, so they always show the live site (ARCHITECTURE
#175, #393). Each opens the page it shows.

| | |
|---|---|
| <a href="https://housing.jasonli.app/"><img src="https://housing-data.jasonli.app/screenshots/home-desktop.png" alt="Home page" width="420"></a><br>**Home** — search any place, or start from a tool | <a href="https://housing.jasonli.app/states/new-jersey"><img src="https://housing-data.jasonli.app/screenshots/new-jersey-desktop.png" alt="New Jersey page" width="420"></a><br>**New Jersey** — the state, its 21 counties |
| <a href="https://housing.jasonli.app/nj/mercer-county"><img src="https://housing-data.jasonli.app/screenshots/county-desktop.png" alt="Mercer County page" width="420"></a><br>**A county** — costs, the towns, about the place | <a href="https://housing.jasonli.app/nj/princeton"><img src="https://housing-data.jasonli.app/screenshots/town-desktop.png" alt="Princeton page" width="420"></a><br>**A town** — with cheaper alternatives |
| <a href="https://housing.jasonli.app/afford"><img src="https://housing-data.jasonli.app/screenshots/budget-explorer-desktop.png" alt="Budget explorer" width="420"></a><br>**Budget explorer** — where can I afford? | <a href="https://housing.jasonli.app/guide"><img src="https://housing-data.jasonli.app/screenshots/buyers-guide-desktop.png" alt="Buyer’s guide" width="420"></a><br>**Buyer’s guide** — thinking of buying here? |
| <a href="https://housing.jasonli.app/tax"><img src="https://housing-data.jasonli.app/screenshots/tax-lookup-desktop.png" alt="Property tax lookup" width="420"></a><br>**Property tax lookup** — any address’s bill | <a href="https://housing.jasonli.app/atlas"><img src="https://housing-data.jasonli.app/screenshots/atlas-desktop.png" alt="Housing atlas" width="420"></a><br>**Housing atlas** — every measure on a map |
| <a href="https://housing.jasonli.app/compare?places=224,394,85"><img src="https://housing-data.jasonli.app/screenshots/compare-desktop.png" alt="Compare places" width="420"></a><br>**Compare** — up to four places side by side | <a href="https://housing.jasonli.app/help"><img src="https://housing-data.jasonli.app/screenshots/housing-help-desktop.png" alt="Housing help" width="420"></a><br>**Housing help** — affordable homes, vouchers, authorities |
| <a href="https://housing.jasonli.app/stories"><img src="https://housing-data.jasonli.app/screenshots/visual-stories-desktop.png" alt="Visual stories" width="420"></a><br>**Visual stories** — New Jersey’s figures, drawn | |

On a phone:

| | | | |
|---|---|---|---|
| <a href="https://housing.jasonli.app/"><img src="https://housing-data.jasonli.app/screenshots/home-mobile.png" alt="Home page on a phone" width="180"></a> | <a href="https://housing.jasonli.app/nj/mercer-county"><img src="https://housing-data.jasonli.app/screenshots/county-mobile.png" alt="Mercer County on a phone" width="180"></a> | <a href="https://housing.jasonli.app/nj/princeton"><img src="https://housing-data.jasonli.app/screenshots/town-mobile.png" alt="Princeton on a phone" width="180"></a> | <a href="https://housing.jasonli.app/afford"><img src="https://housing-data.jasonli.app/screenshots/budget-explorer-mobile.png" alt="Budget explorer on a phone" width="180"></a> |

## Features

**For readers**

- **A page for every place** — the state, each county, town and ZIP code: home prices and
  rents, the full monthly cost of owning, what a household can afford, how homes sell,
  whether the place is adding homes, and how today compares with its own past.
- **What comes with a place** — flood risk, drinking water and lead lines, utilities and
  broadband, schools, commutes and transit, affordable housing, and who is moving in.
- **Cheaper alternatives** — towns and ZIP codes like this one that cost less.
- **Five tools** — a budget explorer, a buyer's guide, a property tax lookup for any
  address in the state, a housing atlas mapping every measure, and a page comparing up to
  four places side by side, shareable by its link.
- **Sourced and honest** — every figure names its source, date and kind; survey figures
  carry their margin of error and uncertain ranks a range; revisions are recorded.
- **Plain-language readings** — an AI reading per county that may state only figures the
  data holds, each bound to its source before it is published.

**Under the hood**

- **A staged pipeline** — `acquire → land → stage → geocode → validate → load → analyze →
  pack`, each stage persisting before the next; a validation gate stops a bad load.
- **Provenance on every value** — the exact source release and how its geography was
  matched; raw downloads are immutable and content-addressed.
- **It keeps itself current** — a weekly refresh finds new releases, rebuilds only when
  something moved, deploys, and checks the live site.
- **Static publication** — no database or application server in production: the API's
  own responses are published as files, and the site is a static export.
- **Models chosen by measurement** — candidate models are benchmarked on real packets;
  see [Model evaluation](#model-evaluation).

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | Python <!-- fill:python -->3.12.13<!-- /fill -->, TypeScript | Python for data work, TypeScript for the site |
| CLI | Typer | One command per pipeline stage; the only write path |
| Raw storage | Parquet | Immutable columnar landings, readable without a database |
| Transform | DuckDB + dbt-core | Out-of-core SQL over Parquet, with lineage and tests |
| Warehouse | PostgreSQL <!-- fill:postgres -->16<!-- /fill --> + PostGIS | Concurrent readers, constraints, spatial queries |
| API | FastAPI + SQLAlchemy | Read-only, typed, OpenAPI for free |
| Site | Next.js <!-- fill:nextjs -->16<!-- /fill --> + React <!-- fill:react -->19<!-- /fill --> | Static export over the published files |
| Hosting | Cloudflare Pages + R2 | Pages for the site, R2 for the data files |
| Packaging | `uv`, Docker Compose | Locked Python env; Postgres is the only container |

The reasoning behind each, and what was rejected, is in ARCHITECTURE.md's Decisions Log.

## Model evaluation

Each run grades candidate models' answers on real county packets with a fixed rubric (out
of 4); a model stating a figure the packet does not hold is ineligible.

- **[v1](reports/evaluation/v1.md)** (local models): Gemma 4 E4B, 3.21.
- **[v2](reports/evaluation/v2.md)** (hosted): Gemini 3.7 Flash, 3.56; the local model
  beat three of six hosted ones.
- **[v3](reports/evaluation/v3.md)** (reasoning effort as a variable): Gemini 3.7 Flash at
  low thinking, 3.77.
- **[v4](reports/evaluation/v4.md)** (larger packets, a newer judge, so not on v3's
  scale): GPT-6 Luna, 3.64. It now writes the readings, ahead of Claude Haiku 5.5 and
  Gemini 3.8 Flash (ARCHITECTURE #352).

The readings comparisons (readings-v1 to <!-- fill:readings -->v12<!-- /fill -->) are in
[reports/evaluation/](reports/evaluation/).

## Setup

**Prerequisites:** [`uv`](https://docs.astral.sh/uv/) (installs Python 3.12.13), Node.js
22.18+, Docker Desktop (Postgres + PostGIS), Poppler's `pdftotext`
(`brew install poppler`), and free API keys in `.env`: `CENSUS_API_KEY` and
`FRED_API_KEY` are required, `BLS_API_KEY` is strongly recommended (20 years of history
instead of 3). `.env.example` links each signup page. `ANTHROPIC_API_KEY`, the one paid
key, is read only by `hip eval judge`.

```bash
git clone https://github.com/jasonli-git/housing-intelligence.git
cd housing-intelligence
make setup         # Python env, site dependencies, data/ directories, .env
make db-up         # Postgres 16 + PostGIS
make migrate       # alembic upgrade head
make pipeline      # all eight stages; the first run downloads about 2 GB
```

```bash
make api           # http://localhost:8000  (OpenAPI docs at /docs)
make web           # http://localhost:3000
make test          # fast suites, about 30 s
make test-all      # everything, about 11 min
make lint          # ruff + format check + mypy --strict
make               # every target, with a one-line description
```

`make setup-eval` adds the evaluation dependencies; `uv run hip eval --help` and
`uv run hip explain --help` describe the evaluation and reading commands.

If `uv run hip` fails with `No module named 'hip'`, run `make venv-fix` (`uv` marks its
`.pth` files hidden on macOS; `make` targets are unaffected).

## Keeping it current

`make refresh` asks every publisher whether anything moved and rebuilds only if it did.
It exits **0** when everything is current, **3** when it completed with a source
unreachable, and **1** when the pipeline failed — so schedule `uv run hip refresh`, not
`make refresh`, which collapses every failure to 2. `make prune-raw` lists superseded
downloads (`ARGS=--apply` deletes them).

**The weekly refresh.** `scripts/scheduled_refresh.py` runs `hip refresh` and, only if
something moved, rebuilds, deploys and runs `check-live`; it runs only from a clean
`main`. Two `launchd` agents in `scripts/launchd/` run it on Fridays and on demand —
installing them is a separate decision; see the comment in each `.plist`. After every
successful check, quiet weeks included, it uploads `status.json` beside the data
(`make publish-status`), which the site's status link reads to say when sources were last
checked. Regenerating AI
readings is billed, so it is gated: `hip refresh-mode ask|auto` (one file in iCloud Drive's
`HousingPipeline` folder, which an iPhone Shortcut can also write), and
`hip regenerate-now` asks for one outside the schedule.

**Zillow is downloaded by hand, monthly: eight files.** Its terms forbid automated fetching
(ARCHITECTURE #272). When Zillow publishes (the third Thursday of each month; the Friday
refresh notifies when the files are behind), download from
[zillow.com/research/data](https://www.zillow.com/research/data/) into `data/manual/`,
keeping Zillow's file names:

| Folder | Files (County, City and Zip of each) |
|---|---|
| `data/manual/zillow_zhvi/` | `County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` and its `City_` and `Zip_` siblings |
| `data/manual/zillow_zori/` | `County_zori_uc_sfrcondomfr_sm_month.csv` and its `City_` and `Zip_` siblings |
| `data/manual/zillow_zhvi_bottom/` | `County_zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv` and its `City_` sibling (no ZIP file) |

**When a source stops answering**, the refresh exits 3 and names it. Wait a day; if it
persists or the answer changed shape, follow that source's `fallback` in
`config/sources.yml` and record the switch in ARCHITECTURE.md. With no route, the last
release stays, labelled historical.

**This README.** Its counts and versions are filled by `uv run hip readme`; the tests
fail when one is stale, an evaluation report is unlinked, or the status line is older
than the changelog's last change (ARCHITECTURE #420). "Latest" is written by hand.

## Publishing

Production is files, not a running service: `make publish` builds them and `make deploy`
sends them.

```bash
make publish     # dist/artifacts (~19,200 files) + dist/site (~14,950 files)
make deploy      # checks, then artifacts -> R2 (keeping what it replaces), site -> Pages
make check-live  # the live site and data against dist/
make clean-dist  # after check-live passes: free the ~5 GB dist/
make rollback    # what restoring the previous build's data would do; ARGS=--yes to do it
make r2-cors     # once per bucket: let the site's pages read the data files
```

Before anything uploads, `make deploy` runs `check-dist` (a complete tree, every list
complete, no `localhost` links), `check-terms` (every glossary word defined),
`check-accessibility` (80 scans) and the README screenshots. Deploy on a change to
published content, not on every push: the R2 half is an `rclone sync`, which deletes what
`dist/` no longer holds.

**Place addresses.** Place pages live at pinned addresses such as `/nj/princeton`, listed
in `web/lib/placeRoutes.json` and never recomputed by a build; old numeric links
(`/regions/224`) still redirect. A place gaining data for the first time stops the build
until it has an address: run `cd web && npm run routes:refresh`, review and commit.

**Place photos** come from Wikimedia Commons, listed in `web/lib/photos.json` with credit,
licence and crop (public domain, CC0, CC BY or CC BY-SA only; check for faces, plates and
house numbers). A photo whose file changed on Commons stops the publish until reviewed.

### When check-live fails

The weekly refresh runs `check-live` after deploying, retries once two minutes later,
and alerts only if both fail. Then:

1. Run `make check-live` again — a CDN settling usually passes now. If `dist/` is gone,
   `make publish` first.
2. Read what it names. A **manifest mismatch** (R2 holds another build) or a **page
   mismatch** (the Pages upload did not finish): run `make deploy` again. A **CORS or
   search failure**: run `make r2-cors`.
3. If `dist/` itself is wrong, fix forward: correct the cause, then `make publish`,
   `make deploy`, `make check-live`.
4. If readers are seeing a broken page meanwhile, roll back both halves: `make rollback
   ARGS=--yes`, then the previous deployment in Cloudflare's dashboard (Pages →
   housing-intelligence → Deployments → Rollback). It refuses if a Daniel's Law removal
   was recorded since that build; fix forward instead.

### Removing an address under Daniel's Law

A judge, prosecutor or police officer, or a member of their household, can ask for their
home address to come off the property tax lookup at `privacy@jasonli.app`. The law
allows **ten business days** from the notice (ARCHITECTURE #295).

```bash
uv run hip remove-address "12 Elm Ct" --town Montgomery --received 2026-10-02
make publish deploy
```

The first records every parcel at the address and prints the deadline; the second drops
them from the published files. The list is `address-removals.json` in iCloud Drive's
`HousingPipeline` folder, outside the repository (ARCHITECTURE #296);
`HIP_ADDRESS_REMOVALS` points elsewhere. `make publish` refuses to run if the list is
missing or still an iCloud placeholder.

**One-time hosting setup** (Cloudflare; nothing in the files is Cloudflare-specific): an
R2 bucket with a custom domain; an R2 token with Object Read & Write on that bucket; an
`rclone` remote named `r2` (type `s3`, provider `Cloudflare`, `no_check_bucket = true`);
and `ARTIFACT_URL`, `R2_BUCKET` and `PAGES_PROJECT` set in the Makefile. Deploys are
direct uploads: the build reads a local warehouse that is never committed.

## License

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE)
(`AGPL-3.0-only`): anyone may use, change and share it, and anyone who distributes a
modified version, or runs one as a website or service, must offer its source under the
same licence. Versions before 2026-10-06 were MIT licensed. The data and every figure
derived from it are not covered: each source keeps its publisher's terms, and Zillow's
are non-commercial ([NOTICE](NOTICE), ARCHITECTURE #312).
