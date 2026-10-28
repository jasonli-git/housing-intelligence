# Housing profile and ranks within About this place

## What changed

- Removed Princeton's standalone Housing at a glance block above Market at a glance.
- Moved the housing profile inside About this place, in a compact left column beside the ranked-measures carousel on desktop. Local stories span the full width below both. The two sections stack below 1,001px.
- Renamed the headings to “Housing profile” and “Ranked measures” to distinguish the descriptive portrait from the peer-rank graphics. Retained the additional-profile disclosure, definitions, margins and revision links.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: relocate the profile beside the ranked carousel.
- `web/app/place-overview.module.css`: responsive two-column About layout.
- `web/components/CompactHousingProfile.tsx` and CSS module: subsection heading and compact vertical profile.
- `web/components/PlaceComparisonRail.tsx` and `PlaceComparisons.module.css`: explicit ranked heading and container queries so carousel cards size to their narrower column.
- `web/scripts/check-place-comparisons.mjs`: assert profile containment within About, desktop left-hand placement, restored main-section rhythm and existing interactions.

## Architectural or implementation decisions

- Change composition rather than combine the datasets again: retain the complete original housing profile and the existing separate ranked carousel. No calculation, matching or source-selection changes.
- The current ranked carousel still uses the existing five selected current-value measures; this task does not restore the older `standOuts` highest/lowest or five-year leading/lagging selection. Some profile figures therefore also appear with peer-rank graphics in the carousel. The UI says “Ranked measures,” not a claim that all five are extreme ranks.
- Preserve the current Princeton-only pilot. Other place pages remain unchanged.
- Keep all five place-section navigation destinations; profile is now part of About this place.

## Assumptions

- User authorized local implementation on the existing experiment branch. No push, PR, deployment, account changes or ingestion.
- Start with the profile on the left as suggested; mobile reading order is profile, ranked carousel, Local stories.

## New TODOs / limitations

- If the intent is to restore the original highest/lowest and leading/lagging selection as well as separate the presentation, that selection needs a follow-up rather than silently describing the fixed five-measure preview as extremes.
- Manual assistive-technology and print audits not performed.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: all 852 tests in 145 files passed; existing React act-environment warnings remain.
- `node scripts/check-place-comparisons.mjs`: all eight responsive/theme cases and nonpilot Hoboken passed. Covers 320/390/768/1440px, light/dark themes, profile disclosure and placement, shared section gaps, carousel controls/keyboard, all alternatives, compare/back, overflow and scoped axe.
- Visually reviewed About this place in 390px and 1440px captures.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npx next build --debug-build-paths='app/[state]/[place]/page.tsx,app/compare/page.tsx,app/search.json/route.ts,app/states.json/route.ts'`: passed, 1,188 static routes. Scoped export, not a full-site build.
- `git diff --check`: passed.

## Follow-up: separate left-hand profile card

- At the user's request, the profile now has its own glass surface, subtle border, 12px corners and internal padding, echoing the former Costs sidebar while remaining left of the ranked carousel inside About this place.
- Removed the column-divider rule; the card boundary provides the separation. Figures, definitions, revision notice, disclosure and carousel behavior are unchanged.
- Changed only the two layout/style modules. Visually reviewed 390px and 1440px captures. TypeScript and all 852 web tests passed. All eight responsive/theme browser cases plus nonpilot Hoboken passed, including scoped axe, overflow and interactions. The scoped production export passed (1,188 routes). `git diff --check` passed. Local only.

## Correction: profile outside the About card

- The user clarified that the profile should be a sibling card, outside the About this place frame. Moved it into a shared `place-about-layout` grid: profile left, About card right, top aligned. On smaller screens the independent profile card appears before the About card.
- Ranked measures and Local stories remain inside the About card. Profile contents and all calculations are unchanged. The school check remains beneath the grid, as before.
- The conditional layout wrapper is a fragment on nonpilot pages, preserving their DOM structure. The browser regression now explicitly asserts that the profile is outside the About frame and that both cards share a parent.
- Visually reviewed the desktop sibling-card layout. TypeScript and 852 tests passed. All eight responsive/theme browser cases and nonpilot Hoboken passed, including scoped axe, overflow and navigation. The same scoped production export passed (1,188 routes); `git diff --check` passed. Local only.
