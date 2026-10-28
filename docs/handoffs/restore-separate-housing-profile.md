# Restore the separate housing profile

## What changed

- Restored Princeton's full housing profile as a compact standalone block above Market at a glance, after the place section navigation.
- The original three headline figures are visible: typical household income, renter cost burden and property-record home age. The remaining original profile figures are accessible through “More about the housing here.” Definitions, margins, contextual ranks and revision links come from the original profile data/component.
- Ranked measures remain a separate carousel within About this place. Its current selection, source choices, rank calculations and controls are unchanged in this follow-up.
- The cost card remains full width, without the old sidebar. Other place pages retain their existing profile layouts. The navigation retains its five destinations; the profile is introductory context rather than a sixth navigation item.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: restore the existing QuietProfile component before the pilot's market opening.
- `web/app/place-overview.module.css`: scoped compact layout; three columns on desktop, one column on mobile, shared section spacing.
- `web/scripts/check-place-comparisons.mjs`: verify profile placement, three primary figures, expandable additional figures and spacing. Include the restored profile in the scoped axe audit.

## Architectural or implementation decisions

- Reuse `housingProfile` and `QuietProfile`, including their original measure selection, rather than reconstructing profile figures from the ranked carousel.
- Keep the five-measure ranked carousel as requested. Some profile figures also have ranks and still appear in the carousel; this change separates their presentation and restores the omitted profile content rather than changing the ranking selection again.
- Restore only the existing Princeton pilot (`marketFirst`); do not roll out the experiment to other pages.

## Assumptions

- The user's instruction authorizes this local implementation on `experiment/place-page-hierarchy`. No push, PR, deploy, ingestion or account changes.
- “Above Market at a glance” means after the section navigation and before the market opening, rather than returning the profile beside Costs.

## New TODOs / limitations

- Further changes to which ranked measures are selected would be a separate decision; this follow-up preserves the carousel.
- Manual screen-reader and print audits were not performed.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: all 852 tests in 145 files passed; existing React act-environment warnings remain.
- `node scripts/check-place-comparisons.mjs`: passed all eight 320/390/768/1440px light/dark cases and nonpilot Hoboken. Checks expanded profile content, placement, consistent section boundaries, ranking/alternatives controls, compare/back, overflow and scoped axe.
- Visually inspected mobile and desktop profile captures; adjusted inherited portrait styles to keep the restored block compact.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npx next build --debug-build-paths='app/[state]/[place]/page.tsx,app/compare/page.tsx,app/search.json/route.ts,app/states.json/route.ts'`: passed, 1,188 static routes. This is a scoped export, not a full-site build.
- `git diff --check`: passed.
