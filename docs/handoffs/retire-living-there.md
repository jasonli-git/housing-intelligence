# Retire Living there in the Princeton pilot

## What changed

- Removed the Princeton-only Living there disclosure and its jump-navigation entry. Other place pages retain the existing structure.
- Added a compact visible school-district check alongside Check the actual home, after the local stories gallery. Names come from the existing district association/merger helpers, with an explicit approximate-boundary/assignment caveat. Links lead to NJDOE and the district figures in the full report.
- Added Princeton's school figures and public-safety reporting table to the full report with a dedicated section, navigation entry and profile link. The report did not already contain that table. Records retain their county-chapter scope, year, completeness, source links and no-safety-verdict caveats. Supporting disclosures start open in the report so their hidden screen summaries do not conceal the records; ordinary ReaderDetails callers retain their previous default.
- Added `/stories/health-in-context`, registered in Visual stories' beneath-the-surface rail/search and the local gallery. The story's place picker uses the existing API/artifact path; selecting Princeton prominently labels Mercer County's estimates. The generic story retains a statewide view. Gallery headlines and story charts share the same derived record/snapshot mechanism.

## Files/modules affected

- Place/profile and report routes, `place-overview.module.css`.
- New `SchoolCheck` and tests; `CommunityContext`/`ReaderDetails` optional expanded behavior.
- New health story route and `healthPlaceStory` summary/tests.
- Existing story records/loaders/focus/gallery chart/library registration and capture/regression scripts.

## Architectural or implementation decisions

Reuse published community records, not new data or inferred geography. Health is model-based crude adult prevalence, not a town diagnosis, home-risk measure, safety grade or a trend across releases. Keep the individual adult population labels, measurement year, release and reported confidence intervals. Percentages are not added. Charts use a fixed 0–100% scale; real zero survives, suppressed/invalid values do not become zero. Missing/wrong-place/mixed-release records are refused; detail retains publisher suppression text. School names use `districtCards` and `districtResults` to preserve existing merger handling.

Public-safety reporting stays supporting evidence in the full report, rather than becoming a new story or summary crime ranking. Only Princeton gets the new report section in this experimental pilot. Existing pinned routes and other place layouts remain unchanged. Story access for other selected geographies uses matched published data with explicit scope and missing states.

## Assumptions

Approval covers the proposed school-check/report/health-story separation. Reuse the existing local-only branch, without push/deploy or canonical-doc changes. Generated screenshots remain ignored local artifacts.

## New TODOs / limitations

The health story's interaction is place selection; no unsupported town health measurements or cross-release comparisons were added. School performance detail remains available in the report, not a school-quality rating. No expansion of this pilot to other place pages. No live warehouse writes, ingestion or external communication.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 842 tests in 142 files passed, including new scope/year/interval/suppression/real-zero health tests and visible/missing school checks.
- Browser checks: 390/1440px light/dark; removed wrapper/duplicates, school association visible, health gallery destination and county-scope/95% intervals, visible report school/agency tables, no horizontal overflow, scoped health axe, no hydration errors. Mercer County selection loaded via artifacts; invalid selection did not substitute estimates.
- Existing capture script generated 26 selected-view covers in both themes (875,288 bytes before final caption refresh), plus library covers. Captures are local generated artifacts.
- Full gallery regression, final caption capture refresh and production export results appended after completion.
- Initial typecheck caught a malformed textual replacement in the topic loader; corrected before running the passing checks.
- Additional school-check axe passed in both themes. Report axe initially caught low-contrast source links; scoped them to the established state-blue token and reran successfully in light/dark, also verifying agency tables are visible under print media.
- The first full-gallery regression timed out on a missing visible water-cover image; direct inspection confirmed the matching captured file and loaded image, and a fresh run was started after the capture/build settled. Final outcome below.
- The older `check-place-content.mjs` still assumes the pre-pilot two-disclosure structure, including Princeton; it was already superseded for this pilot by the hierarchy/story harnesses and was not run here.
- Full `node scripts/check-place-stories.mjs` rerun passed: thirteen real covers in all four width/theme combinations, matching snapshots/headlines, story controls and source limits, retired-wrapper checks, county/ZIP selections, back/reload, invalid/missing states, library covers and nonpilot preservation. The run's console text still said twelve/retained context from the prior version; its assertions used thirteen and the new layout. Updated that stale console wording afterward.
- Refreshed health selected-view and library covers in both themes after adding the explicit fixed-scale caption; visually inspected the health chart and mobile school/checklist section.
- `npm run publication:test`: all 5 passed. No data publication or deployment.
- Final scoped production export passed: 2,372 routes including all place pages/reports and the new health story. `git diff --check` passed. No full backend suite or warehouse rebuild was needed or run.

## Follow-up: retire the separate Check a home card

Removed the standalone Check the actual home card and its section-navigation entry in the Princeton pilot. Kept the visible school-district check with one small “Checking a specific home? Open the buyer’s guide” link underneath. Preserved the old home-check fragment on that link's paragraph for existing URLs. Moved the public-safety report link beside the full-report shortcut at the bottom. Removed unused card CSS and updated the story regression harness's guide-link label. No source content or destination routes removed.

Verification: TypeScript and two SchoolCheck tests passed; 390/1440px light/dark checks verify the removed heading/navigation entry, retained school check, place-aware guide link, relocated report link, no overflow and scoped axe. No full suite/build rerun for this link/card simplification.
