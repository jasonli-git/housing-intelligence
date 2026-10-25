# Place page overview

## What changed

Place pages now open with a compact place identity, a prominent comparison action, and a persistent section navigator. Ownership and rental estimates appear before the household profile and adjustment controls. Desktop places the compact profile beside the cost cards; smaller screens follow the cards with the profile. The introductory market narrative and its supporting figures remain available in a native disclosure. Approved review refinements now group compact market exhibits explicitly, put complex evidence on full rows, quiet section labels, align the budget fields, and standardize neutral glass panels and native disclosure affordances. Per review feedback, the duplicate “Planning a purchase here?” and “Find housing help” cards below Make it yours are removed; About this place follows directly. The existing buyer-guide link within Make it yours and shared Housing help navigation remain.

The navigator links to overview, costs, market, getting around, living there, optional alternatives, and the shared source footer. On phones it becomes a labelled section picker. It tracks reading position, accounts for the sticky masthead, transfers keyboard focus, opens enclosing source disclosures, and honors reduced motion.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: shared county, municipality and ZIP composition, comparison action, navigation destinations and explicit missing-benchmark fallback.
- `web/app/place-overview.module.css`: scoped layout, compact headings, responsive profile and cost composition, print adjustments.
- `web/components/CostToOwn.tsx`: opt-in compact composition and baseline dates; existing report/tool presentation remains the default.
- `web/components/HomeSales.tsx`, `ExhibitCharts.tsx`, `IncomePressure.tsx`, `HomesAdded.tsx`, `StateContextExhibits.tsx`, `WhoIsMoving.tsx`: opt-in concise titles and supporting-copy placement.
- `web/components/PlaceSectionNav.tsx` and its CSS module: responsive navigator.
- `web/components/PlaceSectionNav.test.tsx`: destination discovery, streamed footer, disclosure opening, focus and reduced motion.
- `web/scripts/check-place-overview.mjs`: browser acceptance coverage.
- `web/scripts/check-place-content.mjs`: concise-default content, progressive disclosure, deep links, print and expanded-state accessibility.
- `web/scripts/check-place-polish.mjs`: exhibit geometry, visual hierarchy, input alignment, budget edits, disclosure keyboard behavior and WCAG coverage.
- `web/scripts/check-place-guide-focus.mjs`: maintained assertions for the mixed paired/full-width layout.

## Architectural or implementation decisions

- Reused existing calculations, source definitions, uncertainty ranges, revision marks, rate scenarios, omissions, evidence tables, downloads and planning tools. No changes to calculation formulas or data contracts.
- The compact layout is opt-in so embedded cost tools and reports retain their original composition.
- CSS is scoped through a page module. Targeted specificity and important size declarations override the existing Horizon rules, including selectors whose `:is()` specificity includes IDs.
- Source navigation discovers the footer outside main and opens its native disclosure before focusing the source heading. Sticky navigation is bounded by main and ends as the reader enters the shared footer.
- Existing deep-link target IDs are retained. A mutation observer accommodates the streamed source footer; resize/scroll updates are coalesced through animation frames.

## Assumptions

- This is the approved place-page presentation refactor, not an official milestone or a data/model change.
- County photos and town navigation remain part of place identity.
- Comparison carries the current region into the existing comparison flow.

## New TODOs / limitations

- Browser automation supplements desktop and phone-width visual inspection; it does not replace physical-device or screen-reader testing.
- The general axe best-practice scan reports an existing duplicate named landmark in the ground/water evidence. The maintained acceptance script uses the project's WCAG A/AA tags and reports those separately from best-practice advisories.
- The persistent navigator ends at the main-content boundary when navigating into the shared source footer.
- No production deployment or merge is part of this task. Canonical documents are unchanged.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 130 files, 770 tests passed.
- After final control ordering, `npm run typecheck` and `npx vitest run components/CostToOwn.test.tsx components/PlaceSectionNav.test.tsx`: passed, 14 tests.
- `npm run build`: passed, 2,430 static pages generated.
- `node scripts/check-place-overview.mjs`: production-preview checks passed for Princeton, Mercer County, ZIP 07030 and ZIP 08510 at 1440/768/390/320px. The sparse ZIP exposed a test that did not force scrolling when its target was already visible; after fixing that assertion setup, `PLACE_PATHS=/nj/zip-07311 node scripts/check-place-overview.mjs` passed at all four widths. Checks cover cost updates, comparison action, sticky navigation, source disclosure/focus/hash, overflow, console errors and WCAG A/AA axe rules. Dark mode tested at 768px; light at other widths.
- Desktop/phone visual inspection: Princeton, county photo treatment, and ZIP with no published rent. Screenshots saved to the task visualization directory.
- `git diff --check`: passed.


