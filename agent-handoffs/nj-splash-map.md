# New Jersey splash page and map experiment

## Review refinement: title hierarchy, reverse navigation and banner balance

- Stacked the shared `Computed from the data · not AI` badge beneath the New Jersey, county, municipality and ZIP title instead of letting it compete with the place name on the same line. The same definition and mobile-bounded tooltip remain.
- Added the inverse of the county-entry shortcut at municipality zoom: `Jump out of <County> County` returns the unpinned state explorer to its statewide county framing. Municipality outlines now carry their already-known parent county ID through `map.json`; this adds no lookup or geographic dependency. Pinned affordability maps intentionally omit the control.
- Reduced only the statewide affordability table's `Other counties` rows from 14px to 13px with slightly tighter vertical padding. Counties within reach remain the primary size, and county-scoped municipality tables are unchanged.
- Rebalanced both profile-banner implementations without increasing their height: continuous state/county ticker facts have equal total vertical padding shifted toward the top, and municipality/ZIP paged facts use the same lower visual placement. Existing clipping, reduced-motion and fixed-height behavior remain.
- Browser QA now verifies the badge is physically below every applicable title, the secondary affordability rows are smaller, both banner implementations have the intended vertical balance, and municipality view can jump back to county view.

## Review refinement: compact controls, provenance and local defaults

- Restored the original state workspace order: measure introduction first, the controls immediately above the map card. Replaced the four shortcut pills with one `Quick view` select beside the complete Measure select and Change segmented control, keeping a single-row desktop card rather than adding height.
- Made Play an explicit interaction override for the profile conveyor. It resumes immediately even while the pointer and keyboard focus remain over the control; leaving or blurring returns hover/focus pause behavior. The paused duplicate-group treatment no longer accidentally controls ordinary focus.
- County affordability now initializes the specific-place answer with the county the reader is already viewing. The buy and rent results are present as soon as the mode transition completes, while the local municipality comparison remains unchanged.
- ZIP profiles now mark affordability as unavailable. The shared masthead switch remains focusable for its explanation but is visually dimmed, reports `aria-disabled`, and cannot change mode or navigate. State, county and municipality behavior is unchanged.
- Added one shared `ComputedBadge` and placed it beside the main New Jersey, county, municipality and ZIP titles. Its definition covers figures, rankings, costs, profiles, summaries and maps across all four page levels, while still identifying the labelled expanded interpretation as the language-model-written exception.
- Reduced the optional visible map reticle from a 9px to a 5.5px radius and tightened its four marks and toolbar icon for more precise aiming. The geographic focus calculation itself is unchanged.
- Browser QA now checks immediate ticker movement after Play while still hovered/focused, state/county/municipality/ZIP badges, control placement, county preselection, disabled ZIP behavior, the smaller reticle and the existing responsive/map behavior.

## Review refinement: county affordability and interaction polish

- Extended the masthead affordability switch to county profiles. The county identity and profile ticker stay fixed; the material below them changes to a county-scoped affordability workspace containing only that county and its municipalities. Municipality and ZIP profiles still route the global switch to the statewide affordability experience.
- Generalized the statewide conveyor into a shared profile ticker and applied its compact continuous treatment to every county profile. State remains blue and county remains the established housing green. Fixed the pause selector so it hides only the duplicate ticker group, not the play icon's `aria-hidden` SVG.
- Moved the popular-measure shortcuts into the same control card as Measure and Change, and placed that unified card before “On the map.”
- Replaced the map probe's open-ended exponential approach with one 380 ms cubic ease from zero for each newly focused entity. The lift state is keyed by entity, so crossing a boundary cannot show the new shape at the old shape's height before continuing upward.
- Added a 190 ms page-width content transition when changing state or county modes, with no transition under reduced-motion preferences.
- Browser coverage now asserts the persistent play icon, control ordering, progressive single-stage lift, county-local affordability table, mode transitions, reduced-motion fallback, and return to the county's normal cost view.

## Review refinement: unified state and affordability modes

