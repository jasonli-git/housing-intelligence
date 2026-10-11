# Guide slide stage

## What changed
- New Jersey now has the compact Your next step section used on place pages: buyer’s guide and Housing help destinations, immediately below the snapshot.
- Replaced its duplicate official-help cards with the help-tool destination. Preserved programme/property/source detail inside statewide evidence.
- Buyer’s guide answers now sit inside a distinct rounded slide card with large, tall previous/next arrows in dedicated side margins, not bottom controls. Existing question shortcuts remain.
- Place exhibits use more inviting factual question titles; no model text or measured values changed.

## Files/modules affected
- `web/app/states/new-jersey/page.tsx`, `web/app/[state]/[place]/page.tsx`
- `web/components/DecisionGuide.tsx`, `web/app/guide.css`
- `web/components/{HowUnusual,HomeSales,HomesAdded,WhoIsMoving}.tsx`
- Guide tests and responsive browser diagnostic.

## Architectural or implementation decisions
- Three-column slide stage reserves side gutters for controls; arrows remain sticky while reading a long answer. Smaller phone gutters preserve content width.
- Native buttons keep descriptive accessible labels, disabled boundaries and keyboard operation. Inputs and direct links retain existing behaviour; no autoplay or forced scrolling.
- Print hides navigation and still includes all loaded answers.
- New exhibit titles are conditional on the place-page exhibit presentation; report/default headings stay unchanged.

## Assumptions
- Transfer means reuse the next-step pattern on New Jersey, not remove it from place pages.
- The guide still requires choosing a county, town or ZIP; no synthetic statewide buying answer is introduced.

## New TODOs / limitations
- Housing assistance coverage and historical inventory limitations are unchanged; the dedicated tool retains application routes.
- The checklist slide remains naturally taller than the other answers; no tallest-slide-sized empty placeholder.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 613 tests across 92 files passed.
- `npm run build`: passed; 2,386 static outputs and 2,366 legacy aliases. The first attempt failed because the local API was stopped; restarted it and reran successfully.
- `node scripts/check-place-guide-focus.mjs`: passed at 320, 390, 760 and 1280px in light/dark themes. Covers side-arrow placement/size, unchanged scroll position, retained inputs, all three printed answers, NJ destinations, preserved assistance evidence and horizontal overflow.
- Visual inspection: desktop slide stage and NJ next-step area, plus mobile dark guide screenshot.
- `git diff --check`: passed.
- No frontend lint script is configured. Backend tests were not run because no backend logic or data changed.
