# Quiet housing frontend experiment

The sections below record the local design iterations in chronological order. Later sections supersede earlier presentation and scope descriptions. The final scope includes counties, municipalities, New Jersey, the national entry, source history, property tax lookup and the shared theme control; ZIP and report layouts are unchanged. The owner authorized committing and opening a PR after local review. No deployment or merge is authorized.

## What changed

- A local-page redesign combining editorial typography with the familiar `main` structure: original title context/population/paycheck indicators and shortcuts, an abstract still housing portrait above costs, lighter joined owning/renting cards, restrained serif place/highlight titles and expandable tools. No sidebar or dark cost panel. The previous exploratory stylesheet layers were replaced by one focused hybrid stylesheet.
- A still housing snapshot replaces the animated county ticker. Income, renter burden and typical year built lead; remaining existing profile measures open below. Definitions, margins and plausible rank ranges remain available.
- Owning/renting monthly totals stay side by side, including on mobile. Cost components and source detail open separately; mobile expands to a full-width layout when a breakdown opens.
- Monthly cash comparison, exclusions, partial-estimate labels and rental comparability caveats remain visible. Budget-fit inputs and longer-term cost scenarios are expandable.
- The AI-written local picture remains labelled as AI and retains citations/staleness warnings. Household tools, paycheck comparisons, property checks and local market features become native disclosures. Tables, charts and downloads remain in the existing evidence expansion.
- Scope expanded at the owner's request: every county and municipality receives the local portrait layout; New Jersey receives a blue statewide variant, the national entry a warm atlas treatment, and source history a matching ledger. ZIP and report layouts remain unchanged.

## Files/modules affected

- `web/components/QuietCounty.tsx`: presentation wrappers and still profile.
- `web/app/quiet-county.css`: scoped local/state/national/history/tax presentation, responsive and print rules.
- `web/app/regions/[id]/page.tsx`: county and municipality layout composition; original header retained and original paths retained for ZIPs.
- `web/components/SectionJump.tsx`: resolves the experiment's cost/highlight wrappers and opens native disclosure ancestors when jumping to a folded tool.
- `web/components/CostToOwn.tsx`: optional `quiet` presentation variant; existing formulas and defaults unchanged.
- `CostToOwn.householdTools`: server-rendered household content composed into one county-only buying-plans group, without duplicating or changing the income/calculation stores.
- `web/app/layout.tsx`: loads the scoped experiment stylesheet.
- `web/app/states/new-jersey/page.tsx`: blue still-profile composition, existing statewide overview/workspace/evidence retained.
- `web/app/page.tsx`, `web/app/freshness/page.tsx`, `web/app/changes/page.tsx`: national atlas hero and matching source-history ledger presentation.
- `web/components/StateOverview.tsx`, `StateModeWorkspace.tsx`, `StateFigureNotes.tsx`, `CountyExplorer.tsx`: compact statewide composition, grouped navigation, hash-aware collapsed notes and responsive county preview.
- `web/components/HomeSales.tsx`, `web/components/HomesAdded.tsx`: optional county portrait variant for dated sales figures and annual net-addition bars; default/report presentation unchanged.
- `web/app/tax/page.tsx`, `web/components/TaxLookup.tsx`: search-first tax presentation and secondary town filter.
- `web/components/ThemeToggle.tsx`, `web/app/redesign.css`: eclipse icon and viewport theme reveal.

## Architectural or implementation decisions

- Native details/summary for disclosures rather than a new tab system or additional animation. Server-rendered content stays in the document and is available before hydration.
- Presentation changes only: no API, warehouse, source, ranking, ownership methodology or model-reading regeneration.
- Reduced-motion behavior is respected; the county snapshot has no motion at all. Reports retain their original presentation.
- Profile ranks name counties and preserve uncertainty ranges. Survey margins remain adjacent to values; definitions retain their dates and sampling explanation.

## Assumptions

