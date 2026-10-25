# Place page overview

## What changed

Place pages now open with a compact place identity, a prominent comparison action, and a persistent section navigator. Ownership and rental estimates appear before the household profile and adjustment controls. Desktop places the compact profile beside the cost cards; smaller screens follow the cards with the profile. The introductory market narrative and its supporting figures remain available in a native disclosure. Per review feedback, the duplicate “Planning a purchase here?” and “Find housing help” cards below Make it yours are removed; About this place follows directly. The existing buyer-guide link within Make it yours and shared Housing help navigation remain.

The navigator links to overview, costs, market, getting around, living there, optional alternatives, and the shared source footer. On phones it becomes a labelled section picker. It tracks reading position, accounts for the sticky masthead, transfers keyboard focus, opens enclosing source disclosures, and honors reduced motion.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: shared county, municipality and ZIP composition, comparison action, navigation destinations and explicit missing-benchmark fallback.
- `web/app/place-overview.module.css`: scoped layout, compact headings, responsive profile and cost composition, print adjustments.
- `web/components/CostToOwn.tsx`: opt-in compact composition and baseline dates; existing report/tool presentation remains the default.
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
- `npm test -- --reporter=dot`: 130 files, 770 tests passed.
- After final control ordering, `npm run typecheck` and `npx vitest run components/CostToOwn.test.tsx components/PlaceSectionNav.test.tsx`: passed, 14 tests.
- `npm run build`: passed, 2,430 static pages generated.
- `node scripts/check-place-overview.mjs`: production-preview checks passed for Princeton, Mercer County, ZIP 07030 and ZIP 08510 at 1440/768/390/320px. The sparse ZIP exposed a test that did not force scrolling when its target was already visible; after fixing that assertion setup, `PLACE_PATHS=/nj/zip-07311 node scripts/check-place-overview.mjs` passed at all four widths. Checks cover cost updates, comparison action, sticky navigation, source disclosure/focus/hash, overflow, console errors and WCAG A/AA axe rules. Dark mode tested at 768px; light at other widths.
- Desktop/phone visual inspection: Princeton, county photo treatment, and ZIP with no published rent. Screenshots saved to the task visualization directory.
- `git diff --check`: passed.


### Removal of duplicate next-step cards

Removed the two place-page action cards and their empty wrapper, and updated the place overview and guide-focus browser checks. No shared style rules were removed because they may support other routes. Verification passed: `npm run typecheck`, `npm run build` (2,430 static pages), `PLACE_PATHS=/nj/princeton node scripts/check-place-overview.mjs` (1440/768/390/320px; card absence, About this place, existing inputs/navigation/source focus, overflow and WCAG A/AA), and `git diff --check`. The larger cross-tool `check-place-guide-focus.mjs` script was updated but not rerun in full. Visual inspection confirmed the direct transition, saved as `place-action-cards-removed.png` in the task visualization directory.
