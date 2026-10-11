# Destination link colours

## What changed
- County and town destination colours now take precedence over generic table/link styling.
- Work-destination town links explicitly carry the municipality theme.
- The guide's published-place link uses the destination's county, municipality or ZIP theme, not the guide's colour.
- External source links, navigation, footnotes and print styles are unchanged.

## Files/modules affected
- `web/app/ui-refinement.css`
- `web/components/DecisionGuide.tsx`
- `web/components/GettingAround.tsx` and its test
- `web/scripts/check-destination-colors.mjs`

## Architectural or implementation decisions
- Reuse semantic destination classes; do not infer geography from URL slugs.
- Keep ZIP lavender distinct from guide rose. Work destinations with a region ID are municipalities according to the API contract.

## Assumptions
- Existing county green, municipality teal and ZIP lavender remain the approved destination palette.

## New TODOs / limitations
- Browser sampling covers Somerset County, New Jersey and Princeton's guide, not every exported page.
- No backend, data or financial methodology changes.

## Verification
- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 636 tests passed in 97 files, including the work-destination class assertion.
- Local preview static build with `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed; local-only override must not be deployed. Initial sandbox build could not reach the API; reran successfully with local network access.
- `node scripts/check-destination-colors.mjs`: passed in light/dark themes for 57 county-page links, 48 state-page links and the Princeton guide link per theme.
- No configured frontend lint command. Backend tests not run (presentation-only).