- This is exploratory work on `experiment/quiet-county-page`, now approved for a review PR, not deployment or merge.
- Progressive disclosure is appropriate for detailed tools; visible prices still carry exclusions and comparison context.
- Existing source licence notices remain unchanged and visible, even where they make the bottom of the page longer.

## New TODOs / limitations

- Review remains required before merging; rollout already includes the explicitly requested page types listed above.
- More disclosure clicks trade against less initial visual load. Mobile cost rows stack when a breakdown opens so labels remain readable.
- Owner has authorized commit, push and PR creation. No deployment or merge. Canonical documents unchanged.
- Existing local export warning about an unset artifact URL is unrelated and remains; deployed builds must set their published artifact origin.

## Verification

- Headless Chromium at 1440px light, 390px light and 320px dark: no page errors or horizontal overflow in the initial and expanded cost views; opening ownership breakdowns, household tools and evidence tables succeeded.
- On the same widths, Montgomery retained its existing municipality ticker and section navigation, with no quiet-county class.
- Inspected full-page desktop/light and mobile/dark screenshots. Corrected a legacy evidence-entry color/grid inheritance issue during visual QA.
- `npm run typecheck`: passed. `npm test`: 424 tests passed across 47 files.
- `npm run build`: passed, 2,379 static outputs; static generation took 71 seconds. Existing unset-artifact-origin warning remained.
- `git diff --check`: passed. Changes remain uncommitted and local at the owner's request.
- Second direction (CSS-only iteration): TypeScript, all 424 tests and diff check passed again. Chromium at 1440px light, 390px light and 320px dark confirmed no page errors/overflow and working ownership disclosures. Full-page desktop/mobile screenshots inspected. Production export above verified the first direction's shared implementation; not rerun for the subsequent stylesheet-only iteration.
- Third direction: TypeScript and all 424 tests passed. Desktop sidebar stayed at 110px while scrolling; mobile costs preceded the housing profile. Initial, expanded ownership and evidence checks passed at 1440px light and 390px light. A 320px expanded current-value table overflow was found and corrected with scoped fixed table widths/wrapping; decorative rank ticks are omitted at narrow widths but written ranks and uncertainty ranges remain. No model prose or formulas changed. Production export not rerun for this local iteration.
- Hybrid direction: TypeScript and all 424 tests passed; browser checks at 1440px light, 390px light and 320px dark verified population/paycheck indicators, cost jump navigation, ownership disclosure and evidence tables with no errors or initial/expanded horizontal overflow. Desktop screenshot inspected. Additional section-jump logic now reveals folded tool ancestors before focusing. Production export not rerun for this local iteration.

## Hybrid visual-polish follow-up

- Header shortcuts now align below the introduction rather than floating right; the population badge is neutral and subordinate.
- Sage is reserved chiefly for the still housing profile. Cost cards are white with a neutral monthly-cash strip and faint amber exclusions; the AI interpretation is neutral with its original attribution/citations intact.
- Both monthly figures align on desktop and mobile. Supporting type uses normal sentence case with fewer monospace/uppercase labels.
- Budget fit, upfront/longer-term scenarios and household income/housing-help tools are grouped under “Your household & buying plans.” Repeated subtitles were removed; opening the budget row exposes its fields directly.
- Added breathing room before local highlights, constrained interpretation reading width and reduced the excess transition into the source footer. All source notices remain visible and unchanged.
- Browser checks: desktop/light, 390px/light, 320px/dark; no page errors or initial/expanded horizontal overflow; shared income settled to 120000 in both tools; shortcut opened the folded household section; monthly costs remained $5,399 and $2,665. Mobile figure tops matched exactly after correcting an inherited border. Initial scripts read the synced input too early; awaiting the React update confirmed both mobile sizes passed.
- Inspected desktop full-page screenshot. Final polish verification: `npm run typecheck` passed; `npm test` passed all 424 tests across 47 files; `npm run build` passed with 2,379 static outputs (static generation 24.3 seconds). The existing unset-artifact-origin warning remains. Local preview restored on port 3000; work remains local and uncommitted.

