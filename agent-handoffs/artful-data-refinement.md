# Artful data refinement

Branch: `experiment/artful-data-refinement`, created from clean `main` at `2312f64`
with explicit owner approval. Frontend presentation only; no refresh, model generation,
canonical-document edits, merge or deployment.

## Owner review — data-portrait experiment reverted

The owner rejected the follow-up data portraits and deep-green local-picture surface.
Commit `3c1f360` was reverted with a normal revert commit, preserving history and the
initial abstract styling in `4b06162`. Vacancy mosaic, county constellation, stock-flow
graphic and cost-composition ring are no longer in the branch. The original cost bar,
local-market disclosure and local-picture surface are restored. Alternative visual
directions were initially discussion only. The owner subsequently approved all three
replacement directions described below.

## Approved replacement direction

Historical implementation below: subsequent owner review removed the cost ribbon.
The current state is documented in the next section.

- The owning panel's existing bar is replaced by a shallow cost ribbon, not another
  chart card. Interest and bills split from principal; band end thickness follows the
  existing unrounded included amounts. Existing totals, omissions and breakdown stay.
  A 700ms reveal plays once in view; reduced motion and print stay static. No extra controls.
- The light local-picture surface is retained. Desktop has a computed renter-burden
  margin annotation beside the unchanged AI prose; mobile uses a compact strip below.
  The annotation explicitly identifies itself as computed, uses ACS survey dates and
  a 90% margin from the summary, and is omitted if the metric or reading is absent.
- Household curves, a decorative stepped local-market silhouette and evidence lattice
  share an architectural motif. These encode no values and remain aria-hidden and
  pointer-transparent. Disclosure hover/focus gives a restrained response, disabled
  for reduced motion. No new standalone sections, dependencies or source fetches.
- Modules: `CostRibbon.tsx` and tests, `CostToOwn.tsx`, `ExplanationPanel.tsx`, region
  page, `AbstractField.tsx` and tests, `QuietCounty.tsx`, `artful-data.css`.
- Earlier reverted mosaic/constellation/stock-flow/donut remain absent. No model text
  regeneration, new metrics, source refresh or canonical-document changes.
- Replacement verification: 475 tests in 61 files, TypeScript and 2,379-page static
  export passed. Three ribbon tests cover proportional end thickness, input updates
  and missing/zero inputs; architecture motif has its own decorative-accessibility test.
- Desktop and mobile screenshots inspected on county 20: annotation becomes a compact
  source-labelled strip, and the owning graphic stays inside the existing panel.
- Existing local artifact-origin warning remains unchanged; the preview is not deployed.
- Development and static browser checks passed across five routes, 1280/390/320px,
  both themes, expanded disclosures, mobile axe and print. The script now asserts
  the ribbon replaces the bar and the rejected graphic sections remain absent.
- A browser check exercised the in-view reveal and changing reduced-motion preference
  after reveal. It caught a specificity issue in the initial override; the corrected
  override stops animation immediately. Artwork never encodes fabricated data motion.

## Latest owner refinement

- Cost ribbon rejected and removed, including its component, tests and animation CSS.
  The original owning breakdown bar is restored. At that stage, a monthly-cash
  difference bridge was only a suggestion; subsequent approval is recorded below.
- Household/buying-plans surface now uses warm stone, neutral borders and a muted
  bronze local accent rather than the neighboring cards' green treatment.
- Editorial metric was hard-coded to renter burden. It now rotates among available
  renter burden, homeownership and vacancy readings from the existing packet every
  12 seconds. These are computed context, not model-selected highlights. Missing
  metrics are skipped; no extra API fetch or generation. Every item retains its own
  ACS period and 90% uncertainty from the summary.
- `EditorialMetrics.tsx` includes manual previous/next, explicit pause/play, separate
  hover/focus pause states, hidden-document pause and reduced-motion static behavior.
  Automatic updates are not announced by a live region. Source labels remain visible.
- Only one statistic occupies the margin area at a time; mobile uses the existing
  compact strip. No new standalone chart or card. Architectural artwork is retained.
- Latest verification: 474 tests in 61 files and TypeScript passed; static build
  produced 2,379 pages. Carousel tests cover 12-second cadence, reduced motion,
  manual navigation, hover pause and explicit pause. Development browser checks
  passed all 30 route/width/theme combinations with mobile axe and print checks.
- County 8 browser interaction verified metric changes, 12.5-second explicit pause,
  restored original bar and mobile reflow. Mobile screenshots inspected for the
  vacancy slide and warm-stone household section. No canonical documents changed.
- Final static-preview check also passed all 30 route/width/theme combinations,
  mobile axe and print, with assertions that the ribbon and earlier rejected graphs
  remain absent. Existing local artifact-origin warning remains; no deployment.

## Difference bridge and clearer exclusions

