# M47 — schools and community context

Branch: `milestone/m47-schools-community-context` · base: `aa1096d` (M46).
Evidence checked and local data acquired: 2026-10-07.

**Partial milestone delivery, not a claim that every M47 source is complete.**
Schools, reporting-aware historical crime context, and selected CDC health estimates
are implemented. FCC availability ingestion is deferred by the owner, who answered
“Walk me through the FCC download later.” The official address-check link is available
now. Crime is an agency inventory within published county chapters, not municipal
crime rates or a neighborhood safety verdict.

## What changed

- Added four configured, registered sources: NJDOE district performance, NJOGIS
  school district boundaries, NJSP annual agency crime reporting, and CDC PLACES.
  They use the existing acquire/land/stage/load/refresh infrastructure.
- Added a separately cited `community_records` inventory and API components. No
  community indicator was inserted into housing facts, affordability calculations,
  rankings, model packets, or a composite neighborhood/school score.
- County, municipality and ZIP pages now have compact, expandable school, internet,
  crime-reporting and health sections in the existing home-check area.
- Added static artifact plans for each region's community response and three
  county/tract/ZIP health inventories. Tract estimates remain downloadable even
  though housing profiles are not created for tracts without housing facts.
- Included community observation dates in freshness and their release references in
  raw-pruning protection. A download/check date is not shown as a measurement date.
- Addressed the relevant TODO about assisted-housing label contrast on town pages:
  replaced the small accent-colored label with the normal secondary text color.
  Also constrained the local section grid so an expanded agency table scrolls
  inside its container rather than widening a mobile page.
- Updated the completeness question inventory: school context is available;
  the site explicitly declines to determine whether a place is safe.

### Measured coverage

There are **12,144 loaded community records**, separate from the 875,622 existing
housing observations reported by the successful local load.

| Component | Loaded records | Coverage and limits |
|---|---:|---|
| NJDOE performance | 666 districts | 2024–2025; 648 have at least one selected current-year indicator; 18 do not |
| District associations | 2,608 | All 21 counties and 564 municipalities; 597 of 598 ZIP areas; 62 association rows lack a matching performance record |
| NJSP agency reporting | 539 agencies | Reviewed 2023 annual workbook; 489 report 12 months, 50 report fewer |
| CDC county estimates | 63 | Three measures in all 21 counties |
| CDC tract estimates | 6,507 | Three measures in 2,169 of 2,181 tract geographies |
| CDC ZIP estimates | 1,761 | Three measures in 587 of 598 ZIP areas |

The boundary downloads contain 339 unified, 171 elementary and 46 secondary features.
They are not 556 distinct individual school assignments.

The unmatched school-boundary ZIP is `07961`. CDC ZIP gaps are `07703`, `07820`,
`07846`, `07881`, `07961`, `08011`, `08039`, `08095`, `08217`, `08245`, `08890`.
No cause, neighboring replacement, or zero is invented for a missing geography.
All loaded CDC entities match the existing geographic spine.

## Files/modules affected

- `config/sources.yml`: metadata, refresh cadence, adapters, terms and notices.
- `src/hip/sources/community.py`, `sources/registry.py`: downloads, release discovery,
  bounded CDC queries, workbook parsing, suppression and coverage validation.
- `dbt/models/staging/stg_nj_school_performance_records.sql`,
  `stg_nj_school_boundaries_records.sql`, `stg_nj_crime_records.sql`,
  `stg_cdc_places_records.sql`; `dbt/tests/community_contracts.sql`.
- `src/hip/warehouse/migrations/versions/0030_community_context.py`,
  `warehouse/community.py`, `warehouse/freshness.py`, `cli.py`.
- `src/hip/api/routers/community.py`, `api/main.py`, `publish.py`, `completeness.py`.
- `web/lib/api.ts`, `web/components/CommunityContext.tsx`,
  `web/app/regions/[id]/page.tsx`, `redesign.css`, `affordable-housing.css`.
- `tests/test_community.py`, `tests/test_community_load.py`,
  `web/components/CommunityContext.test.tsx`.
- `reports/completeness/2026-10-07.md`: saved standing check.

## Architectural or implementation decisions

### Schools: exact identities, not school assignment or grades