## Hierarchy and interaction refinement

- Subordinated header metadata, tightened comparison-to-price spacing and increased separation from the housing profile. No figures, formulas or model prose changed.
- Moved the complete property-check section into the county household-tool group, once only. Non-county placement is unchanged; counties without cost inputs retain the checks with their fallback household tools.
- Gave property checks a checklist cue, local market a quieter left rule, and evidence a distinct hover treatment. Added consistent summary hover/focus treatment, minimum 44px disclosure targets and short content-entry animations, disabled for reduced motion.
- TypeScript and all 424 tests across 47 files passed. Chromium at 1440px, 390px and 320px confirmed one property-check section inside tools, no page errors or horizontal overflow, and reduced-motion animation disabled. A non-county route retained its original checks without the county experiment class. Inspected the expanded mobile screenshot. `git diff --check` passed.
- Production build passed with 2,379 static outputs (static generation 25.5 seconds); existing unset-artifact-origin warning unchanged. All work remains local and uncommitted.

## Abstract housing portrait

- Replaced the enclosing sage profile card with an asymmetric, softly washed typographic composition. Income leads; renter burden and housing age share the other column, with compact mobile reflow.
- Renter burden has 100 decorative dots, filled to the nearest whole percentage from the displayed value; only valid percentage strings receive the pattern. Exact values and uncertainty remain visible. Architectural SVG linework is decorative, not a depiction of actual local buildings. Both graphics are hidden from assistive technology.
- Definitions, rank ranges and the additional-metrics disclosure remain intact. No continuous animation or new dependency. County-only, local and uncommitted.
- TypeScript, all 424 tests and diff checks passed. Chromium at 1440px/light, 390px/light and 320px/dark showed no page errors or overflow, including expanded metrics; Somerset retained $140,374, 49.0%, 1983 and 49 filled dots. Desktop and mobile profile screenshots inspected.
- Production build passed with 2,379 static outputs (generation 26.2 seconds), with the existing artifact-origin warning unchanged. Restored localhost preview afterward.

## Recurring abstraction in lower sections

- Added a thin payment receipt below the existing owning component bar: money gone and equity kept use the existing monthly calculation, not new arithmetic assumptions.
- Added faint architectural linework at the interpretation's outer edge, topic-only flood/water/tax symbols, and a subtle technical grid on the closed evidence entry. Decorative SVGs are hidden from assistive technology. Household form controls and source notices remain plain.
- County local market now highlights qualifying sales count and median with each figure's own date range. An optional annual net-additions chart reuses the construction table's rows, keeps missing values explicit and marks preliminary years. Positive/negative bars share an absolute scale around zero; exact values remain written, and existing coverage/source caveats and tables remain present. No new dependencies.
- TypeScript, 424 tests and diff checks passed. Chromium at 1440px/light, 390px/light and 320px/dark: expanded checks and market had no page errors or page overflow. Somerset showed 3,793 qualifying sales and $570,000 median (Jan 2024–Jun 2026), receipt $4,964 gone/$435 equity. Focused mobile market and interpretation screenshots inspected. An initial screenshot script selected nested summaries ambiguously; corrected to the outer summary and reran successfully.
- Live visual QA used Somerset's positive annual net values; synthetic negative/missing chart fixtures have not been separately exercised. Existing construction-data tests passed. Production build passed with 2,379 static outputs (generation 24.9 seconds), existing artifact-origin warning unchanged. Local preview restored afterward.

## County/municipality rollout and statewide variant

