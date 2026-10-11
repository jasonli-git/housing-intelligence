# Living housing mosaic

## What changed
- Integrated the state mosaic into Statewide snapshot after user approval: one shared blue surface, steady headline metrics, subordinate Explore the mix heading, mobile readout above the tiles, and More statewide figures last.
- Following user review, the mosaic is state-only: below New Jersey’s statewide snapshot, removed from county, municipality and ZIP pages.
- A hundred architectural tiles regroup between **new homes finished** (DCA building-type counts) and **home-purchase loans** (HMDA loan-type shares). These are existing statewide records, not a picture of the whole housing stock.
- Exact shares, denominator, source/year, construction reporting/preliminary limits and mortgage exclusions remain readable beside the artwork. Touch/hover and keyboard category buttons reveal each group.
- Moved home sales and building/demolition out of More statewide figures into two visible learning exhibits immediately below Find your place. Detailed figures remain accessible within their exhibits.
- Jump-to-section discovers the mosaic. Reports and existing profile/cost calculations remain unchanged.

## Files/modules affected
- `web/lib/housingMosaic.ts` and its tests: available views and largest-remainder allocation.
- `web/components/HousingMosaic.tsx` and its tests: interaction and accessible controls.
- `web/app/housing-mosaic.css`, root CSS import, New Jersey integration/exhibits and removal of place-page integration.
- `web/scripts/check-housing-mosaic.mjs`: responsive, interaction and scoped accessibility diagnostic.

## Architectural or implementation decisions
- Present 100 rounded share tiles, never records, addresses, a geographic map or a sample of properties. Each switch reshuffles visual identity; no cross-tabulation is inferred.
- State construction divides matching building-type counts by the reported completed-home total, requiring an exact complete partition, matching release/period/source and positive integer totals. These are homes, not buildings; missing office reports are not zero.
- State mortgage shares require matching source/release/period and a positive loan total. Other is the explicit loan-type remainder; overfull or missing distributions are omitted. Cash buyers and non-reporting lenders are excluded.
- State record shares do not pretend to have ACS sampling margins. The original ACS helper remains tested but is not integrated into any page; it preserves true denominators and margins if reused later.
- No inconsistent distribution is rescaled to fit. No averaging county percentages or new data acquisition.
- Largest-remainder apportionment totals exactly 100 with deterministic ties. Exact percentages remain visible when very small groups receive zero tiles.
- No autoplay, interval loop, external library or additional API call. CSS transforms animate rearrangement without animating layout positions; reduced motion switches instantly.
- Decorative tiles are hidden from accessibility navigation; all groups are selectable with native buttons. No 100-stop keyboard maze or hover-driven live announcements.
- Mosaic is hidden in print; original profiles, tables and reports retain the figures.

## Assumptions
- This is an additive state-page experiment, not a replacement for the snapshot. New Jersey is the only implemented state page; future state pages would need explicit integration with supported data.
- User approved a state-specific version based on existing statewide data rather than adding ACS acquisition. New homes and purchase loans are independent distributions, not all housing or all buyers.

## New TODOs / limitations
- Statewide ACS tenure/vacancy/age figures remain absent from the current packet. This is no longer a blocker: the approved state version uses existing construction and mortgage records instead.
- Data availability determines views; no mosaic shell is shown when none are supported.
- Tiles round reported shares. They cannot represent underlying reporting omissions or individual properties; source limitations remain visible.
- Very small groups can round to zero tiles but remain selectable in the legend.
- This does not change source licensing or collection; it reuses the project's existing NJ DCA and HMDA data and preserves publisher notices.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 629 tests passed across 94 files. State record tests cover complete partitions, matching source/release/period, mortgage exclusions, record-vs-survey labelling, very small groups that receive zero tiles and the embedded heading.
- `npm run build`: passed; 2,386 static outputs, 2,366 legacy aliases and 16,693 files.
- Initial `node scripts/check-housing-mosaic.mjs` run passed for county/town/ZIP pages at 320/390/760/1280px in both themes. Diagnostic now targets the state record mosaic, verifies the two moved exhibits and asserts absence on home/county/town/ZIP pages. Includes scoped axe accessibility, exact tile total, view/group switching, keyboard/hover access, no forced scroll, field bounds, horizontal overflow, reduced motion, normal-motion rearrangement, jump menu discovery and print omission.
- Visual inspection: mobile and desktop mosaics in light/dark themes.
- `git diff --check`: passed. No frontend lint command configured; backend checks not run (no backend changes).
- Browser diagnostic initially needed an explicit Playwright context for axe and a selector distinguishing visible copy from its screen-reader description; corrected and rerun successfully after the final build.
- State-only review initially failed the expected-NJ-mosaic assertion: real state packet/summary had no ACS measures. User subsequently approved an existing-state-record version; no data collection was added.
- State record browser checks passed at all four widths in both themes, including the two visible exhibits immediately following Find your place and absence of the mosaic on national/county/town/ZIP pages. State mosaic and exhibit screenshots inspected on mobile/desktop.