- Replaced the masthead affordability pill with an accessible switch. On the New Jersey page it updates `?mode=afford`, responds to browser back/forward, and swaps the workspace in place; from another page it opens the merged mode. The durable `/afford` page remains available and shares its server-side data builder with the homepage.
- Affordability takes over everything below the statewide ticker. Its income/mode/down-payment controls, specific-place search, explanation, and result summary precede the same map-and-table footprint used by the state explorer. The right side groups counties within reach first and all other counties below. Both modes render the shared `GlobeMap`; switching modes intentionally changes its question and level rather than preserving an incompatible county camera.
- The state rule and mode switch turn the existing tool orange in affordability mode. The former bottom call-to-action is removed, and the two loose map/budget links are no longer needed.
- Enlarged the county tables and removed the explanatory sentence beginning “Ranked by change…”. Coverage remains visible in the comparison header.
- Shortened the moving statewide profile to about 82px on desktop and replaced the text pause control with pause/play icons. Hover, focus, explicit pause, reduced motion, print, definitions, and assistive-technology behavior remain.
- Added a 64KB delta-packed Natural Earth 1:110m land silhouette (v4.0.0, public domain) below the existing state layer. It adds the other continents and major islands without treating them as housing-data regions or adding a runtime request. The source is documented in `worldLand.ts`.
- Shifted the default New Jersey framing 0.28 degrees south so the state lands higher in the frame, clear of the county-entry action.
- Replaced the view badge with uppercase display text over a small transparent blurred corner. The corner is the only added blur. The raised selection, seams, metric colors, and blue county-entry action are otherwise unchanged from the prior review.
- Browser verification now covers the compact/icon ticker, worldwide land, merged mode and history state, orange rule, grouped affordability table, single visible map/table footprint, mobile width, and the earlier map interactions. The production rise probe records 102 SVG attribute reads after adding the world shapes, versus the original 5,280; this is still a DOM-work count, not an FPS claim.

## Review refinement: map and continuous profile

- Removed the two introductory sentences; the later merged-mode refinement also removes the now-redundant map/budget links.
- Replaced the statewide paged banner with `StateProfileTicker.tsx`: a continuous CSS-transform loop (42 seconds for the current three metrics), pause button, hover pause, keyboard-accessible original facts, offscreen/hidden-page pause, and static wrapping for reduced motion/print. The visual duplicate is hidden from assistive technology and contains no focusable controls. Pause or keyboard focus exposes the original facts in a scrollable strip. A later review generalized this treatment to county profiles.
- Replaced white map seams/selection outline with fine blue-black borders, shaded raised walls, a cooler backdrop, frosted white-on-dark view badge, and a distinct blue county-entry button. Metric fill colors and their legend remain unchanged. Blur is limited to the small view badge, not the full map.
- County click/tap now uses geographic hit testing, with a separate raised-top hit test so the lifted county wins over the county below it. Movement exceeding six screen pixels is treated as dragging, not clicking. Existing keyboard-accessible county-entry button remains available. This navigation is atlas-only.
- Updated the browser check for continuous movement, hover/pause, reduced-motion readability, and raised-county tap navigation. Production checks passed with no browser errors and no horizontal overflow at 375/768/1440px. The last pre-world-land rise probe was 96 attribute reads. Typecheck and production build passed; the same local artifact-URL warning remains. Reviewed light, dark, and mobile screenshots. Human frame-time gate remains open.

## What changed

- Reorganized the New Jersey landing page around a compact statewide introduction, blue profile banner, separate population card, map exploration, and a next-step affordability form.
- Reused the county profile carousel, including its 12-second timing, pause/reduced-motion behavior, paging, and floating definitions. State figures retain dates and both FHFA index baselines; no state ranks are invented. Printing includes every statewide profile metric, even when the screen carousel shows only one.
- Added shortcuts for existing map measures and a clearer county/municipality comparison heading.
- Introduced a homepage-only crisp atlas appearance that retains the raised-region interaction without the duplicate blurred layer and vignette.
- Bounded the shared map's path-painting effect to geometry/style changes instead of every isolated rise frame. Flush pending movement on release, cancel animation loops on unmount, and interrupt camera flights when a drag begins.

## Files/modules affected

