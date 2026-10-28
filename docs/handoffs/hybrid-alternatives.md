# Hybrid alternatives and comparison-card audit

## What changed

- Princeton keeps three quick lower-price summaries, followed by a visible comparison matrix with Princeton and those three candidates. The matrix shows median sale price, detached homes, owner occupancy, households with children, rail proximity and commute. Other matches and full matching details remain in a disclosure.
- Revision notices now sit inside the comparison-card container, outside its report link. The revision link remains independently accessible, without nested anchors.
- The income label now says median household income. The rank-scale legend, accessible graphic label and hover title distinguish ordinal peer position from a dollar axis.

## Files/modules affected

- `web/components/CompactAlternatives.tsx` and its tests.
- `web/components/PlaceComparisonRail.tsx` and its tests.
- `web/components/PlaceComparisons.module.css`.
- `web/lib/placeComparisons.ts` and its tests.
- `web/scripts/check-place-comparisons.mjs`.

## Architectural or implementation decisions

- Retain the quick candidate summaries while restoring the actual matching measurements in one compact table. Mobile scrolls the table horizontally, with the measure labels pinned; the page itself does not overflow.
- Compare still includes the current place and three candidates, respecting its four-place limit.
- Use the existing similar-place response; no matching algorithm, source or numeric calculation changed. Missing measurements remain missing, and real zeroes remain zeroes. Dates stay visible, including differing candidate periods.
- Keep the experiment limited to the existing Princeton pilot. Other places retain their previous rankings and alternatives presentation.

## Assumptions

- Audited local API `/regions/224/packet?window=5y` and `/regions/224/summary?window=5y`: both report median household income **$192,079 ± $24,402**, ACS 2020–2024, point rank **58 of 562**, and plausible rank range **17–107**. The margin is the published 90% survey margin. This was a consistency audit against local published data, not an independent Census download.
- The marker is correctly near the high end of an ordinal lower-to-higher peer scale (approximately 89.8% along it). Its rank band spans approximately 81.1–97.1%. Neither position represents a linear dollar interval; no numeric bug was found.
- Similarity uses the response's housing traits and commute constraint, not income, schools or safety. Current qualifying sales cover January 2024–June 2026 and require at least 20 sales per town.

## New TODOs / limitations

- Local experiment only: no push, pull request, deploy, account changes or ingestion.
- At narrow widths the comparison matrix requires horizontal scrolling. The three summaries remain readable without it.
- Automated axe checks cover these two components, not a complete manual assistive-technology audit.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 145 test files, 851 tests passed. Existing React `act(...)` environment warnings remain in test output.
- `node scripts/check-place-comparisons.mjs`: passed at 320, 390, 768 and 1440 pixels in light and dark themes, including keyboard navigation, revision containment, matrix shape, compare/back navigation, section spacing, page overflow and scoped axe. Nonpilot Hoboken retains its original treatment. Reviewed mobile and desktop screenshots.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npx next build --debug-build-paths='app/[state]/[place]/page.tsx,app/compare/page.tsx,app/search.json/route.ts,app/states.json/route.ts'`: passed, 1,188 static routes. This is a scoped export, not a full-site build. The first sandboxed attempt could not reach the local API; repeated with local service access.
- `git diff --check`: passed.
