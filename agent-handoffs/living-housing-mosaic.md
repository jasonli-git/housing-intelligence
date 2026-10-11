# Living housing mosaic

## What changed
- Added a compact interactive housing-share exhibit below the existing profile on county, municipality and ZIP pages.
- A hundred architectural tiles regroup between independent owned/rented, occupied/empty and housing-age distributions.
- Exact estimates, denominator, ACS survey period and 90% margins remain readable beside the artwork. Touch/hover and keyboard category buttons reveal each group.
- Jump-to-section discovers the mosaic. Reports and existing profile/cost calculations remain unchanged.

## Files/modules affected
- `web/lib/housingMosaic.ts` and its tests: available views and largest-remainder allocation.
- `web/components/HousingMosaic.tsx` and its tests: interaction and accessible controls.
- `web/app/housing-mosaic.css`, root CSS import and place-page integration.
- `web/scripts/check-housing-mosaic.mjs`: responsive, interaction and scoped accessibility diagnostic.

## Architectural or implementation decisions
- Present 100 rounded share tiles, never records, addresses, a geographic map or a sample of properties. Each switch reshuffles visual identity; no cross-tabulation is inferred.
- Tenure uses occupied homes; occupancy and age use all homes. Empty includes seasonal homes and does not mean available rentals.
- Complements carry the original binary estimate's margin; age groups retain their own margins. Missing margins are explicit.
- Only valid Census ACS ratios are accepted. Age requires all four categories, matching source/release/period and a complete partition; incomplete distributions are omitted, never renormalized into misleading shares.
- Largest-remainder apportionment totals exactly 100 with deterministic ties. Exact percentages remain visible when very small groups receive zero tiles.
- No autoplay, interval loop, external library or additional API call. CSS transforms animate rearrangement without animating layout positions; reduced motion switches instantly.
- Decorative tiles are hidden from accessibility navigation; all groups are selectable with native buttons. No 100-stop keyboard maze or hover-driven live announcements.
- Mosaic is hidden in print; original profiles, tables and reports retain the figures.

## Assumptions
- This is an additive local experiment, not a replacement for the profile. Its placement and added mobile height are open to user feedback.
- Independent ACS distributions are sufficient for a first version; no building-type or tenure-by-age relationship was invented.

## New TODOs / limitations
- Data availability determines views; no mosaic shell is shown when none are supported.
- Tile counts round survey estimates and cannot convey their full uncertainty; numeric margins are presented alongside them.
- Very small groups can round to zero tiles but remain selectable in the legend.
- This does not change source licensing or collection; it reuses already-published Census data.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 622 tests across 94 files passed (9 new tests). Initial test-typing and accessible-label failures were corrected before the passing run.
- `npm run build`: passed; 2,386 static outputs, 2,366 legacy aliases and 16,693 files.
- `node scripts/check-housing-mosaic.mjs`: passed for county/town/ZIP pages at 320/390/760/1280px in both themes. Includes scoped axe accessibility, exact tile total, view/group switching, keyboard/hover access, no forced scroll, field bounds, horizontal overflow, reduced motion, normal-motion rearrangement, jump menu discovery and print omission.
- Visual inspection: mobile and desktop mosaics in light/dark themes.
- `git diff --check`: passed. No frontend lint command configured; backend checks not run (no backend changes).
- Browser diagnostic initially needed an explicit Playwright context for axe and a selector distinguishing visible copy from its screen-reader description; corrected and rerun successfully after the final build.
