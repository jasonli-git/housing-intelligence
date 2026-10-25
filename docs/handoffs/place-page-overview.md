# Place page overview

## What changed

Place pages now follow the user-provided layout study: a compact place identity and comparison action, a flat row for estimated ownership cost, typical rent and household income, then a two-column payment breakdown and local context. Thin rules replace the overview's glass cards, decorative map artwork is removed, and labels precede profile values. Phones retain ownership/rent side by side, followed by income and a stacked payment/context layout. Native source definitions, margins, revision markers and source periods stay available.

The live payment bar and its exact component legend sit below the headline figures. Down payment and other editable assumptions live in “Fine-tune the costs”; detailed owning/renting comparison is a disclosure. Calculation tables, rate scenarios, omitted costs and deeper planning/exhibit sections remain available. The header action names the place, for example “Compare Princeton.”

The navigator links to overview, costs, market, getting around, living there, optional alternatives, and the shared source footer. On phones it becomes a labelled section picker. It tracks reading position, accounts for the sticky masthead, transfers keyboard focus, opens enclosing source disclosures, and honors reduced motion.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: shared county, municipality and ZIP composition, comparison action, navigation destinations and explicit missing-benchmark fallback.
- `web/app/place-overview.module.css`: scoped layout, compact headings, responsive profile and cost composition, print adjustments.
- `web/components/CostToOwn.tsx`: opt-in study composition, third headline figure slot, shared payment/rate/calculation fragments and baseline dates; existing report/tool presentation remains the default.
- `web/components/QuietCounty.tsx`: optional profile title and visible source-period notes for the overview.
- `web/components/CostToOwn.test.tsx`: verifies edited down payment updates both the headline and the separated payment chart and calculation disclosure.
- `web/components/PlaceSectionNav.tsx` and its CSS module: responsive navigator.
- `web/components/PlaceSectionNav.test.tsx`: destination discovery, streamed footer, disclosure opening, focus and reduced motion.
- `web/scripts/check-place-overview.mjs`: browser acceptance coverage.

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
- `npm test -- --reporter=dot`: 130 files, 771 tests passed.
- After extracting the shared payment fragments, `npm run typecheck` and `npx vitest run components/CostToOwn.test.tsx components/PlaceSectionNav.test.tsx`: passed, 15 tests.
- `npm run build`: passed, 2,430 static pages generated.
- `node scripts/check-place-overview.mjs`: production-preview checks passed for Princeton, Mercer County, ZIP 07030 and ZIP 08510 at 1440/768/390/320px. The sparse ZIP exposed a test that did not force scrolling when its target was already visible; after fixing that assertion setup, `PLACE_PATHS=/nj/zip-07311 node scripts/check-place-overview.mjs` passed at all four widths. Checks cover cost updates, comparison action, sticky navigation, source disclosure/focus/hash, overflow, console errors and WCAG A/AA axe rules. Dark mode tested at 768px; light at other widths.
- Desktop/phone visual inspection: Princeton, county photo treatment, and ZIP with no published rent. Screenshots saved to the task visualization directory.
- `git diff --check`: passed.


### Layout-study review revision

The user supplied the earlier layout study and requested a closer implementation. The same PR now uses the three-figure row and payment/context structure described above. Development-preview checks passed across Princeton, Mercer County, ZIP 08510 (no rent), and ZIP 07311 (no ownership estimate), at all four maintained widths. Final production-preview checks also passed for those four places at 1440px and 390px using `PLACE_PATHS=/nj/princeton,/nj/mercer-county,/nj/zip-08510,/nj/zip-07311 PLACE_WIDTHS=1440,390 node scripts/check-place-overview.mjs`. Production build passed again after the final component extraction and spacing changes. The dark desktop screenshot is saved as `place-layout-study-revision.png` in the task visualization directory. No source values or calculation formulas were replaced with the screenshot's example text.