- Enabled the common layout for all municipalities as well as counties. Profile peer labels now use the packet's actual comparison level and metric-specific denominator. Sparse profiles fill the available composition rather than inventing missing metrics; absent model readings no longer leave stray decorative linework.
- New Jersey shares the restrained serif typography, asymmetric snapshot and evidence grid but uses cool-blue washes/accent. Supplementary statewide indices/tax figures form a still profile with a more-measures expansion, preserving dates, index baselines and definitions without invented state ranks. Existing map, county tables, budget mode and statewide notes remain functional. SectionJump recognizes the new state profile.
- HomeSales/HomesAdded portrait presentation is used in the statewide evidence too. Reports, ZIP and national entry are not redesigned. Local-only and uncommitted.
- All 21 county pages checked for the new profile. Montgomery, Parsippany and sparse Walpack, plus New Jersey checked at 1440px/light, 390px/light and 320px/dark: no page errors or initial page overflow. Expanded state profile remained within 320px. Verified NJ map loads on visibility and switching to budget mode and back works. Inspected NJ desktop/map and municipality mobile screenshots. Narrow cost heading/control spacing refined.
- TypeScript, all 424 tests and diff checks passed. Production export passed with 2,379 outputs (generation 25.7 seconds), existing artifact-origin warning unchanged. The subsequent tiny-screen heading CSS adjustment was checked in the restored dev preview rather than a second production export.

## Reduced-scroll New Jersey follow-up

- Combined supplementary statewide measures into one closed expansion inside the snapshot. Three headline figures share a desktop band; mobile keeps two columns plus a full-width building figure. Grouped map heading, mode controls and jump selector, and removed the redundant comparison introduction.
- Kept the concise measure definition visible; longer window notes are expandable. Mobile measure controls use a two-column grid with the window selector below, retaining 44px targets.
- Mobile county table previews the first five in the selected ranking plus any selected county outside that set; a button reveals all available counties. Desktop keeps all rows visible. No metric/rank calculations changed.
- Statewide caveats are closed by default; the snapshot footnote and its deep link reveal and scroll to them. Notes and supplementary figures remain visible for print.
- TypeScript and all 424 tests passed. Chromium at 1440px/light, 390px/light and 320px/dark confirmed desktop 21 rows, mobile five rows/21 after expansion, no page errors or overflow, six supplementary figures and working footnote/deep-link reveal. Corrected inherited mobile snapshot grid styling during visual review.
- Initial browser runs failed because both preview/backend were stopped; restarted API and then restarted Next to clear a cached rejected request. This was local runtime recovery, not a code change. Production export passed with 2,379 outputs (generation 26.0 seconds), with the existing artifact-origin warning unchanged. Preview restored afterward. Profile shortcut and mobile budget mode verified too.

## National landing and source-history theme

- Extended the approved typography/composition to the US landing with warm-neutral colors, decorative atlas linework, the existing concise tagline/free-use promise, quieter map/gallery treatment and large mortgage benchmark. New Jersey stays blue and is still the only available destination. Existing zoom, pan, transition/navigation and coverage caveats retained.
- Source freshness and revised-figures pages use a restrained ledger, serif headings, understated tracked-source/revision-refresh counts and reciprocal navigation. Freshness date explanations live in a native disclosure; cadence groups, all table columns, status definitions/colors, NJ source highlighting and revision methodology notes remain available. No backend or metric calculations changed.
- Existing masthead budget link is preserved. The current masthead uses a global NJ-budget link rather than the retired affordability toggle; no disabled-toggle claim is made.
- TypeScript and all 424 tests passed. Chromium at 1440px/light, 390px/light and 320px/dark checked all three routes: no page errors or page overflow; five freshness tables and twelve revision tables retained in this snapshot. Desktop national/freshness and mobile national/revision screenshots inspected. Verified national map zoom, NJ entry navigation, date disclosure and history-page navigation. Production export passed with 2,379 outputs (generation 25.3 seconds), existing artifact-origin warning unchanged. Diff check passed; local preview restored.

## Project-first landing identity

