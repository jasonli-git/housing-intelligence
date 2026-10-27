# Place-page information hierarchy — local Princeton prototype

## Approved follow-up: visual market portrait — 2026-10-27

Replaces the text-led prototype rather than adding another section. The opening
paragraph and numbered ranking text are no longer in the portrait; the original
deterministic headline remains available inside More market context. Primary dates,
price/rent definitions, coverage and survey uncertainty stay visible.

### What changed

- Home-value and rent distributions plot actual dollars, not ranks or percentiles.
  Each dot represents one municipality. Princeton stays highlighted while hover,
  touch or arrow keys select another town; Compare carries both ids into the existing
  comparison page. A dashed marker names the median across the plotted town values,
  not an official statewide median across homes. Vertical dot offsets separate marks;
  they encode no additional variable. Towns are not weighted by homes or population.
- Two historical lines use existing monthly observations. Scrub with mouse/touch or
  arrow keys; exact dated values remain readable. Lines break across missing months.
  Growth badges appear only when the displayed series and packet change agree on
  starting/ending dates and values. Figures are explicitly nominal dollars.
- A single, directly labeled owner/renter split replaces the tenure paragraph. It
  retains the occupied-home denominator, ACS period and 90% margin.
- No autoplay, new disclosures, new sources, ingestion or backend changes. Cost
  controls/reset and the rest of the page are retained. Still Princeton only.

### Files and implementation

- `PlaceMarketOpening.tsx` / `.module.css`: composition, visible qualifications and
  tenure bar; server-rendered primary evidence with scoped styles.
- `MarketPortraitCharts.tsx`: small client islands for town selection and history
  scrubbing. No browser fetch; keyboard sliders expose exact names, dates and values.
  The complete charts and starting readings are present in static HTML.
- `lib/marketPortrait.ts`: pure same-month matching, historical binding and gap-aware
  SVG paths. Nonfinite/missing values are not turned into zero; duplicates fail loudly.
- `lib/marketPortraitData.ts`, `lib/api.ts`: build-time reads from existing `/regions`
  and date-bounded `/compare` endpoints, in batches of at most 100 town ids. Reject
  registry truncation; withhold a cohort if a batch is absent. No new API endpoint.
- Place route: request these cohorts only inside the existing Princeton prototype guard.
- Tests: `PlaceMarketOpening.test.tsx`, `lib/marketPortrait.test.ts`,
  `lib/marketPortraitData.test.ts`, and extended `check-place-hierarchy.mjs`.

### Coverage finding

For September 2026, the API supplies 388 of 564 NJ town home-value indexes and 190 of
564 rent indexes. The old latest-value rent ranking used 238 towns with differing
latest months. Its numbers cannot form a same-date distribution. This portrait
therefore displays **190**, not 238, for September rent coverage. Each metric uses its
own exact displayed month; the cohort size can change on a later build. Names that
repeat across counties include their county where the registry resolves one.

### Verification and limitations

- Final frontend suite: **801 tests in 134 files passed**; TypeScript passed; five
  publication tests passed. Added guards for period/source/value alignment, missing
  history, gaps, invalid values, duplicate months, batch completeness, keyboard
  selection, revision marks and tenure uncertainty.
- Scoped production build (place-page dynamic route, guide, compare, search/state
  JSON routes): passed, generating 1,189 static routes. Not a full `make publish`.
- Development and built-static checks: ten width/theme cases each at
  320/390/768/1024/1440px, light and dark. Distribution selection, history scrubbing,
  touch, keyboard, costs/reset, no overflow, scoped axe and no page errors passed.
- Three negative route checks per run retain the original Mercer County, ZIP 08540
  and Hoboken openings. Comparison click-through/back passed; an additional check
  loaded both actual comparison packets (Princeton and Deal) in development/static.
- No-script checks passed for primary figures, four server-rendered charts and the
  tenure bar in both environments. Interactive selection still requires JavaScript;
  source/report links remain available.
- Visual review: 390px dark and 1440px light portrait captures. Tight rent-axis labels
  now use exact dollars rather than rounding both bounds to `$3k`.
- `git diff --check`: passed. Initial focused tests needed updating for the new props,
  duplicate headline/selected-readout values and visual copy; final suite passes.
- This reduces paragraph reading, not necessarily height: four plots occupy more
  vertical space than the preceding text prototype, especially on phones. No claim
  that reader comprehension improved; matched reader testing is still outstanding.
- No production, physical-device, assistive-technology or full-report print audit.
  No remote push, PR or deployment. Handoff sections below describe the first version
  and are retained as experiment history, not the current portrait specification.

## What changed

Implement the owner's local-build approval for the Director Note recorded 2026-10-27.
The note's hypothesis remains unvalidated; its exploratory status is not a claim that
this ordering is better for readers. No Director Note or canonical document was edited.

Princeton now opens with a visible **The housing market** section before the existing
monthly-cost model:

1. The existing deterministic market headline, formerly inside a closed disclosure.
2. Typical home value and typical market rent, with dates, definitions, statewide
   rankings/cohort sizes and the existing five-year changes and windows.
3. Owner-occupied share, explicitly of occupied homes, with ACS survey years and
   its 90% sampling margin.
4. A direct jump to monthly costs and a link into the buyer's guide. The existing
   Compare-this-place action remains in the header.

The original supporting market text stays available in **More market context**.
The moved headline is not duplicated there. The section navigator gains **Market at
a glance** and distinguishes **Market exhibits** further down the page.

