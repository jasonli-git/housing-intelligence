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

## Approved follow-up: highlights, profile and cost-view refinement

### What changed

- The model highlights and ranked-measure disclosure now share the existing green-accented interpretation card. The label explicitly says `Highlights · Model interpretation`; the disclosure remains labelled `Computed rankings`. Citations, model identity, stale-reading warnings and the interpretation disclaimer remain intact. Missing readings still leave the ranking explorer available.
- The local introduction now gives one short computed headline, with the full existing verdict and tax tradeoff behind `Why this headline?`. Survey-based home values name their survey year and incomplete cohorts say `covered`; uncertainty crossing zero does not become a confident rise/fall headline. Removed the redundant generic place description from the rendered header.
- Local profile banners add typical household income and renters spending over 30% of income on rent/utilities. Both retain survey definitions, margins and rank ranges.
- Replaced raw permits in those banners with net homes added per **100** existing homes, as explicitly requested. The existing `nj_net_units_per_1000` metric remains unchanged in the warehouse, packets, tables and citations: the banner divides its value and margin by 10. Ranks stay unchanged. Small positive margins retain precision instead of rounding to zero. Definitions disclose reporting limits, denominator vintage and negative values; permits remain in Local market.
- Removed the redundant `Money gone` auxiliary cost view. The monthly total, money-gone figure, principal breakdown and its definition stay in the main card. The remaining views are `Cash needed to buy` and `Over N years`. Full reports also omit the repeated auxiliary block; calculations are unchanged.
- Publisher notices now form one faint inset with publisher labels, two columns on desktop and one on mobile. Notice wording, links and default visibility are unchanged.
- Removed obsolete CSS that hid county introductions/profile banners on legacy affordability URLs.

### Additional files

- `web/components/ExplanationPanel.tsx`: optional heading/children slots to join interpretation and rankings without changing generated text.
- `web/components/SourceFooter.tsx`: publisher-labelled notices.
- `web/lib/verdict.ts` and tests: concise computed orientation and profile lineup/scaling.

### Decisions and limitations

- Do not imply that ranking cards support every model sentence: a reading can cite the broader data packet. Its original figure citations remain authoritative.
- Retained home age, lot size, ownership, apartment-building share and vacancy in the profile; each describes a distinct housing-stock feature. No automatic substitution of permits when net additions are missing.
- Added no new data collection or generated readings. New Jersey's statewide profile remains its existing separate series lineup; these housing-stock lineup changes apply to local profiles.

### Follow-up verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test`: 43 files / 397 tests passed, including headline basis/coverage/uncertainty, per-100 conversion, rank preservation, missing additions and tiny-margin precision.
- `cd web && npm run build`: passed, 2,377 static pages; same expected local artifact-origin warning.
- `git diff --check`: passed.
- Headless localhost browser checks cover combined-card expansion, the new profile lineup, desktop/mobile layout, notices and cost views. No reading regeneration or deployment.

## Follow-up: before-moving card

- Restored a distinct, softly tinted card around `What should I check before moving?` within the local home-checks group. Retained its compact desktop title/bullet layout, mobile stack, model identity, citations and disclaimer.
- Scoped the styling to local page groups; report rendering and other interpretation cards are unchanged.
- The owner also asked for advice on moving the comparison caveat/five-year context and warming the computed introduction. Those remain recommendations, not implemented changes in this follow-up.
- Verification: typecheck passed; 43 test files / 397 tests passed; static build generated 2,377 pages with the expected local artifact-origin warning; diff whitespace checks passed. Headless checks at 1440px and 390px found no overflow or page errors and confirmed the card border. No deployment.

## Approved follow-up: cost context placement and warmer introduction

- Moved the existing comparison caveat, five-year context and applicable tax caveat into a supporting strip immediately after the monthly cost card, before cash-up-front/long-term views. No duplicate context block, calculations or historical text changes. Full report ordering remains unchanged.
- Replaced the shorthand `Home values: … Five-year rise: …` opening with a natural computed sentence. The complete price/rank/change/tax detail remains expandable under `See the figures behind this`.
- Retained source-basis, survey-year and partial-cohort qualifiers. Price/rank uncertainty still controls comparative wording; change uncertainty spanning zero does not become a rise/fall claim. Negative and unchanged changes retain their correct direction. `But` highlights a supported lower-price/faster-rise or higher-price/slower-rise contrast, otherwise the sentence uses `and`.
- Verification: frontend typecheck and 43 test files / 399 tests passed. Added decline and broad-rank-uncertainty cases, and updated natural-sentence expectations. Headless desktop/mobile checks confirmed one context strip before both extra views, no horizontal overflow or page errors, and the intended Atlantic County sentence. Diff whitespace checks passed. No readings regenerated or deployment.
- Static production build passed: 2,377 pages generated against the local API, with the expected unset-artifact-origin warning for a local build.