- `web/app/page.tsx`, `web/app/new-jersey.css`: landing composition and scoped visual treatment.
- `web/components/HousingBand.tsx`: optional title/blue tone, statewide sizing and print presentation; existing local-profile defaults retained.
- `web/components/CountyExplorer.tsx`: measure shortcuts, comparison heading, atlas opt-in.
- `web/components/GlobeMap.tsx`: optional atlas presentation and shared paint/gesture lifecycle improvements.
- `web/app/map.json/route.ts`, `web/lib/mapdata.ts`, `web/lib/globe.ts`: optional municipality parent-county identity used by reverse map navigation.
- `web/components/HousingModeToggle.tsx`, `web/components/StateModeWorkspace.tsx`, `web/components/CountyModeWorkspace.tsx`, `web/components/AffordExplorer.tsx`, `web/lib/afford.ts`, `web/lib/affordData.ts`: state/county mode navigation, scoped workspaces, shared affordability payload, and grouped results.
- `web/app/regions/[id]/page.tsx`, `web/app/page.tsx`, `web/components/ComputedBadge.tsx`, `web/components/StateProfileTicker.tsx`, `web/app/redesign.css`: shared title provenance, county profile conveyor, local mode composition, shared transitions, and fixed play/pause presentation.
- `web/lib/worldLand.ts`, `web/lib/world-land.json`: documented, static Natural Earth world backdrop.
- `web/lib/stateProfile.ts`, `web/lib/stateProfile.test.ts`: presentation adapter and three tests.
- `web/scripts/check-nj-redesign.mjs`: repeatable headless browser checks and a narrowly scoped DOM-work counter.

## Architectural or implementation decisions

- No dependencies, housing-data sources, calculations, ranking definitions, or canonical documentation changed. Natural Earth is visual context only and carries no analytical values.
- Atlas appearance is opt-in on the merged homepage modes; the durable affordability URL retains classic presentation. Shared rendering/gesture fixes and the world backdrop apply to both map consumers.
- Kept complete definitions in the existing floating definition interaction. The statewide conveyor is separate from county profile paging because its movement and accessibility fallback are intentionally different.
- Scoped the atlas redesign to the NJ page. County profiles opt into only the shared conveyor and affordability workspace; municipality, ZIP, and report layouts are not redesigned.
- Branch `experiment/nj-splash-map` started from `origin/main`, not the unrelated local check-live branch.

## Assumptions

- This is an experimental review, not approval to merge or deploy.
- Existing published statewide observations are the source of truth. PEP population is preferred, with the existing ACS fallback.
- The app's restrained data-instrument aesthetic and visible source caveats remain appropriate for the splash page.

## New TODOs / limitations

- The visible, human-operated production performance gate remains outstanding. Review `/?perf` and `/afford?perf` with the documented drag/zoom sequence before claiming lag is resolved. Automated work counts are not frame-time measurements.
- In the same 900 ms isolated county-rise probe, the development baseline made 5,280 path attribute reads versus 102 in the final production preview with worldwide land. This measures eliminated DOM inspection, not a claimed percentage improvement in overall speed.
- Local build warns that `NEXT_PUBLIC_ARTIFACT_URL` is unset and download links use localhost:8000. This preview is not a deployment artifact.
- Local interactive preview is available at localhost:3000. Nothing is deployed.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test -- --run`: 26 files, 209 tests passed, including municipality-parent preservation, three statewide profile tests and one world-coverage test.
- `cd web && npm run build`: passed with local-API access; 2,276 static pages generated, with the local artifact-URL warning described above. The first sandboxed attempt could not reach the already-running API at localhost:8000 and was rerun with localhost access.
- `cd web && CHECK_URL=http://localhost:3000 CHECK_LABEL=after node scripts/check-nj-redesign.mjs`: passed; no browser page errors. Checked 375/768/1440 px document widths; immediate ticker resume, badges stacked below state/county/municipality/ZIP titles, balanced profile content, compact secondary county rows, one-row selector placement, smaller reticle, worldwide land, state and county affordability switching, county preselection, disabled ZIP mode, reduced-motion and animated transitions, county-scoped municipality results, progressive rise, definition bounds, municipality zoom and jump-out, county tap, drag commit, reset, dark mode, and responsive regression routes.
- Inspected production desktop, mobile, and dark-mode screenshots.
- `git diff --check`: passed.
- Backend tests not run: backend and data pipeline unchanged. No deployment or merge performed.