- Root title and route metadata now lead with Housing Intelligence; United States is map context, not the project's identity. Kept the approved tagline and free-use/no-ads promise; source-backed description remains concise.
- Replaced decorative globe lines with abstract domestic architectural linework (not a measured diagram or local skyline). Marked the NJ entry as detailed coverage available now, and reduced the national mortgage benchmark to a supporting strip with date/source/definition and lender-quote caveat intact.
- TypeScript, all 424 tests and diff checks passed. Chromium at 1440px/light, 390px/light and 320px/dark confirmed project-first h1/browser title with no page errors or overflow. Desktop/mobile screenshots inspected. Mobile map loading and NJ entry verified. Production export passed with 2,379 outputs (generation 27.2 seconds), existing artifact-origin warning unchanged. Preview restored.

## Search-first property tax lookup

- Tax lookup now has a centered serif search-engine introduction, warm ochre accent, one prominent address input and restrained result rows/parcel detail card. Detailed introduction is expandable; assessment arithmetic, source context, owner privacy notice and removal contact remain unchanged.
- Town selection is secondary in a native disclosure. Block-and-lot input and town-page links open it automatically; an explicit clear-filter control returns to statewide address search. Existing address parsing already accepts inline town/ZIP hints; these prioritize candidate towns, whereas the optional selected town is a strict filter. Block-and-lot still requires a town because identifiers repeat statewide. No new parser or dependency.
- Real-record Chromium checks at 1440px/light, 390px/light and 320px/dark found and opened 100 Community Dr in Montgomery. No page errors or overflow; narrow result rows were corrected to wrap. Verified block-and-lot disclosure, Montgomery URL prefill and clearing the town filter. Inspected mobile blank-search and narrow dark result screenshots. An initial town-prefill test used textbox instead of the datalist input's combobox role; corrected and passed.
- Local API does not serve parcel exports; default lookup initially returned 404. Published storage is reachable but blocks localhost via CORS. Preview uses a temporary read-only localhost:8001 parcel relay to published JSON, with NEXT_PUBLIC_ARTIFACT_URL supplied only to the dev process; no checked-in runtime configuration or remote data was changed. The relay is not a production feature.
- Commands: npm run typecheck; npm test; npm run build with the published artifact origin; git diff --check; headless Chromium real-record/responsive checks. TypeScript, all 424 tests and diff checks passed. Final production export after narrow-layout/disclosure refinement passed with 2,379 outputs (generation 24.5 seconds). Work remains local and uncommitted on the existing experiment branch.

## Eclipse theme control

- Replaced rotating/crossfading separate sun/moon glyphs with one SVG eclipse mask: the cutout moves while rays retract/return. Preserved the destination-icon convention (sun on dark, crescent on light), accessible action label and stored/system theme behavior. Unique React mask IDs avoid SVG collisions.
- Added a subtle warm/cool interaction halo and brief orbital dot. Theme changes reveal the new viewport from the button center over 520ms, with radius calculated to reach the farthest viewport corner. No page geometry changes or new dependency.
- Repeated clicks skip the previous snapshot, await its palette update and then choose the opposite; transition cleanup is guarded by ownership. React state is flushed before snapshot capture. Unsupported browsers apply the theme directly; reduced-motion skips snapshots and icon motion.
- Files: web/components/ThemeToggle.tsx and web/app/redesign.css. No data, report, canonical documentation or backend changes.
- Verification: npm run typecheck, npm test (424/47 passed), git diff --check. Chromium desktop tax and mobile Somerset checks verified active reveal, cleanup, keyboard activation, six rapid clicks, no errors/overflow and stable initial scroll position. Reduced-motion started no theme reveal; unsupported-API fallback changed theme successfully. Inspected transition screenshot. Safari/Firefox and physical-device motion/performance have not been checked.
- Production export passed with 2,379 outputs (generation 23.7 seconds); local dev preview restored with the existing parcel relay. No commit or publication.
