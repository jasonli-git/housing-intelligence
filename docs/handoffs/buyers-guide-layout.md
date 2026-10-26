# Buyer’s Guide layout

## What changed
- Place and household setup sit beside results on desktop and above them below 960px.
- Compact page title and verdicts, quieter cards, and result navigation shown only after a place loads.
- Added visible estimate and scenario caveats next to figures; retained detailed sources and calculations in disclosures.
- Checklist findings are no longer clipped. Expanded checks span both columns; controls and disclosures have 44px minimum targets.

## Files/modules affected
- web/app/guide/page.tsx
- web/app/guide-horizon.css
- web/components/DecisionGuide.tsx
- web/components/DecisionGuide.module.css
- web/components/DecisionGuide.test.tsx

## Architectural or implementation decisions
Scoped CSS module overrides existing guide theme. Removed the obsolete forced single-column rule. Kept calculation libraries, saved-input behavior, place transfer, and native disclosures intact. DOM reading order remains setup then answers.

## Assumptions
This is a presentation refactor on the approved refactor/buyers-guide-layout branch. No production deployment or merge is authorized.

## New TODOs / limitations
- No new axe audit, physical-device testing, or screen-reader study performed.
- Existing theme CSS remains; broader theme consolidation is separate work.
- Local build uses localhost:8093 for published artifacts and is not deployment output.

## Verification
- npm --prefix web test: 131 files, 780 tests passed.
- npm --prefix web run typecheck: passed.
- git diff --check: passed.
- Production build initially failed fetching Google Fonts in the restricted sandbox; rerun with network access succeeded. Final CSS rebuild recorded below.
- Browser: Princeton loads with saved household input; desktop two-column layout and compact heading visually checked; 390px layout and expanded assumptions have no horizontal overflow. Dark theme checked. Default viewport restored.
- Final NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npm run build: passed, 2,430 static pages and publication diagnostics completed.
- Browser result links focus their headings; expanded Flood risk check spans the results width without overflow.
