# Landing-page data scale

## What changed
- Final count reconciliation: exhibit now shows 48 **Source datasets** from the same external-source catalogue as the footer, rather than 42 dated-record sources. Removed the footer’s closed-state “All 48 datasets” text while retaining the expansion chevron and open-state Hide cue, freeing room for institution names.
- Follow-up: lead with 3,480,497 distinct parcel identifiers and 1,398,840 SR1A property sales records, alongside sources and places. Metric observations move into definitions when landed property data is available; original three-count layout remains when it is absent.
- Four columns on desktop, two-by-two on mobile. Small count captions no longer inherit numeric letter spacing.
- Added a compact Behind the picture exhibit between place search/map and national benchmarks.
- Three exact build-derived counts: sources with loaded dated records, warehouse metric observations and public NJ county/municipality/ZIP pages with data.
- Decorative source/record/place tapestry with subtle CSS flow; figures do not animate. Definitions and source-history links available on demand.

## Files/modules affected
- Build-only Python/Node property-count scripts, propertyScale server reader, npm prebuild hook and gitignore for generated aggregate JSON; synthetic aggregation test.
- Landing page, DataScale component/style, dataScale helper/tests, browser diagnostic.

## Architectural or implementation decisions
- Supersedes the earlier dated-source filter below: headline sources now count distinct external `/sources` catalogue entries, excluding `hip_derived`; supporting boundaries, directories and uncertainty datasets count too. The definition explicitly distinguishes datasets from institutions. Freshness is no longer needed for the exhibit fetch.
- Property counts are generated on every `npm run build` from `HIP_DATA_DIR` (default repo data), using project Python/DuckDB. `HIP_PYTHON` can select the interpreter. No new API endpoint or privacy-sensitive exports; only counts and archive labels leave the landed tier.
- Parcels: distinct nonblank trimmed PAMS_PIN from current MOD-IV composite. 3,481,240 geometry rows become 3,480,497 parcel identifiers. This includes nonresidential/unmatched parcels, not just properties supported by lookup pages.
- SR1A: distinct county/district/serial/assessment-year tuples across currently landed archive files. All 1,398,840 rows have unique keys and nonnull key fields. Count includes unusable/non-market records. Do not call these deed documents or ordinary home sales.
- Visible archive labels 2020–2026 YTD refer to sales-ratio years, not calendar-year date coverage. Actual recorded-date extrema are 2018-01-10 to 2026-06-30 with out-of-period/corrected records in later archives; these extrema are deliberately not represented as uniform coverage.
- Generated aggregate JSON is ignored, not hard-coded or committed. Missing parquet clears stale counts and omits the property pair; malformed data or a missing Python/DuckDB runtime fails prebuild rather than silently reuse stale figures. Local `npm run dev` needs the count script run explicitly to regenerate these totals.
- Reuse existing read-only metrics/freshness/region APIs; no backend, new analytics service or browser data fetching.
- Freshness counts require observed dates, excluding unfetched sources and undated map layers. Metric observations include loaded geographies and calculated measures, not unique homes or independent measurements.
- NJ place count intersects has-data regions with supported geography levels and pinned public routes; excludes the state landing page and unknown addresses.
- Omit the exhibit on unavailable/invalid counts rather than display invented zeroes. Do not sum raw release row counts, which may overlap across releases.
- Illustration is explicitly schematic, not one mark per record or actual record-level lineage; reduced-motion users see static artwork.

## Assumptions
- Search remains the primary landing-page interaction; detailed geographic coverage currently starts in New Jersey.
- Proposed Director Note remains unwritten; approved implementation direction documented here, not promoted to canonical docs.

## New TODOs / limitations
- Counts are a build snapshot, not live counters. Sources/observations/place counts have different scopes; definitions say so.
- Does not quantify total raw records processed or bytes acquired; no defensible deduplicated denominator available from these APIs.
- No representation of complete measure coverage for every place. No canonical document edits.

## Verification
- Source reconciliation: typecheck and five affected tests passed. Test covers supporting datasets, duplicate IDs and exclusion of internal calculated metrics.
- Reconciliation full suite: 654 tests passed; static build passed (2,386 pages). Six browser theme/size cases passed with count 48, no repeated footer dataset total, visible source names, axe/overflow/reduced motion checks. `git diff --check` passed.
- Follow-up synthetic aggregation test (`.venv/bin/python web/scripts/test_property_counts.py`) passed: repeated parcel IDs, blank/null IDs, repeated transaction keys, distinct districts, archive labels and missing-data stale-count removal.
- Follow-up typecheck and five affected frontend tests passed. Static build passed with the prebuild aggregate step, 2,386 pages / 16,695 files.
- Follow-up full frontend suite: 654 tests across 104 files passed; `git diff --check` passed.
- Follow-up six browser cases passed (320/390/1280, light/dark): counts 3,480,497 / 1,398,840 / 42 / 1,183, axe, horizontal overflow, reduced motion. Dark mobile screenshot inspected.
- Local API inspection: 42 dated-record sources and 964,486 metric observations before build; live values verified by browser diagnostic below.
- Type checking passed. Full frontend suite: 653 tests across 104 files passed; after the accessibility markup correction, the four affected tests passed again (`npm test -- DataScale dataScale`).
- `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed, 2,386 static pages, 16,695 exported files. Preview adapter is local-only, not a deployment configuration change.
- `node scripts/check-data-scale.mjs`: passed at 320, 390 and 1280 pixels in light/dark modes; exact counts 42 / 964,486 / 1,183, no horizontal overflow, reduced-motion artwork static, definitions accessible, no exhibit axe violations.
- Initial browser check identified invalid definition-list nesting; moved explanatory text inside each definition before rebuilding and rerunning successfully.
- Visually inspected dark mobile and light desktop screenshots. `git diff --check` passed.
- Backend tests were not run: no backend changes. No separate frontend lint command was run.
