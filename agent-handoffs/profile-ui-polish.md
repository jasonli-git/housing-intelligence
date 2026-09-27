# Profile UI polish

## What changed

- Compressed the always-visible non-commercial notice into a slimmer line while keeping its native, keyboard-accessible details disclosure and full terms.
- Increased the state and local profile conveyor speed by exactly 5%. Local profile ranks now sit in a separate low-profile chin beneath each metric's value, label, and plain-language context. The rank still names its peer cohort and retains its full screen-reader wording.
- Let long uncertainty-range rankings wrap within the narrow “Where … stands out” cards.
- Grouped the freshness and revision links in one Source history card in the footer. A follow-up gave each destination a short question and explanatory line in a compact inset link, so their purposes are easier to distinguish.
- Disabled and greyed the affordability toggle on both source-history pages, including their API-unavailable states.
- Added pointer dragging to the state and local profile conveyors. Dragging preserves their loop and resumes from the dropped position; paused banners can be dragged as a horizontal scroller, and reduced-motion layout remains static.
- Narrowed local profile cells from 280 to 248 px on desktop and from 220 to 205 px on phones. Uncertainty ranges now sit in muted text beside the metric value rather than taking a separate line.
- Shortened the introductory copy on both source-history pages. The freshness page now separates the data period from the last check in two sentences; the revisions page states only what the comparison shows.
- Split the freshness list into tables by publisher cadence. Only represented schedules render, with attention-needed statuses first within each group.
- Replaced the separate population card with a slim badge beside the page-type label on state, county, and municipality headers. The count and estimate period stay in the badge. Pages with no population figure show no badge.
- Moved the region population's five-year percentage into that badge. Removed the context-free “no sampling error · up …” line beneath county and town titles. The estimate definition now explains why a county figure can have no sampling error while still being an estimate; town sampling margins and change margins remain available there too.
- Rewrote all 20 currently published New Jersey map-measure explanations as short, plain-language descriptions, scoped to the map so profile/report definitions are unchanged. The selected change window now appears as a blue badge immediately below the measure title.
- Gave the desktop header search enough fixed width for its full placeholder. Marked the three New Jersey agency sources in the freshness table with the state-page blue, and moved status definitions from a repeated bottom legend onto focusable status labels whose cards open outside the table scroller.

## Files/modules affected

- `web/components/StateProfileTicker.tsx` — conveyor timing, rank placement, and pointer dragging.
- `web/components/SourceFooter.tsx` — shared source-history navigation.
- `web/app/redesign.css` — notice, population, profile chin, county title, ticker widths, and footer styles.
- `web/app/globals.css` — standout rank wrapping and cadence headings.
- `web/app/freshness/page.tsx` and `web/app/changes/page.tsx` — disabled affordability control and shorter introductions; freshness tables grouped by cadence.
- `web/lib/freshness.ts` and `web/lib/freshness.test.ts` — cadence grouping and regression tests.
- `web/app/regions/[id]/page.tsx` — population change in the badge, with sampling context in its definition instead of an unlabeled title-side line.
- `web/app/page.tsx` and `web/app/regions/[id]/page.tsx` — population badge placement and retained context.
- `web/components/CountyExplorer.tsx` and `web/lib/mapDefinitions.ts` — map-only plain-language definitions and window badge placement.
- `web/lib/mapDefinitions.test.ts` — coverage of the 20 published map measures and fallback behavior.
- `web/app/tokens.css` and `web/app/new-jersey.css` — shared state blue and New Jersey header/map styling.

## Architectural or implementation decisions

- Interpreted “chin” as a shallow, full-width bottom band on each ranked profile metric. Statewide metrics have no peer rank, so their banner retains its existing metric layout.
- Used the existing typed rank and `RankText` component; the visual rank adds a small “Rank” label, while the full “Rank N of M counties/municipalities” wording remains available to assistive technology.
- Kept both footer destinations outside the Sources disclosure so either remains directly reachable.
- The banner's CSS conveyor remains the autoplay mechanism. On pointer-down, the visible transform is frozen; pointer movement updates that offset, and release converts it to an animation delay so motion continues without jumping back to the start. A small movement threshold preserves ordinary metric-definition clicks.
- The affordability control on source-history pages uses the existing disabled variant, not a new one-off style. The destinations contain source metadata, not local affordability results.
- Freshness grouping uses the publisher's `cadence`, not the site's weekly checking interval. The current data yields Monthly, Quarterly, and Yearly tables; no empty Weekly table is shown. The heading says frequency, not schedule, because some monthly sources have no dated release to watch. Unknown future cadences retain their own labelled group rather than disappearing.
- Population is now part of the identity line, not a corner overlay. The 2024/2025 estimate term keeps its definition in a viewport-clamped floating card. On region pages, its five-year change is visible beside the count; sampling information is in that same badge's definition instead of floating under the page title. “No sampling error” describes the Census's method, not perfect accuracy.
- The map uses its own concise wording; the shared metric dictionary remains the fuller explanation for other contexts. An unfamiliar new map measure falls back to that shared definition.
- Freshness status labels use the existing floating-definition component. Its portal avoids the horizontal table's clipping, and its placement clamps to the phone viewport. The bottom legend was removed to avoid saying the same thing twice. New Jersey agency rows are identified by the current `nj_` source IDs, verified against the local API.

