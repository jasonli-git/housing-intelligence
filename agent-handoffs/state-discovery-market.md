# State discovery modes and practical summaries

## What changed

- Housing-help hybrid follow-up: restore three compact neutral resource cards with agency, link title and original explanation. Keep the single programme/inventory expansion and visible availability caveat; no outer enclosing card. Responsive stacked cards and reduced-motion-safe hover/focus treatment.
- Follow-up supersedes the visible sales/building previews: move full sales and construction sections into More statewide figures. Move Find your fit to the discovery section header, away from the search field. Housing help keeps three official links visible and one top-level programme/inventory disclosure. Historical price-to-income context is an open, blue-toned graph exhibit with concise headline, visible estimate margins and no-forecast warning; complete rank/spell/method text remains in supporting methodology. County presentation is unchanged.
- Find your place now offers Explore places / Compare counties buttons. Comparison takes over the same card, rather than requiring a separate expansion. Mounted hidden panels preserve query and comparison selections across switches.
- Moved sales, building, historical affordability and housing help out of statewide evidence. Evidence now focuses on the complete figure table.
- Sales count and latest reported completions/demolitions provide concise visible previews; native details retain full existing sales and building components. Historical affordability has its own specifically labelled disclosure. Housing help displays official routes directly with lighter presentation, retaining eligibility/vacancy caveats and inventory disclosures.
- Section jump observes hidden-mode changes and includes the housing market section.

## Files/modules affected

- State route, StateModeWorkspace, CountyComparison, SectionJump, ui-refinement.css, responsive state check script.

## Architectural or implementation decisions

- Existing data and methodology only; no new metrics or generated text. Comparison embedded mode retains independent disclosure behavior for any other consumer.
- Latest construction preview uses constructionYears' newest row, labels preliminary figures, preserves null-as-missing and reporting-town scope. Sales count keeps its own observation period and property-class distinction.
- Both panels stay mounted; hidden panels leave keyboard navigation and accessibility tree. Buttons use aria-pressed/aria-controls, not incomplete tab semantics.
- Existing housing assistance anchor remains directly reachable outside evidence. Native market disclosures preserve full source details and caveats.

## Assumptions

- User approved relocation and specifically requested comparison mode in discovery on the existing experimental branch / PR #141.

## New TODOs / limitations

- More statewide figures now contains two supporting disclosures for sales/building. Housing-help inventory retains its existing internal controls and disclosures beneath the single top-level expansion; not flattened into one long table.
- More market content is discoverable by default, adding some height compared with hiding all of it in evidence; detailed tables/charts remain collapsed.
- No persistent URL parameter for comparison mode. Existing legacy affordability redirect remains unchanged.
- Local API had stopped; restarted it for verification. Local build artifact URL remains localhost:8001 and must not be deployed.
- No canonical documentation changes or production deployment.

## Verification

- Hybrid resource-card follow-up: typecheck, all 568 tests/82 files, 2,386-page build, six responsive state WCAG/interaction checks and `git diff --check` passed. Reviewed `/tmp/nj-help-hybrid.png`; original agency/description text restored, with three cards above one main expansion.
- Consolidation/exhibit follow-up: typecheck, 568 tests across 82 files (three new exhibit guardrail tests) and final 2,386-page static build passed. Updated responsive script passed all six states, checking moved shortcut outside search card, three visible help links/one top-level expansion, open graph, relocated sales/building, mode state retention, keyboard/reflow and expanded-content WCAG. Reviewed dark exhibit screenshot `/tmp/nj-history-exhibit.png`. `git diff --check` passed. No production deployment or canonical documentation changes.
- `npm run typecheck`: passed. `npm test`: 565 tests across 81 files passed.
- Final `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build`: passed, 2,386 static pages. Initial attempt failed because the local API had stopped; restarted via uvicorn and rebuilt successfully.
- Updated `check-state-refinement.mjs`: six width/theme combinations passed (1280/390/320px, light/dark), checking Explore/Compare visibility and preserved measure selections, section-jump mode updates, 21 links, relocated help routes, no practical modules inside evidence, keyboard disclosure opening, populated tables, reflow, no JS errors and WCAG-tagged audits with details open.
- Initial mobile audit exposed evidence-kicker hover contrast of 4.18:1; corrected scoped light/dark label colours, rebuilt and reran successfully.
- Reviewed desktop dark and mobile light full-page screenshots. `git diff --check` passed. No backend tests for presentation-only changes; no separate frontend linter configured.
