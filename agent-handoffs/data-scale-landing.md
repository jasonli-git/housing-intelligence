# Landing-page data scale

## What changed
- Added a compact Behind the picture exhibit between place search/map and national benchmarks.
- Three exact build-derived counts: sources with loaded dated records, warehouse metric observations and public NJ county/municipality/ZIP pages with data.
- Decorative source/record/place tapestry with subtle CSS flow; figures do not animate. Definitions and source-history links available on demand.

## Files/modules affected
- Landing page, DataScale component/style, dataScale helper/tests, browser diagnostic.

## Architectural or implementation decisions
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
- Local API inspection: 42 dated-record sources and 964,486 metric observations before build; live values verified by browser diagnostic below.
- Type checking passed. Full frontend suite: 653 tests across 104 files passed; after the accessibility markup correction, the four affected tests passed again (`npm test -- DataScale dataScale`).
- `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed, 2,386 static pages, 16,695 exported files. Preview adapter is local-only, not a deployment configuration change.
- `node scripts/check-data-scale.mjs`: passed at 320, 390 and 1280 pixels in light/dark modes; exact counts 42 / 964,486 / 1,183, no horizontal overflow, reduced-motion artwork static, definitions accessible, no exhibit axe violations.
- Initial browser check identified invalid definition-list nesting; moved explanatory text inside each definition before rebuilding and rerunning successfully.
- Visually inspected dark mobile and light desktop screenshots. `git diff --check` passed.
- Backend tests were not run: no backend changes. No separate frontend lint command was run.