## Assumptions

- This work covers the interactive state, county, municipality, and ZIP page shell. The separate printable report layout is unchanged.
- A compact disclosure line is preferable to moving the commercial-use warning into the navigation, where its terms could be less clear or harder to print.
- “Every range” was interpreted as uncertainty ranges in the shared profile banner. Tables and reports retain their established uncertainty layout.
- The population badge was implemented only after explicit follow-up approval. Count, period, and change remain visible; uncertainty is available in the estimate definition. The badge does not alter a source value or calculation.

## New TODOs / limitations

- The build's existing `NEXT_PUBLIC_ARTIFACT_URL` warning remains: report Markdown links point to localhost when the deployment origin is not configured.

## Verification

- `cd web && npm run typecheck` — passed.
- `cd web && npm test -- --run` — 32 files, 276 tests passed.
- `cd web && CHECK_URL=http://localhost:3000 CHECK_LABEL=ui-fixes node scripts/check-nj-redesign.mjs` — passed; no browser errors or horizontal overflow at 375, 768, or 1440 px. The first run against `127.0.0.1` timed out before assertions because Next dev blocked that origin's hot-reload resource; `localhost`, the configured dev origin, passed.
- Focused headless measurements of the state, Somerset County, and Aberdeen municipality pages at 375, 768, and 1440 px — population text, standout ranks, rank chin, footer card, and page width all fit. The state ticker duration was 40 s versus 42 s before; local duration was 80 s versus 84 s before.
- Thirty county title/card checks across Somerset, Burlington, Gloucester, Cumberland, and Atlantic at 375, 400, 480, 520, 700, and 701 px — passed with no title/card overlap or page overflow.
- `cd web && npm run build` — passed, 2,278 static pages. The first sandboxed attempt could not reach the local API; the authorized run with the API and database available passed.
- `git diff --check` — passed.
- Visually inspected light-mode phone screenshots of the population corner, profile chin, and unified footer card. The existing broad browser check also exercised dark mode.
- Follow-up: `cd web && npm run typecheck` — passed; `npm test` — 32 files, 276 tests passed; `git diff --check` — passed.
- Follow-up: headless Chromium loaded `/`, `/regions/12`, `/freshness`, and `/changes`; both source-history routes reported the toggle disabled. A pointer drag on the Somerset banner moved the track and left a nonzero resume delay; the two updated cards were inspected at 1440 and 390 px, with no document overflow at 390 px.
- Follow-up: `cd web && npm run build` — passed, 2,278 static pages. The existing unset-`NEXT_PUBLIC_ARTIFACT_URL` warning remains. The local frontend preview was restarted after the build.
- Source-history follow-up: `cd web && npm run typecheck` — passed; `npm test` — 32 files, 278 tests passed; `git diff --check` — passed.
- Source-history follow-up: headless Chromium at 390 and 1440 px found Monthly (5), Quarterly (2), and Yearly (9) groups, 16 rows total, and no document overflow. The revised intro appeared on `/changes`.
- Source-history follow-up: `cd web && npm run build` — passed, 2,278 static pages; the existing unset-`NEXT_PUBLIC_ARTIFACT_URL` warning remains.
- Population/map/freshness follow-up: `cd web && npm run typecheck` — passed; `npm test` — 33 files, 280 tests passed; `git diff --check` — passed.
- Population/map/freshness follow-up: headless Chromium found no page overflow at 390, 800, 900, 1024, or 1440 px. State, county, and municipality badges stayed above their titles; the sampled ZIP had no population figure and showed no badge. The search placeholder fit at 761–1440 px. All 20 published map options showed a concise definition and the change-window badge.
- Population/map/freshness follow-up: phone taps opened the state and county population definitions and the first/last freshness status definitions inside the viewport. State-source blue resolved to its light and dark variants.
- Population/map/freshness follow-up: `cd web && npm run build` — passed, 2,278 static pages; the existing unset-`NEXT_PUBLIC_ARTIFACT_URL` warning remains.
- Population clarity follow-up: `cd web && npm run typecheck` — passed; `npm test` — 33 files, 280 tests passed; `git diff --check` — passed.
- Population clarity follow-up: headless Chromium checked Somerset County and Absecon municipality at 320, 375, 390, 768, and 1440 px. The badge remained 28 px tall with the five-year change inside, no population detail appeared beneath the title, no page overflow occurred, and both definition cards fit the viewport.
- Population clarity follow-up: `cd web && npm run build` — passed, 2,278 static pages; the existing unset-`NEXT_PUBLIC_ARTIFACT_URL` warning remains.
