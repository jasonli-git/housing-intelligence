# Milestone 44 — Evictions: source gate investigation

Branch: `milestone/m44-evictions`, based on `c9e3b0c` (merged M43).
Investigated 2026-10-05. **Implementation parked; M44 is not delivered.**
The owner approved this milestone branch. No inquiry was sent.

## What changed

Documentation only: verified the public source routes, distinguished accessible
dashboard metadata from an importable release, and prepared an unsent data request
and acceptance checklist. No application code, source registry, metrics, warehouse,
readings or canonical documents changed. No eviction values were acquired from the
rendered dashboard or loaded into this platform.

### The gate, item by item

| Requirement | Verified evidence | Remaining requirement |
|---|---|---|
| Underlying tables | The DCA catalogue points to a Power BI dashboard, not a downloadable table. Targeted public catalogue searches found no standalone eviction dataset. | Agency-supplied aggregate CSV/XLSX or documented, permitted bulk/API route; not screen extraction. This search does not prove no download exists. |
| Data dictionary | Read the live dictionary through the dashboard's ordinary UI. Definitions and origin agencies are present. | Exportable schema, counting rules, exclusions, missing/suppressed/zero semantics, and correction of the inconsistent year labels below. |
| Update calendar | DCA's announcement says annual updates. | Actual release schedule, measurement-year basis, publication date and revision policy. Annual frequency is not a release calendar. |
| Reuse terms | General NJ State information reuse provisions exist; catalogue item has no source-specific licence or attribution fields. | Confirm application of the terms to AOC-origin aggregates and permission for display, redistributed downloads, derived statistics, automated refresh and any required notices. Blank metadata is not a prohibition. |

### Currentness: the previous 2024 endpoint is stale

