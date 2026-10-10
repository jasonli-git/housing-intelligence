# Local card and link polish

## What changed
- Make it yours uses a page-blended neutral surface and restrained rounded outline instead of a contrasting gray slab.
- Prices and paychecks uses a dashed timeline edge; the local market has a softly framed surface; migration uses directional marks and an open divider treatment.
- Opening the local programme panel reveals town reporting and property inventory by default. Sources and limits stays collapsed.
- Internal text links use warm stone/ivory instead of external-source blue. Geographic breadcrumb colors and explicit button treatments are retained.

## Files/modules affected
- web/app/ui-refinement.css
- web/components/QuietCounty.tsx
- web/components/AffordableHousing.tsx and AffordableHousing.test.tsx
- web/scripts/check-card-polish.mjs

## Architectural or implementation decisions
- A local wrapper context signals the inventory loader when its outer disclosure opens. Pre-expanded hidden child panels do not trigger downloads on page load.
- Independent inventory panels outside this wrapper retain their existing behavior.
- Decorative directional marks are not plotted quantities. No new numerical claims or data transformations.
- Link distinction is screen-only; print presentation remains unchanged. Full-report layouts were not redesigned.

## Assumptions
- This is a refinement of the current experimental branch and existing PR, not a new branch or deployment.
- Blue remains the default for external links, including official housing-help routes.

## New TODOs / limitations
- Inventory loading still depends on the published artifact/API endpoint; existing error and retry handling is preserved.
- Local verification builds use the temporary localhost artifact service and must not be deployed with that configuration.

## Verification
- npm run typecheck: passed.
- npm test: 575 tests passed across 85 files.
- git diff --check: passed.
- NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386 exported pages.
- node scripts/check-card-polish.mjs: passed at 1280px and 390px in light/dark themes; deferred inventory fetch, expanded children, collapsed sources, distinct internal/external link colors, no horizontal overflow or runtime errors, and no axe WCAG A/AA violations in checked states. Desktop/light and mobile/dark screenshots visually inspected.
- Initial browser test invocation needed an explicit browser context for axe; corrected the test harness and reran successfully.
