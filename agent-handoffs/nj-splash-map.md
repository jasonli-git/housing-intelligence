# New Jersey splash page and map experiment

## PR #33 review fixes

- Restored the cost panel's essential quote boundary without restoring the paragraph the director asked to remove: `Calculated estimate · not a lender quote` now sits directly beneath the ownership figure in interactive and report views. The shared computed-data badge continues to carry the separate not-AI explanation.
- Replaced the JavaScript-only affordability button with a real link whenever affordability is available. Ordinary clicks still switch the New Jersey/county workspace in place; modifier, middle, pre-hydration and no-JavaScript activation follow the durable `/afford` route. County fallbacks include `?place=<county id>`. ZIP profiles retain an explicitly disabled button. The route's capability is now passed as a typed `Masthead` prop rather than rediscovered from DOM attributes.
- Consolidated the three copied URL/event mode listeners into `useHousingMode`, backed by `useSyncExternalStore`. A head script marks direct `?mode=afford` loads before first paint, hiding the static-export state workspace until hydration supplies the matching affordability tree. State and county mode controllers now share this one subscription.
- Changed the map lift so a new entity still rises from the surface, while a measure change over the same entity eases from its current height to the new target instead of resetting to zero. Browser coverage pins both behaviors.
- Made keyboard focus expose the ticker's unclipped static strip and scroll the focused metric into view. Explicit Play still resumes motion immediately while its control is focused; focusing an actual metric prioritizes readability.
- Split projected map geometry from measure scale/color work. World land is now atlas-only; classic `/afford` neither projects nor warms it. Ground/world and detail use separate paint effects, so hover, mute, ramp and custom-paint changes no longer scan the ground layer.
- Moved normalized rank position into `lib/ranks.ts`, reused it in verdicts, ledger tracks and rank plots, and replaced the profile ticker's ordinal-string regex with a typed `{ words, rank }` context. The ticker now renders its badge through the shared `RankText` primitive.
- Canonical-document reconciliation requested by the review remains with Claude under the repository working agreement; no canonical document was modified in these fixes.

## Review refinement: shared header, cost copy and footer polish

- Re-anchored the shared `Computed from the data · not AI` definition to the badge's left edge. Its existing width cap remains, so the definition now stays inside both desktop and mobile viewports instead of extending beyond the page when the badge sits beneath a left-aligned title.
- Removed the redundant “Computed from the figures shown by fixed rules; not a quote, and not written by AI” sentence from both interactive and report-style cost breakdowns. The shared title badge, source detail, calculation inputs, omissions and other methodology copy remain intact.
- Recast the generic `Report` button as an explicit `Open full report` document destination with a document icon and `Print-ready detail` cue. It now sits independently at the lower-right of the region header, allowing the population card to align with the shell's actual right edge while preserving the mobile stacked layout.
- Modernized the shared page ending without changing its information or behavior: Sources is now a restrained provenance disclosure card, expanded institutions become small source cards, and Notice is a separate quiet licensing panel. The source names, restricted-data tag, dataset links, update cadence, terms, external Notice link, native disclosure behavior and print expansion all remain.
- Extended browser QA to assert definition bounds, population alignment, the document action, absence of the removed cost sentence, refreshed footer treatment, and working source expand/collapse behavior.

## Review refinement: unified profiles, contained cards and added rank plots

