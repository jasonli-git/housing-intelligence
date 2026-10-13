# Atlas everyday measures and shareable views

## What changed
- Main measure dropdown prioritizes typical single-family home price, typical asking rent, household income, renter cost pressure, and population, only where supported.
- Other existing measures are accessible through a searchable, grouped More measures panel. A selected secondary measure remains visible in the main dropdown.
- Added a reading guide with the measure definition, higher-not-better shading guidance, and missing-value explanation. Existing dates remain visible.
- URL restores geography, measure, supported change window, selected area, rotation, zoom and county pan. Share view copies the URL; clipboard failures instruct users to copy the address.
- Audited current municipal value-ranking coverage without enabling municipal drill-down.

## Files/modules affected
- `web/components/HousingAtlas.tsx`
- `web/app/atlas/atlas.css`
- `web/scripts/check-atlas-measures.mjs`

## Architectural or implementation decisions
- No new datasets, APIs, scoring methods, dependencies, or data rights changes.
- URL updates replace history after a short debounce instead of creating a history entry for each drag. Browser popstate restores supported state.
- Missing data remains missing; geographic exploration does not imply data coverage.
- Existing PR #159 and `experiment/housing-atlas` branch retained.

## Assumptions
- Everyday measures are a presentation shortlist, not a judgement that secondary datasets are less valuable.
- Live local warehouse value rankings are useful for a preliminary municipality coverage audit, but are not proof of aligned dates, geometry or precision for a future map.

## New TODOs / limitations
- Municipality coverage (local API, 2026-10-12; published finite value-ranking records / 564): typical single-family home price 388; asking rent 234; household income 562; renter cost pressure 563; population 564; gross rent 558; surveyed home value 560; permitted units 563.
- Town drill-down remains deferred. Audit source dates, margins, municipality geometry/parent relationships, and all observation records before implementation; show coverage separately for each measure. Do not infer missing equals zero.
- ZIP map remains deferred; ZIP areas are not municipal boundaries.
- Pinning 2–3 places and breadcrumb navigation remain future work, not implemented in this pass.
- Only existing eight starter datasets are exposed, not all warehouse metrics. Grouped picker includes only measures supported at the active geography.
- Physical Safari/iOS testing not performed.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 662 tests across 106 files passed.
- `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`: passed; 2,388 static pages / 16,704 exported files.
- `node scripts/check-atlas-measures.mjs`: four light/dark mobile/desktop cases passed; shortlist, search, selected secondary measure, restored URL, accessibility and reflow.
- `node scripts/check-atlas-globe.mjs`: six cases passed; rotation, state coverage, NJ drill-down, missing-state guard, glass materials, accessibility and reflow.
- `node scripts/check-housing-atlas.mjs`: six light/dark responsive cases and missing-geometry fallback passed.
- Visually inspected `/tmp/atlas-measures-390-dark.png`.
- `git diff --check`: passed.
