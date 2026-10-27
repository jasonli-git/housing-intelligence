# Exploration and research layout

## What changed
- Replaced county and town swipe strips with searchable, alphabetized directories. Six destinations show initially; visitors can expand the list or search all destinations.
- Added persistent state-page navigation and a town-directory destination on county pages; reduced the state title footprint.
- Added report navigation, bounded scrolling tables with sticky column headings, and expandable historical series.
- Added a publisher index to the source registry.

## Files/modules affected
- `web/components/PlaceDirectory.tsx`, `ExplorationResearch.module.css`, `CountyCabinet.tsx`, `TownRow.tsx`, `PlaceSectionNav.tsx`
- State, place, report and sources routes under `web/app`
- CountyCabinet and RegionStandOuts component tests

## Architectural or implementation decisions
- Reuse the existing section navigation behavior, including mobile picker, hash handling and focus transfer.
- Preserve direct destination links, source notices, figures, caveats and downloads.
- Native details keep individual history series available without rendering every table expanded. Print styling exposes history content and directory rows.
- Keep the retired county comparison feature disabled.

## Assumptions
- This is a layout refactor of existing exploration and research routes, without new datasets or ranking logic.

## New TODOs / limitations
- No screen-reader audit or print-dialog visual verification performed.
- Build used the local artifact service URL for verification; deployment must use its normal artifact configuration.
- No production deployment or merge performed.

## Verification
- `npm --prefix web test`: 131 files and 781 tests passed, including search beyond the collapsed directory preview.
- `npm --prefix web run typecheck`: passed.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npm --prefix web run build`: passed with local API and artifact services running. Initial attempt without the API failed; restored the dependency and reran successfully.
- `git diff --check`: passed.
- No lint script is configured.
- Browser: state county filtering and Mercer navigation; county town filtering and Princeton destination; report section navigation and focus transfer; 390px report history expansion with no page-wide horizontal overflow; publisher jump to Zillow Research.
- Desktop state/county and report views and phone-width history visually inspected. Local preview left open on New Jersey.