- Replaced the separate paged municipality/ZIP profile with the same continuous `ProfileTicker` used by New Jersey and counties, then removed the obsolete `HousingBand` implementation and its CSS. State remains blue; every local profile keeps the established green treatment, shared compact height, pause/play behavior, definitions, reduced-motion behavior and print fallback.
- Pulled local profile ranks out of the small prose line into a quiet explicit badge: `13/21 COUNTIES`, `87/564 MUNICIPALITIES`, or the equivalent current cohort. The nearby plain-language cue such as “older than most” remains, and the accessible label reads the full “Rank 13 of 21 counties.” Statewide metrics correctly carry no invented ranks.
- Prevented long stand-out values and source details from exceeding their narrow cards by bounding every child, reducing the value type slightly, and allowing emergency wrapping for genuinely long unbroken content. The card dimensions, three shelves, colors and autoplay are unchanged.
- Added two non-line charts at the top of the existing expansion: five-year change rank and current-value rank. Each grouped dot plot visualizes every ranked measure from the tables below on a normalized rank-1-to-last axis, preserves each metric’s actual cohort in its tooltip/accessible label, and explicitly warns that rank 1 follows the metric’s direction rather than always meaning “better.” No tables or analytical calculations changed.
- Updated the expansion summary’s chart count and browser coverage for card containment, shared county/municipality tickers, named rank denominators, both rank plots and responsive overflow.

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
- `web/components/StateProfileTicker.tsx`: one shared continuous state/local profile ticker, including explicit local rank-cohort badges. The superseded `web/components/HousingBand.tsx` was removed.
- `web/components/CountyExplorer.tsx`: measure shortcuts, comparison heading, atlas opt-in.
- `web/components/GlobeMap.tsx`: optional atlas presentation and shared paint/gesture lifecycle improvements.
- `web/app/map.json/route.ts`, `web/lib/mapdata.ts`, `web/lib/globe.ts`: optional municipality parent-county identity used by reverse map navigation.
- `web/components/HousingModeToggle.tsx`, `web/components/StateModeWorkspace.tsx`, `web/components/CountyModeWorkspace.tsx`, `web/components/AffordExplorer.tsx`, `web/lib/afford.ts`, `web/lib/affordData.ts`: state/county mode navigation, scoped workspaces, shared affordability payload, and grouped results.
- `web/app/regions/[id]/page.tsx`, `web/app/page.tsx`, `web/components/ComputedBadge.tsx`, `web/components/StateProfileTicker.tsx`, `web/app/redesign.css`: shared title provenance, county profile conveyor, local mode composition, shared transitions, and fixed play/pause presentation.
- `web/lib/worldLand.ts`, `web/lib/world-land.json`: documented, static Natural Earth world backdrop.
- `web/lib/stateProfile.ts`, `web/lib/stateProfile.test.ts`: presentation adapter and three tests.
- `web/components/RankOverview.tsx`, `web/lib/rankOverview.test.ts`: two accessible normalized rank plots and rank-position coverage.
- `web/components/CostToOwn.tsx`, `web/components/SourceFooter.tsx`: streamlined cost evidence and the refreshed shared provenance/licensing footer.
- `web/components/HousingModeToggle.tsx`, `web/components/useHousingMode.ts`, `web/lib/housingMode.ts`, route pages and `web/app/not-found.tsx`: typed, link-safe affordability capabilities and shared URL mode state while preserving common masthead/licence coverage.
- `web/lib/ranks.ts`, `web/lib/verdict.ts`, `web/components/Ledger.tsx`, `web/components/StateProfileTicker.tsx`: shared rank positioning and typed profile context.
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

- Claude still needs to decide and perform any canonical `ARCHITECTURE.md` / `CHANGELOG.md` reconciliation before merge; Codex did not alter canonical documentation.
- The visible, human-operated production performance gate remains outstanding. Review `/?perf` and `/afford?perf` with the documented drag/zoom sequence before claiming lag is resolved. Automated work counts are not frame-time measurements.
- In the same 900 ms isolated county-rise probe, the development baseline made 5,280 path attribute reads versus 63 after the PR review fixes. This measures eliminated DOM inspection, not a claimed percentage improvement in overall speed.
- Local build warns that `NEXT_PUBLIC_ARTIFACT_URL` is unset and download links use localhost:8000. This preview is not a deployment artifact.
- Local interactive preview is available at localhost:3000. Nothing is deployed.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test -- --run`: 28 files, 213 tests passed, including housing-mode URL derivation, normalized rank positions, municipality-parent preservation, three statewide profile tests and one world-coverage test.
- `cd web && npm run build`: passed with local-API access; 2,276 static pages generated, with the local artifact-URL warning described above. The first sandboxed attempt could not reach the already-running API at localhost:8000 and was rerun with localhost access.
- `cd web && CHECK_URL=http://localhost:3000 CHECK_LABEL=review-fixes node scripts/check-nj-redesign.mjs`: passed; no browser page errors. Checked 375/768/1440 px document widths plus link-safe state/county/municipality/report controls, disabled ZIP behavior, direct affordability URL pre-paint state, keyboard-visible ticker facts, the concise quote disclaimer in interactive/report views, non-resetting measure-change lift, zero ground-path reads on a measure change, atlas-only world land, and every earlier responsive/map/profile/footer interaction. The isolated rise probe recorded 63 SVG attribute reads.
- Inspected production desktop, mobile, and dark-mode screenshots plus the revised county header, open definition and collapsed Sources/Notice footer in the local browser.
- `git diff --check`: passed.
- Backend tests not run: backend and data pipeline unchanged. No deployment or merge performed.
