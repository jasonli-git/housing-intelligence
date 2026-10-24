# Housing Atlas experiment

## What changed
- Added `/atlas`, a dedicated New Jersey county map/comparison workspace, separate from Find your fit and the state overview.
- Eight starter measures: Zillow single-family home value and asking rent, ACS household income/gross rent/home value/renter burden, population estimates, and residential permits. Only measures with published county records appear.
- Shared latest/change selectors drive both the shaded map and the county table. Map or table selection highlights the same county and offers its canonical place-page link.
- Pan, zoom, reset, keyboard controls, desktop panel resizing and a compact mobile table drawer.
- Added Atlas to the shared Tools menu, home tool cards and sitemap. Expanded the compact-menu breakpoint to 1150px to accommodate the extra link without crowding the search.

## Files/modules affected
- `web/app/atlas/page.tsx`, `atlas.css`, `counties.json/route.ts`
- `web/components/HousingAtlas.tsx`, `Masthead.tsx`
- `web/lib/housingAtlas.ts` and tests
- Home page/tool styling, sitemap, shared responsive navigation styling
- `web/scripts/check-housing-atlas.mjs`

## Architectural or implementation decisions
- Reuse existing packed geometry, globe projection, measure/ranking types, formatters, uncertainty labels and canonical routes. Preserved retired comparison components remain intact; NJ comparison stays disabled.
- Geometry is a separate static JSON asset, fetched once by the browser, avoiding repeated RSC coordinate payloads. County figures are embedded at build time; no browser analytics API calls, map vendor, new source or account.
- Latest values and county-specific dates come from observations, not a metric catalog date or historical change endpoint. Date variation is disclosed and shown per row where relevant.
- Change rows are limited to verified NJ county IDs and the most common matching start/end date pair for the selected window. No silent fallback from unavailable change to latest: unsupported options are disabled; choosing a new measure without that window visibly resets the selector to Latest.
- Five neutral sequential shades use equal-width value intervals over the selected county minimum/maximum. Higher is not labelled better. Missing/incomparable values are hatched and remain in the table, never replaced by zero.
- Existing source terms, licence disclosure and publisher notices remain. Census TIGER/Line boundary source confirmed from the existing adapter; source homepage and definition accompany each measure.

## Assumptions
- First prototype is NJ counties only. Municipal/ZIP coverage and additional states require a later scoped design/data review.
- Task follows the approved `experiment/housing-atlas` branch and repository PR completion workflow; no merge/deployment authorized.

## New TODOs / limitations
- No municipal/ZIP layers, address search, road tiles, satellite imagery or composite place score.
- Filter/selection state is not yet encoded in shareable URLs. Touch pinch zoom and a gesture-draggable mobile sheet are not implemented; zoom buttons and Show table provide explicit alternatives.
- Build-time latest observation reads add work across 21 counties × eight measures. Geometry remains lightweight/lazy; consider a batch published atlas artifact if coverage expands.
- Rankings API caps results at 1,000. NJ records are filtered explicitly, but nationwide expansion should introduce a state-filtered ranking endpoint rather than rely on the cap.
- Pan is unconstrained; Reset recovers the state view. Physical Safari/mobile-device testing unavailable.
- Initial build failed because local API was stopped; started read-only API and static preview. Early browser checks found raw county labels without “County”, ambiguous implicit select labels, legend ARIA semantics and selected-link contrast; corrected before final checks.

## Verification
- `npm run typecheck`: passed; final production build also checked TypeScript.
- `npm test`: 662 tests / 106 files passed, including six new pure tests for missing/zero/non-finite values, latest-vs-change separation, unsupported windows and neutral scale behavior.
- Final `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed; 2,388 pages / 16,704 exported files, below 20,000 cap. Guide adapter override is local-only.
- `node scripts/check-housing-atlas.mjs`: six width/theme cases (390/900/1280 × light/dark) plus aborted-geometry fallback passed. Verified all 21 shapes/rows, map/table synchronization, actual county hit areas and pointer-drag pan, keyboard pan without page scrolling, zoom/reset, desktop resize, measure/change synchronization, source disclosure, axe, reflow, no runtime errors, actual place navigation.
- `node scripts/check-shared-navigation.mjs`: all 12 existing page/width cases passed; state comparison remains retired and shared notice/navigation behavior intact.
- Viewed mobile light and desktop dark screenshots. `git diff --check` passed.
- Backend tests not run: no backend changes. No standalone lint script exists in web/package.json.
