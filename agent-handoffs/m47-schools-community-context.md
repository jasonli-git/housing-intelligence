# M47 — schools and community context

Branch: `milestone/m47-schools-community-context` · base: `aa1096d` (M46).
Evidence checked and local data acquired: 2026-10-07.

**Partial milestone delivery, not a claim that every M47 source is complete.**
Schools, reporting-aware historical crime context, selected CDC health estimates,
and FCC county availability summaries are implemented. FCC was initially deferred
by the owner (“Walk me through the FCC download later”), then approved after the
public-download walkthrough on October 7. Automated FCC acquisition and exact
municipality/ZIP summaries remain pending. The official address checker stays the
first step for a home. Crime is an agency inventory within published county chapters, not municipal
crime rates or a neighborhood safety verdict.

## What changed

- Added five configured, registered sources: NJDOE district performance, NJOGIS
  school district boundaries, NJSP annual agency crime reporting, CDC PLACES, and
  FCC Broadband Data Collection public summaries.
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

There are **12,210 loaded community records**, separate from the 875,622 existing
housing observations reported by the successful local load.

| Component | Loaded records | Coverage and limits |
|---|---:|---|
| NJDOE performance | 666 districts | 2024–2025; 648 have at least one selected current-year indicator; 18 do not |
| District associations | 2,608 | All 21 counties and 564 municipalities; 597 of 598 ZIP areas; 62 association rows lack a matching performance record |
| NJSP agency reporting | 539 agencies | Reviewed 2023 annual workbook; 489 report 12 months, 50 report fewer |
| CDC county estimates | 63 | Three measures in all 21 counties |
| CDC tract estimates | 6,507 | Three measures in 2,169 of 2,181 tract geographies |
| CDC ZIP estimates | 1,761 | Three measures in 587 of 598 ZIP areas |
| FCC fixed-broadband summaries | 66 | NJ state and all 21 counties × All Wired, Fiber and Cable; residential-service offers, Total area |

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
- `src/hip/sources/fcc.py`, `src/hip/config.py`: validated public ZIP import, both
  as-of/revision dates, cached-vintage advancement and semiannual source cadence.
- `dbt/models/staging/stg_nj_school_performance_records.sql`,
  `stg_nj_school_boundaries_records.sql`, `stg_nj_crime_records.sql`,
  `stg_cdc_places_records.sql`, `stg_fcc_bdc_records.sql`; `dbt/tests/community_contracts.sql`.
- `src/hip/warehouse/migrations/versions/0030_community_context.py`,
  `warehouse/community.py`, `warehouse/freshness.py`, `cli.py`.
- `src/hip/api/routers/community.py`, `api/main.py`, `publish.py`, `completeness.py`.
- `web/lib/api.ts`, `web/components/CommunityContext.tsx`,
  `web/app/regions/[id]/page.tsx`, `redesign.css`, `affordable-housing.css`.
- `tests/test_community.py`, `tests/test_community_load.py`,
  `tests/test_fcc.py`, `web/components/CommunityContext.test.tsx`,
  `web/lib/freshness.ts`, `web/lib/freshness.test.ts`.
- `reports/completeness/2026-10-07.md` and `2026-10-07-2.md`: initial and FCC follow-up standing checks.

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

### FCC: public aggregates, not the licensed location Fabric

The owner downloaded four public ZIPs without signing in. The earlier deferral
incorrectly conflated the documented authenticated API with the public website's
downloads. It was not a demonstrated terms barrier or proof that Codex could not
download these files. No account, API key or Fabric license was required for these
public downloads; no restricted access or hidden endpoint was used.

Approved county-first import:
`bdc_us_fixed_broadband_summary_by_geography_D25_29sep2026.zip`, 9.1 MB compressed
(90.6 MB CSV). As-of **2025-12-31**, publisher revision **2026-09-29**, acquired
**2026-10-07**. Raw SHA-256:
`3d47aca350a59dc9ae19dba0144e859dc2c35ef36132ffa093d6f9c1663e075b`.
The source ZIP was copied into ignored `data/manual/fcc_bdc/` and acquired into
content-addressed raw storage. No raw ZIP is committed. Downloads were not deleted
or modified; the other three files (NJ Cable, Fiber and Census-place summaries)
were inspected but are not imported or needed by the county summary.

