# Affordable housing and assistance — Milestone 41

## What changed

Implemented the owner's explicit assignment of Milestone 41 on
`feature/affordable-housing-assistance`, starting from `eaedc9e` (PR #90).
No canonical project document was changed. This handoff records the implementation,
source audit and remaining gaps for Claude's reconciliation; it is not a replacement
for the roadmap or an assertion that every affordable home is covered.

Three answers remain distinct:

1. DCA's **non-binding** fourth-round need calculations, not final judicial obligations.
2. Municipal project and trust-fund self-reports, not fourth-round compliance.
3. Official application routes and a searchable property inventory, not live vacancies,
   open waiting lists or an eligibility determination.

Added public-source acquisition, selective XLSX landing, dbt staging, four unranked
metrics, migration `0024`, an ancillary inventory loader, a read-only API and static
publication paths. County and town pages place housing help alongside the existing
household income check. New Jersey puts it in the statewide evidence expansion.
ZIP pages offer the application routes but do not invent a ZIP property allocation.

The UI has programme, address/name/town and reported-expiry filters; ten records per
page; retry on a failed request; source/snapshot citations; bedroom counts where
reported; and separate HUD contracts matched by exact property ID. The full inventory
loads only when its disclosure opens.

### Measured local coverage, 2026-10-04

| Record set | Rows | Important limit |
|---|---:|---|
| Fourth-round calculations | 564 | Non-binding, October 2024 |
| Municipal projects | 7,896 | Records in 489 of 564 towns; 6,702 unknown CO statuses |
| Trust-fund rows | 564 | Only 383 report a fund balance |
| HUD assisted properties | 677 | August 7, 2026 snapshot; county geography |
| HUD matched contracts | 684 | Separate from property units; contracts may renew |
| LIHTC bulk project records | 1,760 | Declared coverage through 2024; historical, not current availability |

12,145 inventory records loaded. Four new metrics total 1,837 observations; the local
validated warehouse has 864,585 observations overall. State sums are 65,410 present
need, 80,798 capped prospective need, 30,974 units in projects reported completed,
and $648,601,046.36 in reported trust balances. These are **not** a supply-gap equation
or a combined inventory total.

## Files/modules affected

- `config/sources.yml`, `config/metrics.yml`: sources, verified terms, four metrics.
- `src/hip/sources/{xlsx,nj_affordable,hud_assistance}.py`: source readers/discovery.
- Source registry/base, tabular landing and CLI: normal pipeline integration.
- `dbt/models/staging/stg_*affordable*.sql`, HUD inventory models,
  `affordable_housing.yml`, `dbt/tests/lihtc_copy_vintage.sql`: staging and guards.
- `src/hip/warehouse/load.py`, migration `0024`, freshness: cited inventories and dates.
- `src/hip/api/routers/affordable_housing.py`, API registration, `publish.py`: responses
  and static artifacts.
- `web/components/AffordableHousing.tsx`, CSS, region/state pages, API/types,
  definitions, kinds and groups: presentation and lazy loading.
- Python/source/loader/API tests, frontend helper tests and existing publish/revision
  tests: verification.
- `reports/completeness/2026-10-04*.md`: standing checks before and after recording
  the new source discovery dates. The `-2` report is the later one.

## Architectural or implementation decisions

### Source and licence audit

All three additions cost $0 and require no credentials or new dependencies.

- **NJ DCA:** [municipal reporting downloads](https://www.nj.gov/dca/dlps/hss/MuniStatusReporting.shtml),
  [fourth-round workbook](https://www.nj.gov/dca/dlps/pdf/FourthRoundCalculation_Workbook.xlsx).
  [NJ site terms, section F](https://www.nj.gov/nj/legal.shtml) permit copying and
  distributing State information unless marked otherwise. No separate restriction was
  found on these offered workbooks. Discovery follows the newest dated reporting link.
  Need uses the workbook's **Q capped column**, not its uncapped L column.
- **HUD assisted housing:** [official monthly property/contract downloads](https://www.hud.gov/hud-partners/multifamily-assist-section8-database).
  Federal administrative data offered for public use, with a completeness/warranty
  disclaimer. Discovery reads the publisher's declared snapshot; it is not the date
  this platform downloaded the files. Only selected property/program fields land.
- **HUD LIHTC:** [official bulk release page](https://www.huduser.gov/portal/datasets/lihtc/property.html)
  advertises data through 2024. Its ZIP returned a bot-check HTML response to automated
  download, so no protection was bypassed. The initial historical public-map fallback
  was replaced after the owner downloaded the official ZIP. Its actual contents include
  `LIHTCPUB.xlsx`, unlike the CSV named on the webpage. The supplied April 2026 dictionary
  confirms the 1987–2024 release, 55,345 national project records. No Access dependency
  is needed. The imported XLSX SHA-256 starts `fd0b1775793b` and is cited as vintage 2024.
- **NHPD:** [terms](https://preservationdatabase.org/terms-and-conditions/) and
  [data licence application](https://preservationdatabase.org/data-license-application/)
  require a signed licence for redistribution. Not registered, signed or acquired.
  The public UI explicitly says it is not held.

Application routes were reviewed October 4: [NJ Housing Resource Center](https://www.nj.gov/njhrc/),
[DCA voucher instructions](https://www.nj.gov/dca/dhcr/offices/vouchers.shtml), and
[HUD's NJ housing-authority directory](https://www.hud.gov/sites/dfiles/PIH/documents/PHA_Contact_Report_NJ.pdf).
Readers must confirm availability, service area and enrolment with the administrator.

### Missingness, geography and chronology

- Municipal-code crosswalks and exact Census GEOIDs, never mailing-city guesses.
  The newer LIHTC workbook has no MCD field: 1,124 rows resolve via unique Census BPS
  place-to-MCD relationships and the current municipality spine; 591 remain county-only
  and 45 state-only. Mailing cities, coordinates without accuracy flags, and CDP names
  are not town matches. One HUD property with an invalid county and its contract remain at
  state scope. None are silently discarded or assigned to a neighbouring town.
- Missing submissions/units/statuses remain null, not zero or "incomplete".
  Negative reported fund balances survive. No programme totals are added together:
  inventories overlap, including repeated LIHTC financing.
- The municipal workbook names different fund dates: caption **2026-03-06**, metadata
  cutoff **2026-02-16**. Both are parsed and shown, not reconciled by guessing.
- Real source error: Deptford project `22878` reports CO granted but gives a CO date
  of **2103-10-01**. Preserve both source fields; exclude its four units from the
  completed summary and explain why in the property result. No other date is invented.
- LIHTC restriction expiry is never inferred from service year plus 15/30 years.
  DCA's date is the earliest reported controls end, potentially only some units.
  HUD's date is a contract end, not necessarily the property's affordability end.
  Filtering is explicitly within five years **of each source snapshot**, not a claim
  about the reader's current date. Renewal is possible.
- Disability targeting and special-needs counts are not physical-accessibility
  certifications. No access feature is asserted where the source supplies none.

### Storage, attribution and performance

- Stdlib XML/ZIP XLSX reader streams sparse rows, reads only cached formula results
  and refuses a 1904-date-system workbook rather than shifting all dates.
- Whole source inventories replace atomically in one transaction. Empty/unmapped or
  negative-unit inputs abort; missing staged sources retain previous records.
- Attribution resolves this run's exact content hash, source, layer and vintage;
  never the latest fetched row for a mutable URL. Tests demonstrate rollback and
  correct credit with two registered versions of one URL.
- `prune-raw` now protects releases cited by these records as well as facts/revisions.
  No raw deletion was performed.
- HUD raw offered workbooks contain owner/agent columns. They remain only in the local,
  ignored raw cache; none of those personal fields land or are exposed/committed.
  LIHTC landing selects programme/property fields, never personal contacts.
- State overview is **4,442 bytes**, at most six provenance rows. Full NJ inventory is
  **6,674,123 bytes uncompressed**, downloaded on demand. Large state searches still
  use this full browser-side file; server-side search/chunking is not implemented.
- Static artifacts: `/regions/{id}/affordable-housing.json` and
  `/regions/{id}/affordable-housing/overview.json`. Live API uses the extensionless
  endpoint and `?overview=true`. No request-time production backend is introduced.
- Acquired payload sizes: roughly 44.7 MB DCA counting the shared municipal workbook
  under both layers, 15.7 MB HUD assisted, and 13.0 MB LIHTC bulk XLSX. Revalidation returned 304
  for DCA need and both HUD assisted files; municipal workbooks re-downloaded unchanged.

### Related TODO / Director Note audit

Completed two explicitly relevant TODOs without editing TODO.md:

1. HUD AMI / four-person 80% limit now have wide validation bounds ($5,000–$500,000).
2. Frontend grouping test reads the real YAML metric catalog rather than a copied list.
   It exposed missing `pep_population` classification, now fixed.

Also fixed a pre-existing revision test revealed by verification: doubling a fixture
value of zero created no revision; adding one now actually exercises the guarantee.

This advances the Director Note's free public-source coverage, refresh/provenance,
licensing and ordinary-reader next steps. It does **not** turn its exploratory ideas
into requirements. No forecasts, temporal mode, AI relationship narration, new paid
vendor, bill-generation change or institutional outreach was added. HUD effective-date
dating and broader map/a11y work remain separate tasks.

## Assumptions

- Approval assigned this official milestone to Codex as an exception to its usual role;
  canonical reconciliation remains with Claude.
- Official current administrator links are useful without pretending their waiting
  lists were checked or their programmes can accept this particular household today.
- Source self-reports can be useful when their partial coverage and dates travel with
  them, but cannot establish a town's legal compliance or a property's current vacancy.
- Local source acquisition/migration/load/build are authorised implementation checks.
  Deployment, merging, subscribing and signing data licences were not authorised.

## New TODOs / limitations

- LIHTC manual bulk import is now supported. Automatic release-page discovery is
  implemented and tested, but the real HUD User page currently returns an empty HTTP
  202 to the application's client. This remains `unreachable` in freshness, not a
  claim of current coverage. No bot-check evasion or automatic browser downloading.
- The supplied `LIHTCPUB_BIN.xlsx` has 8,646 NJ building/address rows for 1,638 project
  IDs. It is not imported: these are not additional projects, and adding addresses
  requires a second independently cited layer. No building or unit totals are inferred.
- Obtain final court-approved fourth-round obligations if the product should answer
  the legal obligation question. DCA calculations alone cannot do that.
- Municipal reporting is incomplete and contains chronology errors. A verified
  per-town reporting ledger and direct administrator data would be a separate follow-up.
- No verified live vacancies, property application URLs, waiting-list-open statuses or
  physical accessibility features are held. Official directories are the next step,
  not a substitute for those facts.
- NHPD awaits an owner-approved licence; no implicit permission is assumed.
- Full state inventory is ~6 MB uncompressed. Consider per-programme chunks if measured
  mobile use warrants it, without losing the overlap/coverage caveats.
- The existing completeness report's licence-text table conservatively marks some
  `Open public record` uses unverified even though this source's terms/config have been
  checked. Its global legacy judgement was not changed for every public-record source.
- Four new snapshot metrics can change packets and make readings stale. No readings
  were regenerated or billed. Review freshness separately before deploying.
- Apply migration 0024 and acquire/land/stage/geocode/validate/load before building on
  another machine; then publish both JSON shapes. A previously running local artifact
  server lacking the new files returns 404 until publication is refreshed.
- Claude should reconcile milestone/version/TODO documentation after reviewing the
  diff; no tag, release, merge or deploy was performed by this task.

## Verification

### Bulk integration follow-up (owner approved, October 4)

- `hip acquire --source hud_lihtc`, `hip land --source hud_lihtc`,
  `hip stage --select stg_hud_lihtc_records`, `hip load`: imported 1,760 NJ records;
  all five selected dbt tests passed; 12,145 total inventory records loaded. Existing
  metric observations remain 864,585, with zero withdrawals. No readings regenerated.
- API verification: one exact LIHTC release ID (37518 locally), coverage end
  2024-12-31, 747 `no_longer_monitored=true`; 126 service years in 2021–2024,
  five in 2025 labelled after coverage, 20 unconfirmed and 109 confirmed/year unknown.
  Missing monitoring status is unknown, not active. No expiry is inferred from the
  five reported 45-year periods, and repeated financing is not new construction.
- New tests cover programme-only extraction, header drift, duplicate IDs, missing
  numeric '.', truthful discovery of completed coverage, blocked probes, distinct
  manual filenames, offline provenance after explicit-year acquisition, selection
  of only the latest bulk vintage, ambiguous place/MCD relationships, CDP refusal,
  county/state fallback, and displayed monitoring/service-year caveats.
- Complete non-slow Python suite: **967 passed, 1 skipped, 9 deselected**. The same
  pre-existing analytics uncertainty skip remains. Local-warehouse API/loader tests
  passed with database access, rather than being skipped under network restrictions.
- `ruff check .`, `ruff format --check .`: passed (251 formatted Python files).
  `mypy src/hip`: 130 source files passed. `npm test`: **431 passed**, 49 files.
  `npm run typecheck`: passed; production static build exported **2,379 pages**.
  Build warned that localhost artifact URLs are preview-only; not a deployed build.
- Live automated HUD page probe: HTTP 202, empty body. Recorded as unreachable;
  the hand-downloaded file still lands and loads. No claim that release discovery
  can currently replace a human's annual check.
- Headless localhost checks at 390px and 1280px: Somerset's LIHTC filter returns
  46 matching records, ten rows show 2024 bulk coverage, no horizontal overflow and
  no browser page errors. Mobile screenshot inspected. No deploy, merge, raw pruning
  or canonical-document edit.

### Future LIHTC update procedure

1. Manually check the [official release page](https://www.huduser.gov/portal/datasets/lihtc/property.html)
   each spring while automated discovery is blocked. HUD currently announces 2025
   data collection in fall 2026 and publication in spring 2027; no exact date is given.
2. Download the offered ZIP and verify its dictionary's coverage year, not its ZIP
   timestamp or the largest service-year cell. Keep the dictionary with the download.
3. Copy only the property workbook to `data/manual/hud_lihtc/LIHTCPUB_<year>.xlsx`.
   For example, the next verified release would be `LIHTCPUB_2025.xlsx`.
4. Run `PYTHONPATH=src .venv/bin/python -m hip.cli acquire --source hud_lihtc --vintage 2025`
   after verifying that year. Explicit vintage avoids the blocked page check, without
   forging a successful discovery. Subsequent ordinary adapters retain the newest
   cached bulk vintage; a discovered-but-missing newer release still fails visibly.
5. Run normal land/stage/validate/load and review the header/geography/status guards
   before publishing. A changed format or dictionary needs review, not a renamed old
   workbook. Never update coverage to the maximum year found in a service-year cell.

The raw/manual workbook stays outside Git. Any separate machine running the refresh
pipeline must receive the same owner-downloaded file (or its immutable acquired cache)
before activating this version; pushing the code does not transfer that data.

### Download cleanup note (October 4, 2026)

The owner reports deleting `~/Downloads/lihtcpub` after integration. The property
workbook remains in `data/manual/hud_lihtc/LIHTCPUB_2024.xlsx` and its content-addressed
`data/raw/hud_lihtc/` cache; pipeline runs do not depend on the deleted folder.
The accompanying data dictionary PDF, building-address workbook and Access database
were inspected/listed but not archived into the project. If needed for further source
review or building-address integration, download the official HUD ZIP again. The
coverage, field interpretations and inspected counts are recorded in this handoff;
a future ZIP may contain a newer release, so verify its dictionary before use.

If HUD's page becomes machine-readable, the existing scheduled refresh can discover
newer completed coverage and its acquire log will request the correctly year-named
file. This change does not add email/push notifications or a scheduled reminder.

### Original milestone verification (before bulk follow-up)

- Real acquisition/landing for all three sources; normal discovery/revalidation checked
  for DCA/HUD assisted. Local migration 0024 and `hip load`: 11,645 inventory records.
- `hip stage --select 'stg_nj_affordable_records stg_nj_affordable stg_hud_assisted_records stg_hud_lihtc_records'`:
  four models and 13 data tests passed. Additional LIHTC vintage guard: passed (14 distinct
  new data tests total).
- `hip geocode`, `hip validate`: 864,585 observations passed; 144 existing geography
  rejects recorded, not guessed away. `hip analyze`: completed without new ranking use
  of the four assistance metrics.
- `hip check-config`: 31 sources, 137 metrics, passed.
- `pytest -m 'not slow' -o addopts='' -q -rs`: **962 passed, 1 skipped, 9 deselected**.
  Skip: `tests/test_analytics.py:224`, all loaded rents already carry margins.
- `ruff check .`, `ruff format --check .`: passed, 250 formatted files checked.
  `mypy`: passed, 132 source files.
- `npm test`: **429 passed**, 48 files. `npm run typecheck`: passed.
  `npm run build`: 2,379 static pages successfully exported.
- Read-only API checks verify citations, ZIP refusal, overview/full consistency and
  freshness: HUD assisted ends 2026-08-07, LIHTC ends 2020-12-31, not download day.
- Playwright localhost checks: county/state deep links, dark/light and 390px mobile;
  no horizontal overflow or final hydration errors. Inventory load, programme/expiry
  filters, pagination, empty search and failed-request retry exercised. The old local
  artifact server lacked these new JSON files, so browser test interception supplied
  the **real local API response** for that path; no live-source data was mocked.
- `pytest tests/test_publish.py -m slow -o addopts='' -q`: **4 passed**, 16 deselected,
  in 611.97 seconds. Full artifact publication used a temporary directory, with API
  byte-identity, manifest hashes, file existence and legitimate 404 skips checked.
- `pytest tests/test_nj_tax_rates.py -m slow -o addopts='' -q`: **1 passed**, 7 deselected.
- `git diff --check`: passed. Diff against main confirms all six protected canonical
  documents are unchanged.
- Nine slow tests were initially deselected; the four analytics double-rebuild tests
  were not run. No `make test-all`, deployed `check-live`, paid model run or `prune-raw --apply`.