The [August 27, 2025 announcement](https://www.nj.gov/dca/news/news/2025/20250827.shtml)
describes ZIP-level filings and warrants for 2022–2024, a dictionary tab, AOC as a
contributing source, and annual updates.

The **live introduction inspected on 2026-10-05 advertises 2022–2025**. The dictionary
likewise lists 2022–2025 for filings, but still lists 2022–2024 for warrants and
2020–2024 for the warrant-to-filing ratio. Its rate denominator is the ACS 2020–2024
five-year estimate of renter-occupied units (DP04). Those are observed labels, not
validated raw-release vintages. Do not assume all measures reach 2025, that 2025 is a
complete calendar year, or that a ratio is cohort-matched.

The [dashboard](https://app.powerbigov.us/view?r=eyJrIjoiMzFkMzVkNjUtMGRmYy00MzExLTg2NTktMDQ3ODQ2MTZkMTlhIiwidCI6IjUwNzZjM2QxLTM4MDItNGI5Zi1iMzZhLWUwYTQxYmQ2NDJhNyJ9)
opened successfully in the in-app browser. The web text-fetch tool returned an empty
shell; that is a tooling limitation, **not** evidence that the dashboard is unavailable.
Only introduction/dictionary metadata was inspected. No quantitative eviction tables
were transcribed, exported, scraped or queried through internal Power BI endpoints.

### Public catalogue evidence

[DCA Data Hub](https://datahub.dca.nj.gov/) identifies itself as an open-data discovery
site. Its public ArcGIS site item is `d0ff7d72ca5b42ada5a1a3ec49223618`, owner
`NJDCA.GIS`, organisation `Aur8tCo478N3VovT`.

The [Municipal Housing Profile catalogue item](https://www.arcgis.com/home/item.html?id=8b735c290a984fec92c1d8f994fccbc2)
is a `Document Link` owned by `NJDCA.GIS`. Public item metadata gives the same dashboard
URL; `description`, `licenseInfo` and `accessInformation` are null. Its item modification
timestamp is not a measurement/publication date for the dashboard's underlying data.

Public ArcGIS search for the exact dashboard title returned one item. An org-restricted
search for eviction or warrant-of-removal returned that link and the HMIS dashboard
link, not a downloadable eviction table. These were targeted discovery queries, not
an exhaustive inventory of every agency-held file or proof of absence.

### Reuse: neither assume prohibition nor declare blanket clearance

[NJ Conditions of Use](https://www.nj.gov/nj/legal.shtml), section F, generally permits
copying/distributing State information subject to particular restrictions and other
rights. It also warns that department-specific policies can apply. This is supportive
evidence, not a source-specific decision about the dashboard's court aggregates or
downstream redistribution. The roadmap explicitly requires DCA's supplied reuse terms.
No confidential or identifiable court records, names, street addresses, court-case
lookups, seals or agency-logo reuse are needed or proposed.

## Files/modules affected

- `agent-handoffs/m44-evictions.md` only.
- Future integration would touch source/metric configuration, acquisition and discovery,
  normalized staging/loading, provenance/coverage, packet/API contracts, definitions,
  ZIP presentation and tests. None were scaffolded before the gate was satisfied.

## Architectural or implementation decisions

- Park the feature rather than inventing a source adapter around undocumented dashboard
  internals. M45 is next in sequence **only if the owner authorizes starting it**.
- A filing is a court event, not an eviction or a distinct household. A warrant is an
  order, not evidence that a physical removal occurred. Official court guidance also
  distinguishes the stages: [judgment and warrant explanation](https://www.njcourts.gov/faq/what-happens-if-landlord-obtains-a-judgment-possession).
- Aggregate ZIP information must not silently become town/county measurements. Determine
  whether codes describe the rental property, defendant mailing address, court location,
  postal ZIPs or Census ZCTAs, including cross-boundary handling, before any mapping.
- Rates are events per rental units, not a person's probability of eviction. Carry the
  denominator's ACS period, margin/uncertainty and geography alongside the numerator.
- A same-year warrants/filings ratio is not automatically the fraction of that year's
  cases ending in removal; warrants can follow earlier filings. Do not publish it as
  a conversion rate without an explicitly linked case cohort and methodology.
- Preserve raw release identity, observation period, publication/access date, revisions,
  missing/suppression codes and coverage. No partial-year annualization, model estimates,
  household deduplication guess, zero filling or cross-ZIP redistribution.

## Assumptions

- The existing roadmap gate remains binding; public dashboard visibility alone does not
  satisfy it. No agency files or correspondence supplying the missing materials were
  found in the checked repository paths. Files outside the project were not searched.
- An agency reply or documented public bulk release can unlock the gate. Lack of a
  verified download today is an access/methodology gap, not proof the source doesn't exist.
- The director note's data-source/partnership/freshness objectives are addressed by this
  investigation and request draft, not promoted into new requirements or unrelated work.

## New TODOs / limitations

### Actionable now, without implementing the gated feature

1. Owner can send the request below, or provide existing DCA/AOC files and correspondence.
2. A person can inspect ordinary dashboard download options if DCA identifies one;
   retain file identity and terms rather than treating a screenshot as a release.
3. Claude can reconcile the roadmap/source register with the verified gate outcome and
   the live dashboard's advertised 2025 coverage. No canonical edits were made here.

### Requires publisher response or verified release materials

Bulk access; counting/deduplication rules; suppression/coverage; geographic definitions;
year-label discrepancies; release calendar; allowed downstream uses. Code cannot settle
these through inference. A dictionary tab exists, but does not resolve all these questions.

### Separate avenues, not implemented or substitutes

- NJ Courts public statistics may supply county/court-level landlord–tenant totals, but
  are not automatically the requested ZIP series. The statistics and landlord–tenant
  pages returned 403 to the web tool; no access bypass attempted. User browser inspection
  or an AOC referral remains possible.
- Eviction assistance links are useful but do not deliver M44's statistics. DCA's official
  [Eviction Guide](https://nj.gov/dca/dhcr/offices/evictionguide.shtml) is a possible future
  contextual link; no extra frontend feature was added to disguise the parked milestone.
- M42 institutional gaps, unrelated dependency patches and stale-reading regeneration
  remain out of scope. No model calls or broad cleanup were bundled into this branch.

### Unsent request draft

Suggested recipient: Christopher Wheeler, Chief Data Officer, DCA.
`christopher.wheeler@dca.nj.gov` is published in DCA's
[April 30, 2025 presentation, printed slide 22](https://nj.gov/dca/dhcr/offices/pdf/NPP/NPP%20Coordinator%20Meeting%20Slides%20-%20April%202025.pdf).
That establishes a public professional contact, not confirmed 2026 inbox availability.
Ask for referral to the dashboard/AOC data steward if appropriate.

**Subject: Municipal Housing Profile — ZIP-level eviction aggregates and reuse details**

Hello Dr. Wheeler,

I'm building Housing Intelligence, a free New Jersey housing-information website with
no subscription or ads. I'd like to show clearly sourced aggregate eviction filings
and warrants by ZIP, while making clear that filings are not evictions and warrants
are not executed removals. We do not seek identifiable case or tenant records.

Could DCA provide the underlying aggregate tables used by the Municipal Housing
Profile Dashboard, preferably CSV/XLSX or a documented public download/API, with:

- Available years, whether 2025 is complete, publication dates and release identifiers.
- A data dictionary: counting unit, repeat filings, residential/commercial coverage,
  cancellations, missing/suppressed values, and whether executed removals are recorded.
- ZIP geography and address basis, with any crosswalk and unmatched-code policy.
- Definitions/periods for rental-unit denominators and any published ratios.
- Update schedule, revision policy and a stable discovery/download route.
- Applicable reuse terms and attribution for public display, downloadable copies,
  derived statistics and automated refresh; any AOC-specific restrictions.

The live introduction/filing definition now refers to 2022–2025, while warrant entries
still cite 2022–2024 and the ratio cites 2020–2024. Could you clarify the intended
coverage? If another office supplies the tables, a referral would be appreciated.

Thank you,
Jason Li

### Acceptance checklist before code resumes

Obtain all four gate materials; confirm the file's coverage/year basis and rights;
retain exact payload and checksum; test unique counting keys and repeat events;
verify statewide totals only against genuinely comparable agency totals; test leading
zero ZIPs, unknown/suppressed values and missing years; verify any ZIP-to-ZCTA match;
show source/period/caveats next to figures; withhold unsupported ratios; then build the
adapter and frontend with actual-file regression tests. Do not require a new email if
a documented, permitted public release already supplies these answers.

## Verification

- `git status --short`: clean before branch creation. Initial sandbox Git-ref write
  failed; approved branch creation succeeded with filesystem access. No work carried.
- Read ROADMAP M44/source-register row, TODO, relevant director-note section, existing
  data-completeness and M42 handoffs, source/metric config and completeness command.
- Official DCA announcement, State use notice, public catalogue metadata and published
  contact checked live. Dashboard introduction/dictionary inspected through ordinary UI.
- Public ArcGIS metadata requests succeeded; exact-title search returned one item and
  org-restricted eviction/warrant search returned two dashboard links.
- `.venv/bin/hip completeness`: passed against local Postgres, read-only. Summary:
  137 metrics; 113 reach towns, 74 at least 95%; 34 sources, 17 current, 16 not tracked,
  1 unreachable; 11/17 fixed questions answered. No new eviction metrics or coverage.
  Existing FastAPI/Starlette test-client deprecation warning appeared; no repair attempted.
- No full pipeline, acquisition, model generation, frontend/backend suite or build run:
  this is a documentation-only gate investigation, not an implemented data milestone.
- `git diff --check`: run before commit. No outreach sent, merge or deployment performed.
