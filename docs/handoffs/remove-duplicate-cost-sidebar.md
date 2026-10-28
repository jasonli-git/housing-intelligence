# Remove duplicated cost sidebar

## What changed

Completed the first finishing-touch priority: removed Princeton's Housing, at a glance panel beside Costs. The existing context-dependent layout automatically makes the monthly cost card full width. Current-value comparisons remain in About this place; other place pages keep their original context panels.

## Files/modules affected

- Place page's context gate and revision props.
- `PlaceComparisonRail` and its CSS, plus a new revision-preservation test.
- `placeComparisons` measure selection and tests.
- Comparison browser regression harness.

## Architectural or implementation decisions

Review found two unique pieces of information that were not duplicates: revision notices, and the property-record home-age basis. Preserve existing revision labels/links alongside the matching comparison measure, outside its main report link to avoid nested anchors. Use the existing period-matched profile revision metadata.

The removed sidebar uses `modiv_median_year_built` (1958 in current Princeton records), while the original rail used `acs_median_year_built` (1965). The rail now prefers the property-record metric, clearly labeled NJ property records with its year; ACS remains a labeled fallback only when parcel age is absent. Both figures remain in the full report. No arithmetic/ranking/source data was changed, and property records are not labeled as survey estimates. This supersedes the earlier handoff's all-ACS preview selection.

## Assumptions

Approval applies to the stated first priority, removing the duplicate sidebar. Metadata readability, click-affordance refinements and broader rollout remain recommendations. Existing local-only experimental branch, no push/deploy or canonical-doc changes.

## New TODOs / limitations

The rail's source may be administrative for home age and survey-based for the other measures; retain those labels. One source's median is not a replacement for the other in the warehouse/report. No new data ingestion or backend changes.

## Verification

- TypeScript passed.
- All 849 web tests in 145 files passed. New tests preserve a supplied revision/changes link, exclude unrelated notices, prefer parcel home age and use the survey fallback only if parcel age is absent.
- Final comparison harness and production-export results appended on completion.
- Additional cost-layout checks cover full available width, edited price/reset, mortgage-rate expansion, retained property-record age and revision link, overflow and scoped axe in 390/1440px light/dark views.
- A custom assertion assumed an old revision's exact rounded text; replaced it with a notice/link check. The notice itself comes from unchanged formatter/profile metadata, not a new hard-coded value.
- Revision links remain separately tabbable. Restricted the rail's Arrow/Home/End navigation to the main measure links, rather than inadvertently treating revision links as additional measures. The regression initially exposed that edge-state mismatch; corrected the selector and reran.
- Final `check-place-comparisons.mjs` passed all eight width/theme cases, including uniform main-section gaps, shared rail arrows, comparison/back navigation, preserved content, no overflow and scoped axe. Nonpilot Hoboken retained its original context/layout.
- Additional 390/1440px light/dark layout checks passed full-width costs, edited-price/reset arithmetic, mortgage-rate table expansion, property-record age/source and revision-link preservation; visually inspected desktop cost and comparison captures.
- Final scoped production export passed (1,188 routes). `git diff --check` passed. No backend suite/warehouse rebuild was needed or run.
