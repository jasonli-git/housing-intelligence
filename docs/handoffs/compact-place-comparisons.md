# Compact place comparisons

## What changed

Princeton's ranked measures are now a visible, small horizontal rail immediately above Local stories, outside the local-picture note. Five curated current-value measures: income, renter cost burden, homeownership, one-way commute and median year built. Kept actual cohort sizes, rank direction, survey periods, value margins and rank ranges/ties visible. A neutral position marker runs from lower to higher values, with a band for supplied rank uncertainty/ties. No best/worst badges or duplicate home-price/rent headlines. Each tile links to the full report's current values for definitions and supporting evidence.

Replaced Princeton's large alternatives editorial/table section with three compact matches, a measured price difference and dated matching characteristics. Compare places opens the existing four-place comparison (Princeton plus those three). Matching details names all matching measures, minimum sales, price/commute constraints and the limits; the other two qualifying matches remain linked there. Not a recommendation or a claim about schools/safety.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`
- New `PlaceComparisonRail`, `CompactAlternatives`, shared CSS module.
- New `lib/placeComparisons.ts` and tests; `CompactAlternatives.test.tsx`.
- New `scripts/check-place-comparisons.mjs`.

## Architectural or implementation decisions

Princeton pilot only; other places retain existing ranked disclosures and alternatives tables. The rail is native horizontal overflow with focusable measure links and scrollbar, no auto-advance. Print expands it into a grid. No changes to ranking or matching algorithms.

Rank positions consistently map low values left/high values right even for lower-is-better metrics. Use actual per-measure denominators, not all 564 registered municipalities. Combine tie spans and supplied survey rank ranges conservatively; explicitly say when a survey rank range is unavailable. All curated measures are Census ACS and disclose their 90% uncertainty basis.

Alternatives use the existing API order and actual matching measures (housing mix, ownership, households with children and rail proximity), not the hypothetical income example in the proposal. A price difference is shown only for finite positive prices with matching nonmissing observation dates; missing prices are not zero. Survey-characteristic dates remain visible separately from the sales window. `MAX_PLACES` is four, so the main comparison is limited to the three displayed matches; no claim that the comparison contains all five.

## Assumptions

Approved scope is a compact visible rankings rail and three-candidate alternatives strip. Supporting matching methodology may remain expandable; primary findings are visible. Local-only branch work with no push/deploy or canonical-doc changes.

## New TODOs / limitations

The five curated measures are a preview, not all ranked measures. Longer rank ranges can make tiles taller than the proposed 100–120px target; preserve readable uncertainty instead of truncating it. Detailed comparisons and all report measures remain linked. Alternatives beyond the first three are available under Matching details. No new-state/data/warehouse work.

## Verification

- `npm run typecheck`: passed after handling nullable SimilarFigure dates.
- `npm test -- --reporter=dot`: 847 tests in 144 files passed. New tests cover rank direction, survey/tie spans, missing ranks, real price differences and refusal of invalid/missing/mismatched prices.
- Initial browser matrix at 320/390/768/1440 in both themes passed visible rankings/order, candidate count, links, keyboard access, overflow and scoped axe.
- Visual inspection found old global heading/pill styles still inflating the new sections; scoped overrides restore compact typography without changing nonpilot sections.
- A navigation/back audit initially sampled interpolating town-link colors. Direct inspection confirmed the settled established town token passes; the final harness waits for CSS transitions to finish before auditing.
- Final browser and production-build outcomes appended after completion. No full backend suite or data publication needed/run.
- `node scripts/check-place-comparisons.mjs` final run passed all eight width/theme combinations: visible rail/uncertainty text, compact typography/height, link focus, additional matches/methodology, four-place comparison navigation/back, no overflow and scoped axe. Hoboken retains its original disclosure/alternatives presentation. The initial nonpilot assertion incorrectly required a match table even in the existing no-matches state; corrected it to verify the original alternatives component.
- Final scoped production export passed (1,188 routes). `git diff --check` passed. Visually inspected the final desktop dark rankings and desktop light alternatives.

Follow-up: matched the Alternatives heading to About this place's responsive Georgia size/weight/line-height, per the user's annotation. Updated the regression harness to assert that parity. Browser checks passed at 390/1296/1440px for computed heading styles and no horizontal overflow. No full suite/build rerun for this CSS-only typography adjustment.