- Owner approved the monthly-cash difference bridge. It replaces the headline prose
  on quiet county/municipality pages, without adding another panel. Two numeric
  anchors show owning money spent and rent; the center preserves the computed
  more/less/about-the-same verdict. Decorative arches have no data encoding.
- Uses existing `goneAgainstRent`, spending excluding utilities, rent and principal;
  no new arithmetic, threshold, defaults or source data. Utilities are explicitly
  excluded from both; missing owning costs and separately paid-down principal remain
  visible. Missing rent retains existing behavior; nonquiet/report copy stays intact.
- Not-included notice has a stronger yellow surface, amber top edge and emphasized
  label in both themes. Prose list now lowercases initial title-case letters but
  preserves initialisms such as HOA. Capitalized Flood insurance originated in the
  shared calculator field label; form and breakdown labels are intentionally unchanged.
- Files: `DifferenceBridge.tsx` and tests, `CostToOwn.tsx`, `artful-data.css`.
- Verification: 478 tests in 62 files, TypeScript and 2,379-page build passed. Four
  tests cover verdict rendering, source amounts, principal separation, decorative SVG
  accessibility and sentence case preserving HOA. County 8 mobile dark screenshots
  inspected; lower-case flood insurance confirmed in rendered notice. No canonical
  documents, dependencies, acquisition or model regeneration changed.
- Development and final static-preview suites passed all 30 route/width/theme
  combinations, mobile axe and print. Existing local artifact-origin warning remains.

## What changed

- Neutral white/ivory (dark) and readable neutral ink (light) United States breadcrumbs
  restored on property tax lookup, source freshness and figure-change pages.
- Expanded evidence footnote markers use secondary text color instead of chart green;
  links, targets and focus behavior are retained.
- Household planning, local-picture, local-market and evidence entry sections echo the
  housing profile's abstract visual language. Overlapping house/circle linework,
  contours and a curved lattice accompany subtle washes and softened edges.
- Artwork is static, decorative, hidden from assistive technology, nonfocusable,
  pointer-transparent and absent in print. No new text, dependencies or scrolling
  sections. Existing data, calculations, AI text, definitions and disclosures remain.

## Files/modules affected

- `web/components/AbstractField.tsx` and its tests: reusable decorative SVG variants.
- `web/components/QuietCounty.tsx`: motifs in existing experimental section wrappers.
- `web/components/MoreExpander.tsx`: evidence motif, hidden unless styled by quiet layout.
- `web/app/artful-data.css`, imported last from `web/app/layout.tsx`: narrowly scoped
  color fixes, artwork positioning and responsive treatment.
- `web/scripts/check-artful-data.mjs`: repeatable local/production browser verification.

## Architectural or implementation decisions

- CSS and repo-native SVG, not bitmap assets, canvas or another animation dependency.
  These forms do not encode data, scales, uncertainty or geographic boundaries.
- Reused native disclosures without replacing their keyboard or persistence logic.
- Existing quiet-layout accent tokens preserve local green and statewide blue. Color
  restoration is targeted to national breadcrumbs on tax/history, not a global reset.
- No clipping wrapper was added: definition popovers and focus outlines remain available.
- Background dimensions explicitly reset to avoid inheriting the old evidence grid's
  24px repetition, which otherwise tiled the new wash like a checkerboard.

## Assumptions

- Approval covered this bounded UI experiment; it did not authorize new data features,
  broader redesign of the cost calculator, Director Notes or changes to canonical docs.
- The existing housing portrait remains the reference. Mobile decoration is quieter
  and smaller; section copy retains its existing wrapping rather than shrinking type.

## New TODOs / limitations

- Owner aesthetic review remains necessary; this is an experiment, not a methodology change.
- Browser coverage uses Somerset county and municipality route 194 as representative
  shared layouts, plus tax/freshness/changes. It does not inspect every municipality.
- Production build warns `NEXT_PUBLIC_ARTIFACT_URL` is unset: local export download links
  resolve to localhost. This export is for preview, not deployment.
- No lint script exists in `web/package.json`; TypeScript and tests run instead.
- Existing Next.js 16.3.5/dependency findings were not patched in this UI task.

## Verification

- `npm test`: 471 tests passed in 60 files, including five new artwork/disclosure tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; 2,379 static pages. No acquisition or regeneration performed.
- `node scripts/check-artful-data.mjs`: development checks passed across five routes,
  1280/390/320px, light/dark, expanded disclosures, breadcrumb/footnote colors,
  mobile axe checks and browser-error assertions.
- `ART_ORIGIN=http://localhost:3002 node scripts/check-artful-data.mjs`: passed the
  same 30 route/width/theme combinations on the final static export, including a
  strengthened non-vacuous print check on a county containing artwork. No axe
  violations or browser runtime errors were reported.
- Screenshots inspected for desktop light household/local-picture/evidence and mobile
  dark local-picture/evidence. Art does not add layout height or occlude controls.
- `git diff --check`: passed before commit.
