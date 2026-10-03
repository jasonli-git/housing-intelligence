# Local page layout experiment

## What changed

- Shortened the shared portfolio wordmark to `JL`, retaining its class/font and an accessible full-name link label.
- Reordered local profiles: costs and their caveats, household income/rents, contextual budget comparison, property/environment checks and the before-moving reading, local sales/construction, then the existing what-stands-out reading and ranked evidence.
- Put flood and ground/water checks side by side on desktop and stacked on mobile. Household panels now use two full-width desktop columns rather than leaving an empty third track.
- Moved relief/help links into the HUD household-income panel. Kept their eligibility disclaimer and reviewed date. When HUD limits are unavailable, costs retain the links; full reports retain their existing placement.
- Replaced the shared affordability switch with a `Find within my budget` destination link. County pages no longer replace their normal content with an affordability workspace.
- Added local New Jersey workspace controls: `Housing trends` / `Within my budget`, using the existing URL-backed mode and history behavior.
- County and municipal profile links open `/afford` with the place and county selected. Its comparison selector can switch to another county or all New Jersey. Map paint still uses the full available dataset, so out-of-scope places are not misrepresented as missing data. Widening the comparison resets the map camera without clearing the checked place.
- Moved property lookup into the home-checks group, without duplicating it beneath local sales. Reports preserve their existing lookup links.

## Files/modules affected

- `web/app/regions/[id]/page.tsx`: placement, grouping, contextual comparison links; removes the county-only affordability payload request/workspace mount.
- `web/app/redesign.css`: responsive groups, household columns, compact navigation and workspace controls.
- `web/components/Masthead.tsx`, `StateModeWorkspace.tsx`, `AffordExplorer.tsx`: navigation and comparison scope.
- `web/components/CostToOwn.tsx`, `ForYourHousehold.tsx`, new `HousingHelp.tsx`: shared relief links and placement.
- `web/components/HomeSales.tsx`: optional property-lookup rendering.
- New `web/lib/affordScope.ts` and tests: explicit statewide scope, county/town context, invalid IDs.

## Architectural or implementation decisions

- This is a presentation/navigation experiment, not a new affordability methodology. Existing arithmetic, uncertainty, provenance, data acquisition and generated readings are unchanged.
- The statewide map still uses its existing query-string mode subscription; ordinary local profiles always remain profiles, including old `?mode=afford` URLs.
- The global masthead keeps its existing control-prop interface for compatibility with all callers, but renders a normal destination link. Legacy toggle/county workspace modules remain unmounted rather than being deleted in this experiment.
- Scope is initialized from the address after hydration, preserving static-export compatibility. The county selector changes local client state; it does not currently rewrite the address.
- New Jersey's mode controls are native buttons with pressed state, not ARIA tabs requiring a separate tab keyboard model.

## Assumptions

- The reader's household questions belong immediately after cost calculations; property-specific checks should precede area-wide market context.
- A budget explorer is a purposeful destination rather than a global on/off setting.
- ZIP profiles keep access to the global explorer, but do not imply a ZIP-specific affordability result.

## New TODOs / limitations

- Separately reconcile the explorer's older mortgage-plus-tax cost model with the local cost card's richer ownership estimate before treating their answers as interchangeable. This task does not alter either model.
- Shared household income and cost assumptions between tools remain a separate follow-up. The explorer keeps its existing default income and owning/renting controls.
- The explorer still excludes places without supported Zillow/tax or rent inputs; transaction-price fallbacks are not silently introduced into rankings.
- Scope changes are not encoded back into the URL; the initial profile link provides context, while subsequent scope selection is local.
- Legacy local affordability URLs remain visible profiles; no automatic redirect has been introduced.
- No readings regenerated, backend/dependency changes, canonical-document edits, merge or deployment.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test`: 43 files, 390 tests passed, including five new scope tests.
- `cd web && npm run build`: passed; 2,377 static pages generated against the local API. Expected local-build warning: artifact download URLs use localhost because `NEXT_PUBLIC_ARTIFACT_URL` is unset. This is not a deploy-ready artifact configuration.
- `git diff --check`: passed.
- Headless Playwright checks on localhost at 1440px and 390px: county and municipality profiles, contextual budget selection, county/all-NJ summaries, state workspace switching, mobile household stacking, report compatibility and horizontal overflow.
- No frontend lint script is configured; no separate frontend lint pass claimed.
