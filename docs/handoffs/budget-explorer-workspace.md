# Budget Explorer workspace

## What changed

The standalone Budget Explorer now places essential controls beside matching places on desktop and above them on smaller screens. A compact monthly budget replaces the oversized separate budget panel. The initial list shows ten towns with a Show all action. Exclusions and missing-data coverage appear before the lists; existing comparison bars, sources and methodology remain available.

Buy/Rent and expanded-list state survive reopening the URL. County persistence and household storage are retained. An explicitly supplied income query is kept current when edited; new searches do not add household income to their URL. Advanced ownership assumptions are hidden in rent mode on the standalone route. Cash is explicitly described as a saved planning input rather than a monthly-results filter.

## Files/modules affected

- `web/app/afford/page.tsx`
- `web/components/AffordExplorer.tsx`
- `web/components/AffordExplorer.module.css`
- `web/components/AffordExplorer.test.tsx`
- `web/lib/budgetExplorerUi.test.ts`

## Architectural or implementation decisions

A `workspace` opt-in activates the standalone route layout and URL state behavior. Embedded explorers retain their existing presentation, 25-row initial lists and assumption availability. The shared component receives modest copy improvements and structural wrappers. Existing `reach`, `monthlyBudget`, personal assumptions, household storage and place links are reused; no affordability formulas changed. Scoped CSS owns the new composition without adding another global theme stylesheet.

## Assumptions

The approved next step is the Budget Explorer, not simultaneous implementation of every future tool refactor. Buyer’s Guide and state/county exploration remain separate future tasks. Existing task branch and PR are retained.

## New TODOs / limitations

- No participant usability study, screen-reader session or automated axe audit was performed in this task.
- The 30% line is a comparison aid, not underwriting or loan approval. Cash does not determine the displayed monthly matches.
- No migration of all legacy tool CSS is attempted.
- URLs preserve mode, scope and expanded-list state; personal rate/insurance/upkeep remain browser-local as before.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: 131 files / 779 tests passed. New cases cover rent/scope restoration, unchanged monthly budget, updating an existing income parameter, and avoiding income in new URLs.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npm run build`: passed, 2,430 static pages and publication diagnostics completed. Local API used for build; this does not deploy the site.
- `git diff --check`: passed.
- Browser: desktop two-column composition; 320px controls with no document overflow; 768px two-column controls and dark appearance with no overflow; empty-income and zero-match states; rent/county changes; opening Absecon and returning preserves Rent and Atlantic County. Restored test inputs/theme and viewport after checks.
- Final static preview at localhost:3002/afford loads the new layout and figures. Screenshot saved outside the repository as budget-workspace.png.
- No lint script is configured.