Read FCC's [current output dictionary](https://us-fcc.app.box.com/v/bdc-data-downloads-output),
dated August 11, 2026, fixed-summary section (printed pp. 11–14). `total_units` is
the sum of units at all broadband-serviceable locations in the geography, including
multi-unit buildings—not Census households, people, customers or subscribers. The
published residential-service (`R`) shares retain that FCC denominator. Store the
published fractions; multiply by 100 only for display. Do not reconstruct a denominator
from residential rows or sum overlapping technologies.

UI shows wired 100/20 Mbps, wired 1,000/100 Mbps and fiber 100/20 Mbps, in a compact
expansion beside the address-check link. Somerset: 153,014 FCC units; wired shares
98.3% and 75.3%, fiber 71.3% at 100/20. These are advertised provider offers, not
measured speed, price, take-up or a guarantee at a home. All Wired excludes wireless:
a gap here is not proof that a unit has no internet option.

Use exact state/county GEOIDs. Town profiles show explicitly labelled **county
context**, never a town estimate. ZIPs get no county fallback. The downloaded place
file has 701 Census places, versus the platform's 564 legal municipalities; their
GEOIDs are different geographic types (Princeton place `3460900`, municipality
`3402160900`). No name-based, prefix-stripping or unverified place-to-town conversion.
The NJ state summary is retained and available through the community API, but the
statewide page has not gained a new section in this county-first follow-up.

ZIP member name must match both vintage dates. Schema, finite 0–1 shares, descending
speed-tier coverage, positive/consistent denominators, duplicate keys and complete
state-plus-21-county coverage all fail closed. Loader validates the payload too;
staging/loader bind the exact acquired file hash. No FCC values enter ranked facts,
affordability or AI packets. Re-import is not an analytics regeneration.