All monthly costs, personal controls, reset behavior, housing context, exhibits,
evidence, source links and report capabilities remain in place. Homepage, specialized
tools, counties, ZIPs and other towns are unchanged.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: opt in Princeton, move the headline, insert the
  market opening and update its navigator labels.
- `web/components/PlaceMarketOpening.tsx`: server-rendered, disclosure-free findings
  composed from the existing packet, uncertainties and revision markers.
- `web/components/PlaceMarketOpening.module.css`: scoped, responsive presentation;
  two columns on wider screens, one readable column on phones. No new motion.
- `web/components/PlaceMarketOpening.test.tsx`: seven tests for interpretation,
  missing/stale data, sales fallback, dates, revisions and survey uncertainty.
- `web/scripts/check-place-hierarchy.mjs`: responsive browser regression for ordering,
  visible qualifications, section navigation, cost input/reset, overflow and axe;
  negative checks on three unaffected places.

## Architectural or implementation decisions

- Deliberately activate only NJ geoid `3402160900` (Princeton), not all towns or a
  county/state template. This is a temporary prototype guard, not new geography policy.
- Reuse existing `homePrice`, formatters, rank/uncertainty readers, dates and revision
  marks. No source acquisition, new analytics or warehouse writes.
- Home values are explicitly modeled, not sale prices/appraisals. Market rents are
  explicitly not what every existing tenant pays; utilities are separate.
- Statewide ranks identify each metric's actual cohort; they do not pretend to answer
  the nearby-place question. The existing Compare action provides that route.
- If a current market-rent index is missing, say so; do not substitute ACS gross rent.
  Keep existing recent-sales fallback rules for home prices, identify transactions and
  their full window, and reject stale sales rather than label them current home values.
- Only display a change alongside a level when its end matches the displayed period.
- Read the installed Next server/client and CSS guidance, and the CLI documentation for
  scoped builds. Keep this static/server-rendered; no new client data request or control.

## Assumptions

Visitor questions prioritized for this prototype:

1. What do homes and rentals typically cost, and what do those numbers mean?
2. How does the place compare with others? Use only the supported statewide cohort.
3. What changed, and during which years?
4. What kind of housing tenure is here?
5. What would this mean for my monthly budget?

The explicit approval authorizes local implementation despite the note's original
“Do not implement yet” wording. The owner asked to keep it local: no push, PR or deploy.

## New TODOs / limitations

- No human baseline/candidate reader study was performed. Baseline screenshots were
  captured before editing; automated checks do not establish comprehension or a
  reduction in confident misreadings.
- Review Princeton first, then try a contrasting/thinner-data town before considering
  rollout. Missing-data cases are unit-tested, not a second town's redesigned page.
- Trade-off: the monthly model starts lower. Measured locally at 390×1000, the market
  section starts around y=478 and monthly costs around y=1398; at 1440×1000 the starts
  are approximately y=393 and y=920. The navigator and direct cost link keep it a jump
  away. These are composition measurements, not targets or claims of user success.
- No new nearby-place benchmark is invented. A statewide rank is not a local price
  comparison, and the visible note says so.
- No claim of physical-device, production, full-site export or printable-report QA.
  The scoped build excludes report routes and the metadata icon route; it is not an
  asset-completeness check. Existing report code was not changed.

### Suggested matched reader tasks (baseline first, candidate second)

- Find Princeton's typical home value and say whether it is an actual sale price.
- Find market rent and explain whether it describes every existing tenant's bill.
- Describe the five-year change, its dates and the comparison group for each rank.
- Find the owner-occupied share and identify the survey period and uncertainty.
- Reach monthly costs, change a purchase assumption, reset it, and find the guide.

Record accuracy, navigation effort and confidence, not just time or visual preference.
Consider separate readers/counterbalancing to avoid the candidate benefiting purely
from a reader learning the baseline page.

## Verification

- `npm test -- --reporter=dot`: **788 tests passed in 132 files** (includes seven new
  market-opening tests). The first focused run caught a test expecting an abbreviated
  margin unit; corrected it to the existing formatter's `± 3.0 points` output.
- `npm run typecheck`: passed. An initial accidental invocation from the repository
  root reported no `package.json`; reran successfully from `web/`.
- `npm run publication:test`: five tests passed.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npx next build
  --debug-build-paths='app/[state]/[place]/page.tsx,app/guide/page.tsx,
  app/search.json/route.ts,app/states.json/route.ts'`: passed, including 1,188 generated
  static routes. This is a scoped production build, not `make publish` or a deploy.
- `node scripts/check-place-hierarchy.mjs`: passed ten viewport/theme cases at
  320/390/768/1024/1440px, light and dark. Verifies no primary disclosure, placement,
  cohort/date/definition visibility, sticky navigator, cost inputs and reset, no
  horizontal overflow, scoped axe and no page errors.
- `SITE_URL=http://localhost:3006 node scripts/check-place-hierarchy.mjs`: same ten
  cases passed against the built static output. Both runs also confirm Mercer County,
  ZIP 08540 and Hoboken retain their original opening.
- Visual review: desktop dark and mobile light; preserved baseline screenshots at
  `/tmp/hierarchy-before-390.png` and `/tmp/hierarchy-before-1440.png`. Capture after
  hydration to avoid transient fallback tooltips; settled mobile capture is
  `/tmp/hierarchy-clean-390.png`.
- `git diff --check`: passed.
- Local preview: `http://localhost:3002/nj/princeton`; read-only API on 8000 and
  existing-artifact preview server on 8093. No ingestion or live-warehouse test run.

Work remains on `experiment/place-page-hierarchy` locally for owner review.
