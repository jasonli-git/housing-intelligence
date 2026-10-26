# Property Tax and Housing Help layout

## What changed
- Property Tax uses a compact left-aligned introduction and restrained search field. The result pairs annual tax and assessment with town context and official next steps on desktop, stacking on phones.
- Ownership costs, lot details and nearby context are retained in a native disclosure, with print CSS to expose its content.
- Housing Help pairs official assistance routes with the historical property inventory on desktop. Phones retain assistance-first reading order and section links provide direct access to records.
- Housing records use a simpler list and counts explicitly describe matching records whose inventories can overlap. The inventory disclosure now supports both pointer and keyboard interaction.

## Files/modules affected
- web/app/tax/page.tsx
- web/app/help/page.tsx
- web/components/TaxLookup.tsx
- web/components/AffordableHousing.tsx
- web/components/SupportTools.module.css

## Architectural or implementation decisions
Presentation uses a scoped module shared by the two standalone tools. Embedded AffordableHousing keeps its existing styling through display-contents wrappers. Tax calculations, search, inventory filtering/pagination, official destinations and source text are unchanged. Native disclosures preserve state while closed.

## Assumptions
Continue on refactor/buyers-guide-layout and update PR #256. State/county exploration and the research experience are deferred until this branch is deployed. No merge or deployment is part of this task.

## New TODOs / limitations
- No new axe audit, physical-device or screen-reader testing. Print expansion is implemented but not visually verified in a print preview.
- Existing cross-page theme rules require explicit scoped overrides; broader CSS consolidation remains separate work.
- Local build uses localhost:8093 artifacts and must not be used as production deployment output.

## Verification
- npm --prefix web test: 131 files / 780 tests passed after final component changes.
- npm --prefix web run typecheck: passed.
- git diff --check: passed.
- Browser: address search for the existing 100 Community Dr example, selected tax result, expanded property details; desktop and 390px layout with no horizontal overflow.
- Browser: Princeton inventory search, 136 matching records; close/reopen disclosure preserves filtering. Section jump focuses the record area. Phone help search layout checked at 390px with no horizontal overflow.
- Local services had stopped when work resumed, causing a build data-fetch failure; API and artifact services restored before rerunning.
- Final NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npm run build: passed; 2,430 static pages and publication diagnostics completed after restoring the API.
- No lint script is configured in web/package.json.
