# New Jersey splash page and map experiment

## Review refinement: map and continuous profile

- Removed the two introductory sentences, retaining the map/budget links.
- Replaced the statewide paged banner with `StateProfileTicker.tsx`: a continuous CSS-transform loop (42 seconds for the current three metrics), pause button, hover pause, keyboard-accessible original facts, offscreen/hidden-page pause, and static wrapping for reduced motion/print. The visual duplicate is hidden from assistive technology and contains no focusable controls. Pause or keyboard focus exposes the original facts in a scrollable strip. County banners remain unchanged.
- Replaced white map seams/selection outline with fine blue-black borders, shaded raised walls, a cooler backdrop, frosted white-on-dark view badge, and a distinct blue county-entry button. Metric fill colors and their legend remain unchanged. Blur is limited to the small view badge, not the full map.
- County click/tap now uses geographic hit testing, with a separate raised-top hit test so the lifted county wins over the county below it. Movement exceeding six screen pixels is treated as dragging, not clicking. Existing keyboard-accessible county-entry button remains available. This navigation is atlas-only.
- Updated the browser check for continuous movement, hover/pause, reduced-motion readability, and raised-county tap navigation. Production checks passed with no browser errors and no horizontal overflow at 375/768/1440px. Rise probe remains 96 attribute reads. 207 tests, typecheck, and production build passed; the same local artifact-URL warning remains. Reviewed light, dark, and mobile screenshots. Human frame-time gate remains open.

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
- `web/lib/stateProfile.ts`, `web/lib/stateProfile.test.ts`: presentation adapter and three tests.
- `web/scripts/check-nj-redesign.mjs`: repeatable headless browser checks and a narrowly scoped DOM-work counter.

## Architectural or implementation decisions

- No dependencies, data sources, calculations, ranking definitions, or canonical documentation changed.
- Atlas appearance is opt-in; the affordability page retains classic map presentation. Shared rendering/gesture fixes apply to both map consumers.
- Reused existing profile primitives rather than introducing a second carousel implementation. Kept complete definitions in the existing floating definition interaction.
- Scoped landing styles to the NJ page. County, municipality, ZIP, and report layouts are not redesigned.
- Branch `experiment/nj-splash-map` started from `origin/main`, not the unrelated local check-live branch.

## Assumptions

- This is an experimental review, not approval to merge or deploy.
- Existing published statewide observations are the source of truth. PEP population is preferred, with the existing ACS fallback.
- The app's restrained data-instrument aesthetic and visible source caveats remain appropriate for the splash page.

## New TODOs / limitations

- The visible, human-operated production performance gate remains outstanding. Review `/?perf` and `/afford?perf` with the documented drag/zoom sequence before claiming lag is resolved. Automated work counts are not frame-time measurements.
- In the same 900 ms isolated county-rise probe, the development baseline made 5,280 path attribute reads versus 96 after the change. The production preview also recorded 96. This measures eliminated DOM inspection, not a claimed percentage improvement in overall speed.
- Local build warns that `NEXT_PUBLIC_ARTIFACT_URL` is unset and download links use localhost:8000. This preview is not a deployment artifact.
- Local production preview is served at localhost:3001 using a temporary static server outside the repository. Nothing is deployed.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test`: 25 files, 207 tests passed, including three new statewide profile tests.
- `cd web && npm run build`: passed; 2,276 static pages generated, with the local artifact-URL warning described above.
- `cd web && CHECK_URL=http://localhost:3001 CHECK_LABEL=production node scripts/check-nj-redesign.mjs`: passed; no browser page errors. Checked 375/768/1440 px document widths; profile paging, definition bounds, text bounds, measure shortcut, municipality zoom, drag commit, reset, dark mode, and county/affordability regression routes.
- Inspected production desktop, mobile, and dark-mode screenshots.
- `git diff --check`: passed.
- Backend tests not run: backend and data pipeline unchanged. No deployment or merge performed.