NJDOE's offered download selector determines the newest school year; future years
embedded in other page code are not treated as available releases. Only `All Students`
rows for the requested year are selected: English language arts met/exceeded,
math met/exceeded, and chronic absence. Publisher suppression text and quality notes
survive; `<10%`, `>95%`, missing and suppressed values are not replaced by zero.
Staff contacts are not retained.

Boundary/performance joins use exact NJDOE district IDs (`21-4255`, for example),
never names. Unified, elementary and secondary associations remain separate.
District pieces are unioned before intersection with the existing 2020 Census
home-bearing blocks. Approximate shares use the existing within-block area-weighted
home method, not pupil counts; retain associations with at least 1% or 50 homes.
This is geographic context, not a legal determination or grade/address enrollment
assignment. Boundary observation date is unknown and stays null; the GIS edit date
is not fabricated into a measurement year.

Example checked locally: Princeton (`/regions/224`) associates with Princeton Public
Schools, `21-4255`: ELA 76.9%, math 73.3%, chronic absence 8.2% in 2024–2025.
ZIP 08540 (`/regions/3091`) has seven district associations, illustrating why ZIP
or municipality names cannot select a child's school.

### Crime: coverage before comparison

The [reviewed annual workbook](https://nj.gov/njsp/ucr/pdf/current/20250416_2023_Uniform_Crime_Report.xlsx)
contains 2023 records and was published in April 2025. It is not claimed to be the
newest crime information anywhere on NJSP's site. Validate the year/header, seven
offense counts, sum and 0–12 reported months. Annual totals are displayed only for
12-month reporters; legitimate reported zeros remain zero. No county sum, rate or
safety ranking is computed.

Agency grouping follows the workbook's named county chapters, not an ORI prefix:
statewide agencies occur in Mercer's chapter. The separate State Police chapter is
excluded and that exclusion is disclosed. Town pages show explicitly labeled county
chapter context, not their own crime rate. ZIP pages have no county/police fallback.
A newer annual workbook is discovered as pending until its schema and reporting
coverage receive review. The [newer crime route](https://www.nj.gov/njsp/ucr/current-crime-data.shtml)
also warns that zero can reflect delinquent reporting, so it is not blindly substituted.

### Health: modeled prevalence, not medical or causal conclusions

Selected crude-prevalence measures: general health, frequent mental distress, and
lack of insurance (`GHLTH`, `MHLTH`, `ACCESS2`). CDC's 2025 release uses a 2023
measurement basis for these records. Preserve release year, measurement year,
model basis and **95% confidence intervals**; these are not the site's ACS 90% margins.
Town profiles explicitly show their county's estimates; ZIP profiles show their own
ZIP-area estimates without county substitution. CDC warns against comparing release
editions as trends or using them to evaluate local policies.

County and tract queries are filtered to NJ. ZIP queries are bounded to 07/08 prefixes
and checked against the existing ZCTA spine. Count validation, stable pagination,
duplicate checks and query-size limits prevent silent truncation or a national fetch.
The API provides `/community/health/{county|tract|zip}`. Measured serialized response
sizes: county 37,330 bytes; tract 3,880,474 bytes; ZIP 1,032,376 bytes.

### Exact bytes and atomic replacement

Each staging model captures the SHA-256 in the landed `.parquet.src` sidecar. The
loader checks it against the supplied cached source/layer/vintage release and binds
that exact release ID. Acquiring changed bytes without landing/staging again fails
instead of crediting old rows to the new release. Whitespace in sidecars is normalized
(DuckDB `trim` alone did not remove their newline; a real run caught this and a
regression test pins it).

All inventories are validated before replacement; replacement is transactional.
Missing staging tables leave existing inventories alone; empty, duplicate, invalid
or mismatched-byte staging fails without replacing them. Raw pruning includes these
release references; no raw files were pruned in this task.
Like existing ancillary inventories, this is the current view, not a full revision
time series of school/health/crime rows.

### Source terms and cost

- [NJ state conditions, section F](https://www.nj.gov/nj/legal.shtml) support use of
  State information subject to particular restrictions/third-party rights. NJDOE and
  NJSP are classified as public records, with ads/paid use still unclear—not a blanket
  commercial license. Only public aggregate figures are used.
- Read NJOGIS metadata for [unified](https://www.arcgis.com/home/item.html?id=26a2a9f9cf0a472d865b367f88833336),
  [elementary](https://www.arcgis.com/home/item.html?id=f3e41d7ca433407298bda037806a5e81)
  and [secondary](https://www.arcgis.com/home/item.html?id=4695676d4e134d25b418bee77bbd3fbb)
  boundaries. Credit NJOGIS, preserve as-is/nonlegal/nonsurvey notices, and avoid
  presenting an agency endorsement. Public access is not independent commercial clearance.
- CDC dataset metadata identifies public domain:
  [county](https://data.cdc.gov/d/swc5-untb), [tract](https://data.cdc.gov/d/cwsq-ngmh),
  [ZIP](https://data.cdc.gov/d/qnzd-25i4). Read the [CDC FAQs](https://www.cdc.gov/places/faqs/index.html)
  for modeled-estimate limitations. Source links and notices are included.
- No additional Python or npm dependencies, account, paid API, or license upgrade.
  Repository licensing and existing Zillow noncommercial restrictions are unchanged.
- First download about **143.6 MB**: school workbook 119.2 MB, boundaries 18.7 MB,
  CDC 5.5 MB, crime 0.2 MB. Existing pinned-cache and mutable bounded-refresh behavior
  applies. Scoped staging measured about 15–19 seconds locally. Final frontend page
  generation took 35.2 seconds; this is not a cloud CI benchmark. Budget roughly
  2–5 minutes for incremental source/stage work and 5–10 minutes cold as estimates,
  dependent on network and machine. Full existing analytics/publish is a separate cost.
- Main failure risks: workbook sheet/header changes, publisher outages, revised GIS
  identities, in-place Socrata editions and pagination. Explicit schema/count guards
  fail instead of guessing. The larger workbook is the main first-download cost.

## Assumptions

- The owner approved implementing M47 on this milestone branch, overriding the
  normal bounded-nonmilestone Codex role for this task.
- Existing geographic IDs and 2020 block-home weights are the common spine.
- School context means selected district figures, not a complete evaluation of a
  school; county crime context does not answer town safety; selected CDC health
  estimates do not exhaust environmental exposure (M40 remains separate).
- No billed reading regeneration, outreach, deployment, merge, raw deletion or
  canonical documentation reconciliation is part of this delivery.

## New TODOs / limitations

### Actionable follow-ups, with their gates

1. **FCC — owner-deferred, not an institutional refusal.** Walk the owner through
   the official download/account route later, then inspect the chosen NJ release,
   geographic joins, provider/technology definitions, update cadence and reuse terms.
   The [documented API](https://www.fcc.gov/sites/default/files/bdc-public-data-api-spec.pdf)
   requires an account; location Fabric is separately licensed. Do not make an account,
   silently acquire a restricted Fabric, or use subscription rates as availability.
2. **Newer crime data / town jurisdictions.** Audit the current public reporting
   route and its missing/delinquent codes before expanding beyond the reviewed 2023
   workbook. A municipal jurisdiction crosswalk requires independent evidence; an
   agency name or county chapter is not enough. This audit can start without an email.
3. **62 unmatched school association rows.** Review exact publisher IDs and coverage;
   distinguish boundary/performance edition differences and excluded district types.
   Keep mismatches explicit until reconciled; do not fuzzy-match to inflate coverage.
4. **Radon Director Note: researched, not implemented or promoted to a requirement.**
   [NJDEP's tier report](https://dep.nj.gov/rpp/radon/radon-tier-assignment-report/)
   has 540 entries, including combined municipalities, rather than a direct 564-town
   join. Obtain/verify observation vintage, crosswalk and terms before a bounded
   approved follow-up. A 2022 health tool uses older 2015 tiers; current web publication
   is not necessarily current samples. Even a low-tier town does not rule out a
   home's radon: testing is still the official next step.
5. **Before merge/deploy:** run the slow analytics/artifact-publish gate in an isolated
   session. It was not completed here. Apply migration 0030 before using the new router;
   acquire and land all four sources, stage the four models plus contracts, then load.
   Use the existing production publish/deploy/check-live workflow after review.
6. **Completeness reporting remains fact-centric.** Its geographic/statistical tables
   do not count ancillary school suppressions, agency months or CDC confidence intervals.
   The separate coverage audit above is necessary; do not read “no suppression flags”
   in the standing report as proof that this component dropped NJDOE suppressions.

### Limits that cannot be fixed by filling a cell

- An individual school's assignment needs address, grade and district confirmation.
  A district boundary or ZIP overlap is not a substitute.
- Missing school/CDC coverage (one boundary ZIP, 12 tracts, 11 CDC ZIP areas) must
  stay missing unless a publisher supplies suitable data. No interpolation promised.
- A model-based prevalence estimate cannot diagnose a home, a person or local policy;
  a county chapter of agency counts cannot establish neighborhood safety.
- Prior institutional outreach and gates remain as recorded in
  `agent-handoffs/m42-source-followups.md` and `m44-evictions.md`; this task sent no
  new requests and did not resolve DCA, BPU, water-inventory or DOE LEAD gaps.

Claude should reconcile ROADMAP/TODO/ARCHITECTURE and the milestone status after
review, noting partial FCC delivery and limited crime geography. The canonical
documents and DIRECTOR_NOTES were left untouched. Their existing “Now”/milestone
status may need reconciliation; this handoff is not authoritative documentation.

## Verification

Commands run and final results:

- `.venv/bin/hip check-config`: 43 configured sources, 147 metrics; passed.
- `.venv/bin/alembic upgrade head`: migration 0029 → 0030 applied locally.
- Real acquire/land for all four sources: succeeded; no credentials needed.
- `.venv/bin/hip stage --select 'stg_nj_school_performance_records stg_nj_crime_records stg_cdc_places_records stg_nj_school_boundaries_records community_contracts'`:
  four models and one singular contract passed. An earlier sidecar-newline contract
  failure was fixed and both the real staging run and regression test passed.
- `.venv/bin/hip load`: successful; subsequent scoped hash-aware `load_community`
  with real cached provenance loaded 12,144 records. No community metrics/ranks added.
- Actual API checks: Somerset, Princeton, Absecon and ZIP 08540 behaved as described;
  health inventories returned 200 with 63/6,507/1,761 records and exact release metadata;
  unsupported health level `municipality` returned 422.
- `.venv/bin/pytest -m 'not slow' -o addopts='' -q --junitxml=/tmp/m47-pytests-final.xml`:
  **1,067 passed, 1 skipped, 9 deselected**, 43.67 seconds. The skip was the existing
  “region with no known rent margin” case because every available rent carries a margin.
  PostgreSQL loader tests used isolated temporary tables with rollback, including exact
  SHA binding and failure-preserves-old-inventory cases.
- `.venv/bin/ruff check .`: passed; `ruff format --check src/hip tests`: 215 files
  already formatted; `.venv/bin/mypy src/hip`: 149 sources passed.
- In `web/`: `npm test`: **497 tests / 67 files passed**;
  `npm run typecheck`: passed; `npm run build`: **2,378 static pages built**.
  Local build warns that `NEXT_PUBLIC_ARTIFACT_URL` is unset: this is a local preview,
  not a deployment build with production download URLs.
- `A11Y_PATHS='/regions/12,/regions/224,/regions/3091,/regions/194' A11Y_OUTPUT=/tmp/m47-accessibility-final.json npm run check:a11y`:
  **32 states**, 1440/390 widths, light/dark, collapsed/expanded: zero automated
  violations, zero overflow, zero page errors. Axe still lists needs-manual-review
  items (for example gradient contrast); not a conformance or real-device claim.
  Desktop/mobile Princeton screenshots were also visually inspected.
- `.venv/bin/hip completeness` and `hip completeness --write`: passed; saved
  `reports/completeness/2026-10-07.md`. Its summary: 147 metrics, 123 municipal,
  84 with ≥95% municipal coverage; 40 enabled sources (20 current, 19 not tracked,
  1 unreachable); 10/10 subjects; 62 metrics with margins; 16/19 questions answered,
  1 explicitly declined, 2 neither; 19/40 source licenses public domain. “Not tracked”
  is not a currentness guarantee; remaining reuse uncertainty is retained.
- `git diff --check`: passed; canonical-document and Director Note diff empty.

**Not completed:** unfiltered slow test suite, full artifact publish, a fresh full
analytics rebuild, production build/deploy, `check-live`, and FCC acquisition. Two
initial unfiltered runs entered expensive slow analytics/publish fixtures and were
interrupted; database locks cleared and the final normal suite passed afterward.
Do not interpret the normal suite or Next export as `make test-all` passing.