Manual acquisition is an integration choice pending documented API setup, not an
automation prohibition. A future approved ZIP belongs in `data/manual/fcc_bdc/`;
run `hip acquire --source fcc_bdc --vintage <as-of>_<revision>`, then land/stage/load
that same release. Filename and CSV member must match the FCC revision stamp.
The registry advances from acquired cache entries, not arbitrary Downloads contents.
Publisher cadence is semiannual, not an asserted publication day. Check the public
download selector's availability date and last-updated stamp for a newer edition;
there is **no automated FCC Friday check** in this delivery. Freshness shows the
measurement date and import date separately; no recorded discovery means newer
editions are not tracked. The generic status label was corrected so manual/pinned
sources are not falsely described as automatically re-read.

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
- [FCC License and Attribution](https://broadbandmap.fcc.gov/about) expressly offers
  BDC availability data free without copyright restriction; attribution is requested
  and included as “Source data: FCC Broadband Data Collection.” CostQuest location
  Fabric retains separate rights and is not imported. The [FCC account guide](https://help.bdc.fcc.gov/hc/en-us/articles/20044640394395-How-to-Create-an-FCC-User-Account)
  concerns API access; it is not a prerequisite for the public website ZIPs.
- No additional Python or npm dependencies, paid API, or license upgrade are required
  for these imports. Public FCC ZIPs require no account; the owner's account setup
  concerns an optional API follow-up. Repository licensing and existing Zillow
  noncommercial restrictions are unchanged.
- First download about **143.6 MB**: school workbook 119.2 MB, boundaries 18.7 MB,
  CDC 5.5 MB, crime 0.2 MB. Existing pinned-cache and mutable bounded-refresh behavior
  applies. Scoped staging measured about 15–19 seconds locally. Final frontend page
  generation took 35.2 seconds; this is not a cloud CI benchmark. Budget roughly
  2–5 minutes for incremental source/stage work and 5–10 minutes cold as estimates,
  dependent on network and machine. Full existing analytics/publish is a separate cost.
- FCC follow-up adds 9.1 MB raw plus a retained manual copy; ZIP is streamed, not
  unpacked to a national CSV. It lands only 66 NJ records. Staging/contract execution
  was under a second after dbt startup locally. No new dependency or fee. Manual
  download timing, filename/schema changes and stale cached editions are the main
  added risks; unattended acquisition is explicitly unfinished.
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

1. **FCC automation and finer geographies — actionable, not an institutional refusal.**
   County summaries are now loaded after the owner's approval. Configure documented
   API access or verify a supported public automation route before promising scheduled
   acquisition. Audit an exact Census-place/MCD crosswalk before town figures; ZIP
   aggregation needs suitable geography and an authorized denominator, not a name join.
   The [documented API](https://us-fcc.app.box.com/v/bdc-public-data-api-spec)
   requires an account and token; location Fabric is separately licensed. The owner
   began account setup but paused API acceptance pending clarification, then sent
   both inquiries below. Do not generate/use API credentials or acquire Fabric
   without the next explicit approval; do not use subscriptions as availability.
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
5. **Production rollout after review:** the slow analytics/artifact-publish gate has
   now passed locally (see the final verification below). Apply migration 0030 before
   using the new router in another environment; acquire and land all five sources
   (FCC requires the manual summary ZIP), stage the five models plus contracts, then
   load. Without the manual ZIP, FCC acquisition stays pending; the site must not
   invent availability or mark it current. Production-configured build/publication,
   deployment and `check-live` remain unperformed; use the existing workflow after
   review and explicit deployment approval.
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
  `agent-handoffs/m42-source-followups.md` and `m44-evictions.md`; Codex sent no
  requests and did not resolve DCA, BPU, water-inventory or DOE LEAD gaps. The owner's
  new FCC/CostQuest inquiries are recorded below, separately from those earlier gaps.

Claude should reconcile ROADMAP/TODO/ARCHITECTURE and the milestone status after
review, noting county-only/manual FCC delivery and limited crime geography. The canonical
documents and DIRECTOR_NOTES were left untouched. Their existing “Now”/milestone
status may need reconciliation; this handoff is not authoritative documentation.

### Owner-sent outreach — October 7, 2026

These were sent by the owner, not by Codex. Both are awaiting replies; no license
approval or institutional refusal has been received. No passwords, security answers
or API tokens are recorded here.

| Inquiry | Recipient / route | Questions and gate |
|---|---|---|
| FCC Public Data API terms | BDC Help Center “Get Help” form; category Other | Whether prior written permission for public statements is limited to security incidents or also covers ordinary website/GitHub descriptions; what FIPS 199/NIST controls or assessments a small read-only public-data downloader must satisfy. API acceptance and authenticated automation remain paused. |
| Fabric eligibility and publication | `NBFsupport@costquest.com`; subject “Fabric licensing for public broadband availability summaries” | Whether independent noncommercial public-policy research can qualify for Tier 4 Research; whether derived municipality/ZIP summaries may be published without exposing raw Fabric records; whether university affiliation would provide a path if required. No application, signed license or Fabric download yet. |

The owner reviewed the API agreement presented during setup. It permits integrations
that retrieve/display/analyze data, but also includes a broadly worded public-statements
permission clause in its breach paragraph, security warranties with FIPS/NIST references,
audit/incident-reporting provisions, indemnification and a prominent nonendorsement
notice for public applications. These are unresolved API-contract obligations, not
a finding that public availability summaries are paid or barred from our use.
Recheck the current agreement when a reply arrives; do not silently resolve its
ambiguities in our favor. Any API implementation needs explicit approval after that
review, secure credentials, documented limits, and the specified public notice.

FCC's other-entity Fabric guidance lists challenge/crowdsource use under the Standard
license and additionally noncommercial academic/public-policy broadband research
under the Research license. Public guidance does not expressly require a university,
but independent eligibility and permission to publish our proposed outputs are not
established. A partner's license would not automatically license this website.
Sources: [Fabric access](https://help.bdc.fcc.gov/hc/en-us/articles/10419121200923-How-Entities-Can-Access-the-Location-Fabric),
[Fabric FAQ](https://help.bdc.fcc.gov/hc/en-us/articles/7412732399003-Fabric-FAQs).

Both questions are external-response gates for optional follow-ups. Neither blocks
the existing manual state/county summary import or release verification for this PR.
Absent a response timetable, roughly two weeks is a suggested follow-up interval,
not an agency promise. No reminder or additional outreach was scheduled/sent here.

## Verification

Initial delivery commands and results (before the approved FCC follow-up):

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

**Initial delivery limitation, subsequently closed for the local test gate:** two
initial unfiltered runs entered expensive slow analytics/publish fixtures and were
interrupted; database locks cleared and the normal suite passed afterward. That
normal suite and Next export alone did not exercise the full gate. The completed
unfiltered rerun below now covers fresh analytics rebuilds and a full temporary
artifact publish. Production-configured build/deploy and `check-live` are still
unperformed.

### Approved FCC follow-up — October 7

- `.venv/bin/hip check-config`: **44 configured sources**, 147 metrics; passed.
- Real `hip acquire --source fcc_bdc`, `hip land --source fcc_bdc`: public summary
  ZIP acquired, 66 validated NJ records landed. `hip stage --select
  'stg_fcc_bdc_records community_contracts'`: model and contract passed. No other
  source was re-downloaded and no national per-location CSV was imported.
- Scoped source/release registration and exact-hash `load_community`: **12,210**
  records loaded, including 66 FCC summaries. First scoped attempt lacked the newly
  used source registry row and rolled back on its foreign key; repeated with the
  same source-upsert step the normal loader uses and succeeded. No workaround to
  constraints or changes to housing facts.
- Restarted only the task's existing localhost API. Real HTTP responses: Somerset
  has three summary records; Princeton has explicitly labelled Mercer county
  context; ZIP 08540 has `not_matched` and no county substitute.
- `.venv/bin/pytest -m 'not slow' -o addopts='' -q
  --junitxml=/tmp/m47-fcc-pytests-final.xml`: **1,089 passed, 1 skipped,
  9 deselected**, 36.14 seconds; same existing no-margin skip. Includes archive,
  geography, dates, denominator, share, duplicate, missing-county, cached-vintage,
  loader-schema and API-context regressions.
- Ruff check and formatting passed (**217 files**); mypy passed (**150 sources**).
  Frontend typecheck passed; **499 tests / 67 files** passed. Final Next build
  exported **2,378 pages**; local artifact URL warning remains, not production-ready
  deployment configuration.
- `A11Y_PATHS='/regions/12,/regions/224,/regions/3091,/regions/194'
  A11Y_OUTPUT=/tmp/m47-fcc-accessibility.json npm run check:a11y`: **32 sampled states**,
  zero automated violations, overflow or page errors. Manual contrast review still
  needed; no real-device/conformance claim.
- `hip completeness --write`: saved `reports/completeness/2026-10-07-2.md`;
  **41 used sources**, 20 current, 20 not tracked, 1 unreachable; 20 public-domain
  sources. FCC is not tracked, not automatically declared current. Ancillary
  coverage remains separately audited above, not included in the fact-only tables.
- Canonical documents and Director Notes remain untouched. No merge, deploy,
  model-reading regeneration, source email, raw pruning or Fabric acquisition.

### Final full gate and outreach record — October 7

- `.venv/bin/pytest -q -o addopts='' -rs --durations=15
  --junitxml=/tmp/m47-full-test-gate.xml`: **1,098 passed, 1 skipped**, no slow
  deselections, in **976.34 seconds (16m 16s)**. The only skip is the existing
  “every rent carries a margin” case. This exercises the full Python suite selected
  by `make test-all`; the Make target itself was not invoked.
- The shared analytics fixture rebuilt the local warehouse twice and passed all
  four release/packet-hash/idempotency checks; setup took 422.43 seconds. The full
  publish fixture took 485.83 seconds and wrote to pytest's temporary directory,
  not the production artifact tree. No model readings were regenerated.
- Export manifest: **16,782 artifacts**, **820,331,389 bytes**, **4,339 expected
  404 skips**. The publish tests passed their byte-identity, manifest integrity,
  file-existence and allowed-404 checks. A separate read-only verification checked
  the SHA-256 and byte length of **every** manifest artifact.
- Six M47 artifact responses were additionally compared byte-for-byte with local
  API responses: Somerset, Princeton and ZIP 08540 community files, and all three
  CDC health inventories. Somerset has three records for `county:34035`, Princeton
  three explicitly labelled Mercer county records (`county:34021`), and ZIP 08540
  is `not_matched` with no county substitute. Health inventories contain
  63 / 6,507 / 1,761 records respectively.
- Re-ran frontend `npm test` (**499 passed / 67 files**) and `npm run typecheck`;
  both passed. Re-ran Ruff check, formatting (**217 files**), mypy (**150 sources**)
  and `git diff --check`; all passed. The prior FCC-follow-up Next export and
  accessibility results above were not re-run for this handoff-only update.
- Recorded both owner-sent inquiries, their open questions and approval gates.
  No authenticated FCC API calls, credential generation, Fabric application or
  acquisition, source email, canonical-document edits, raw pruning, merge or deploy.

**Local test gate is closed; production rollout is not performed.** Production
publication/configuration and `check-live` still belong to the reviewed deployment
workflow. Public downloads solved county acquisition; they did not implement
unattended refreshes or municipality/ZIP availability. Replies to the two inquiries
are gates for optional follow-ups, not blockers for this manual-summary delivery.