### Removal of duplicate next-step cards

Removed the two place-page action cards and their empty wrapper, and updated the place overview and guide-focus browser checks. No shared style rules were removed because they may support other routes. Verification passed: `npm run typecheck`, `npm run build` (2,430 static pages), `PLACE_PATHS=/nj/princeton node scripts/check-place-overview.mjs` (1440/768/390/320px; card absence, About this place, existing inputs/navigation/source focus, overflow and WCAG A/AA), and `git diff --check`. The larger cross-tool `check-place-guide-focus.mjs` script was updated but not rerun in full. Visual inspection confirmed the direct transition, saved as `place-action-cards-removed.png` in the task visualization directory.


### Approved layout refinements

- Added two explicit compact exhibit groups: sales/history and paychecks/financing. When a group has one exhibit it occupies the row. Complex exhibits use full rows; on smaller screens all groups follow DOM reading order in one column.
- Reduced About this place and category headings relative to the question-led exhibit titles. Removed the decorative section artwork and topic-pill treatment while retaining all labels and anchor IDs.
- Standardized exhibit backgrounds, borders, radii and disclosure chevrons through the place route CSS module. Chart/selection colors remain intact. Specific disclosure wording, caveats and source content remain unchanged. The county interpretation-figures disclosure receives the same 44px target treatment.
- Wrapped budget labels consistently and aligned all three fields. No changes to persistence or arithmetic.
- Added `web/scripts/check-place-polish.mjs` for group geometry, responsive reading order, hierarchy, neutral panel surfaces, aligned fields, live budget/rent edits, keyboard disclosures, overflow and WCAG A/AA. Updated the legacy guide-focus geometry assertion for the approved mixture of paired and full-width cards; that full cross-tool script was not rerun.
- Full Vitest suite: 130 files / 770 tests passed. TypeScript passed. Final `npm run build` passed (2,430 static pages). `node scripts/check-place-polish.mjs` passed all 15 production-preview cases: Princeton, Mercer County and ZIP 08510 at 1440/900/768/390/320px, dark at 768 and light at other widths. `PLACE_PATHS=/nj/princeton node scripts/check-place-overview.mjs` also passed at all four maintained widths for original overview/input/navigation/source-focus behavior. `git diff --check` passed. Dark desktop and phone visual inspection completed; final evidence is `place-layout-refinements.png` in the task visualization directory. Physical-device and screen-reader testing remain unperformed.


### Approved content reduction

- Default place evidence now shows recent sales, housing cost burden and getting around alongside the existing cost overview. Trends, history, financing, migration and construction are grouped under a native “More market evidence” disclosure. Water, flood, services and community evidence are grouped under “Living there.” All supporting components remain rendered and accessible when expanded.
- Concise rendering is opt-in on shared components, so state pages and other consumers retain their existing presentation. Short titles replace repeated questions/topic badges. The sales period appears once above the figure; sales scope and mix caveats remain visible, with qualification details in “View sale details.” Migration leads with its visual and geography note; the longer flow/income narrative, tables, methodology and story link remain in details.
- Housing-pressure margins, uncomputed counts, survey period and eligibility caveat remain visible; selecting an income band still reveals its explanation. Cost calculations, partial-estimate notices and omissions are unchanged.
- Section navigation now opens a destination disclosure itself, as well as ancestors. Initial and changed fragment links reveal nested content, focus its heading/summary, and avoid creating extra history entries. Existing Getting around and evidence IDs remain available. Print CSS reveals the two new evidence groups even while closed on screen.
- Same-desktop snapshot of Princeton: default main text fell from 1,950 to 846 words (about 57%); main height fell from roughly 10,100px to 4,600px. This is a current-data snapshot, not a fixed content limit. Fresh browser contexts without saved inputs show about 830 default words.
- Verification: full unit suite passed, 130 files / 773 tests; TypeScript passed. Browser development-preview checks passed Princeton, Mercer County and ZIP 08510 at 1440/768/390/320px in default and expanded states, including keyboard operation, direct nested links, source availability, print visibility, WCAG A/AA and overflow. Final production build passed (2,430 static pages). `node scripts/check-place-content.mjs` passed all 12 production-preview cases (three places at 1440/768/390/320px), scanning default and expanded states and checking keyboard controls, legacy fragments, source content, print and overflow. The original overview audit passed Princeton at all four maintained widths, and the expanded-layout audit passed all three places at 1440/390px. `git diff --check` passed. The final screenshot is `place-concise-content.png` in the task visualization directory. Physical-device and screen-reader testing were not performed.