## Follow-up: distinguish the before-moving checklist

- Changed only the local before-moving card styling: a faint warm surface, solid neutral border, muted warm top accent and matching bullet markers. The green dashed/left-accent headline treatment remains reserved for the combined standout highlights.
- Kept card contents, citations, attribution, layout and height essentially unchanged. Reports are not affected by this local-group selector.
- Recommended moving the combined standout section after household/budget comparison and before property checks and Local market. Placement has not changed: the owner asked for advice on that part.
- Typecheck and 43 files / 399 tests passed; diff whitespace checks passed. Headless checks at 1440px and 390px confirmed distinct styling, no horizontal overflow and no page errors.
- Static build passed: 2,377 pages, with the expected local artifact-origin warning. No deployment or reading regeneration.

## Approved follow-up: move standout highlights higher

- Moved the complete combined model-highlights/ranked-measures section directly after `For your household` and its contextual budget link, before `Before choosing a home` and `Local market`.
- Preserved the section's contents, conditional rendering, attribution, citations, carousel interactions and styling. No duplicated section, calculations or reading regeneration. Full reports remain unchanged.
- Typecheck, 43 test files / 399 tests and diff whitespace checks passed.
- Local servers were initially stopped: the first browser check could not connect and the first static build failed fetching API data. Restarted `make api` before retrying verification; these were preview-environment availability failures, not asserted app passes.
- Retry verification passed: 2,377-page static build (expected local artifact-origin warning); headless checks at 1440px and 390px asserted the complete section order, a single highlights section and working rank expansion, with no overflow/page errors. A town without a reading also remained usable. Restarted localhost preview. No deployment.

## Follow-up: omission warning and inline input prompts

- Returned the yellow strip to a `Not included` warning about costs excluded from the monthly owning estimate, removing the input instructions there. Highlighted the existing `add yours if it applies` prompts beside missing conditional cost rows inside the owning card.
- The warning includes missing required estimates as well as optional fees/flood insurance, and always discloses the excluded earnings on the down payment. Entering conditional costs removes them from the warning and removes their prompts. Calculations are unchanged; insurance/upkeep already included in the estimate are not described as missing.
- Verification: `npm run typecheck`, `npm test` (43 files / 399 tests), and `git diff --check` passed. Headless checks at 1440px and 390px found two highlighted prompts, the intended warning, no horizontal overflow and no page errors. Entering $100/month HOA fees and $600/year flood insurance removed both prompts and left only the down-payment earnings warning.
- One additional browser assertion initially timed out because the QA script used the wrong warning selector; the corrected `.cost-evidence-omissions` check passed. Static build passed with 2,377 pages and the expected local artifact-origin warning. No deployment or reading regeneration.

## Follow-up: chapter hierarchy and repository-link placement

- Main local-page headings now use larger display type, an accent mark and a subdued separator: owning/renting costs, household, home checks and local market. The standout card retains its original surface and attribution with matching heading hierarchy. `Explore the evidence` becomes a readable chapter heading above its existing expandable card. Subsection/table headings remain smaller; no content is moved or hidden.
- Scoped the hierarchy to the local-page standard-content container, leaving report and detailed-table heading styling unchanged. Retained theme-aware colors and responsive sizing. The shared masthead GitHub link now immediately follows Housing; its destination, accessible label and new-tab behavior are unchanged.
- Verification: typecheck, 43 test files / 399 tests, static build (2,377 pages; expected local artifact-origin warning), and diff whitespace checks passed. Headless desktop/mobile checks at 1440px, 390px and 320px verified no horizontal overflow and the repository link beside Housing. Browser QA caught an initial selector that missed the standard-content wrapper; corrected selectors verified 34.4px desktop and 25.6px mobile chapter type with a 3px accent. No new dependencies, canonical-document changes, readings regenerated or deployment.

## Follow-up: compact navigation and theme transition

- Short navigation labels use compact uppercase monospace type with modest tracking. Search stays in normal case and the JL/Housing/GitHub trail remains unchanged. Tightened masthead padding/gaps and the profile-to-cost-section gap, without hiding page context or changing the title.
- Manual theme changes use a 240ms native view-transition crossfade; a small pressed-icon motion reinforces the control. Reduced-motion readers and browsers without the API change themes immediately. Existing system-following and stored-preference behavior is unchanged. No broad per-element transitions or new animation dependencies.
- Recommended a single section-jump selector beside the page shortcuts instead of individual section buttons. This remains a proposal, not implemented in this follow-up.
- Verification: typecheck, 43 test files / 399 tests, diff whitespace checks and static build (2,377 pages, expected local artifact-origin warning) passed. Headless browser checks at 1440px, 390px and 320px confirmed both theme directions, reduced-motion switching, uppercase navigation, no horizontal overflow and no page errors. Masthead heights were about 55px desktop and 101px mobile. No deployment or reading regeneration.
