# Atlas and exhibit copy cleanup

## What changed
- Removed the duplicate Homes added and removed exhibit from place pages and retired its rendering in LocalEvidenceCharts. Are we adding homes—or losing them remains, including its construction chart, annual figures and coverage/source details.
- Omit the building exhibit frame when no construction series exists; ZIP 07030 previously showed an empty decorated card.
- Tightened the shared construction summary and gallery introduction; counts, periods, reporting limits and sources remain.
- Shortened Atlas catalogue headings, state coverage notice and scale explanation. Removed repeated generic shading instructions beside the definition; the measure-specific legend remains.
- Reordered place exhibits into related pairs: sales/history, paychecks/financing, migration/building, commute/job destinations, ground/water/flooding, and utilities/broadband. State ordering was already grouped and is unchanged.

## Files/modules affected
- `web/app/[state]/[place]/page.tsx`
- `web/components/LocalEvidenceCharts.tsx` and its unit test
- `web/components/HomesAdded.tsx`
- `web/components/ExhibitCharts.tsx` and its construction caveat regression test
- `web/components/ExhibitGallery.tsx`
- `web/components/HousingAtlas.tsx`
- `web/scripts/check-place-exhibits.mjs`

## Architectural or implementation decisions
- This is a presentation pass, not a change in construction methodology or datasets.
- Annual completions/demolitions/net figures remain in HomesAdded; the redundant second chart is removed.
- Preserved the deleted chart's distinct reporting-basis caveat in ConstructionExhibit: county/state net counts towns reporting both measures, so aggregate displayed totals need not subtract. Municipality net retains the subtraction explanation. No data calculation changed.
- LocalEvidenceCharts keeps legacy input props compatible but only renders job geography; a legacy building invocation returns null.
- No dense CSS placement or masonry that changes visual versus keyboard reading order. Related cards are grouped in DOM order; variable-height cards can still leave some row whitespace.
- Measured Camden desktop heights to choose the first pairs: sales 512px/history 613px and paychecks 402px/financing 236px reduce those two rows by about 110px compared with sales/financing and paychecks/history. This is a local snapshot, not a guarantee for every place.
- Concision is focused on visible Atlas and shared exhibit copy, not a blanket rewrite of every website page. Definitions, uncertainty notes and source limitations remain available.
- Work remains on `experiment/housing-atlas`, updating PR #159.

## Assumptions
- State pages already contain only one building exhibit, so no state data was removed.
- Adding more exhibits is not authorized by a request for recommendations.

## New TODOs / limitations
- Next recommended Atlas work: two-place comparison on the same metric and period, with explicit dates, margins and unavailable values. Not implemented here.
- Municipal drill-down remains a later coverage/geometry task.
- Existing exhibits are sufficient for now. A future income-group housing-burden chart is worth considering only if reliable disaggregated records support it and it answers a question not already shown.
- Physical Safari/iOS checks remain outstanding.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 668 tests across 107 files passed, including retired-building-exhibit and reporting-basis caveat regressions.
- `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed, 2,388 pages / 16,704 files.
- Place exhibits: twelve county/town/ZIP × width/theme cases passed, including the final empty-frame regression. A legacy order check now allows an absent, unsupported building exhibit.
- State exhibits: six width/theme cases passed.
- Atlas navigation: six width/theme cases passed.
- Atlas measures: four width/theme cases passed.
- No backend tests run (no backend edits).
