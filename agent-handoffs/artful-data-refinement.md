# Artful data refinement

Branch: `experiment/artful-data-refinement`, created from clean `main` at `2312f64`
with explicit owner approval. Frontend presentation only; no refresh, model generation,
canonical-document edits, merge or deployment.

## What changed

- Neutral white/ivory (dark) and readable neutral ink (light) United States breadcrumbs
  restored on property tax lookup, source freshness and figure-change pages.
- Expanded evidence footnote markers use secondary text color instead of chart green;
  links, targets and focus behavior are retained.
- Household planning, local-picture, local-market and evidence entry sections echo the
  housing profile's abstract visual language. Overlapping house/circle linework,
  contours and a curved lattice accompany subtle washes and softened edges.
- Background artwork is static, decorative, hidden from assistive technology, nonfocusable,
  pointer-transparent and absent in print. No new text, dependencies or scrolling
  sections in the initial pass. Existing data, calculations, AI text, definitions and disclosures remain.
- Follow-up approved data portraits: richer green local-picture surface; a 100-home
  vacancy mosaic with earlier/latest ACS estimates and a one-time in-view transition;
  a compact selectable county vacancy constellation; reported construction flow when
  the three totals reconcile; and a cost-composition ring using existing calculator inputs.

## Files/modules affected

- `web/components/AbstractField.tsx` and its tests: reusable decorative SVG variants.
- `web/components/QuietCounty.tsx`: motifs in existing experimental section wrappers.
- `web/components/MoreExpander.tsx`: evidence motif, hidden unless styled by quiet layout.
- `web/app/artful-data.css`, imported last from `web/app/layout.tsx`: narrowly scoped
  color fixes, artwork positioning and responsive treatment.
- `web/scripts/check-artful-data.mjs`: repeatable local/production browser verification.
- `web/scripts/check-data-portraits.mjs`: manual period selection, county tap-target
  separation, keyboard selection, cost selection and reconciled/suppressed stock cases.
- `web/components/DataPortraits.tsx`, its tests and `web/lib/dataPortraits.ts`: computed
  graphics, period/source gates, accessible buttons, rounded tiles and unrounded cost shares.
- `web/app/regions/[id]/page.tsx`, `web/components/CostToOwn.tsx`: shared county/town wiring.

## Architectural or implementation decisions

- CSS and repo-native SVG, not bitmap assets, canvas or another animation dependency.
  These forms do not encode data, scales, uncertainty or geographic boundaries.
- Reused native disclosures without replacing their keyboard or persistence logic.
- Existing quiet-layout accent tokens preserve local green and statewide blue. Color
  restoration is targeted to national breadcrumbs on tax/history, not a global reset.
- No clipping wrapper was added: definition popovers and focus outlines remain available.
- Background dimensions explicitly reset to avoid inheriting the old evidence grid's
  24px repetition, which otherwise tiled the new wash like a checkerboard.
- Data portraits are distinct from decorative SVG: visible captions identify the
  source, periods, uncertainty and limitations. No new dependency or browser API fetch.
  Reduced motion skips automatic playback; manual vacancy selection cancels it.
- County dots use vacancy alone, exact horizontal positions and responsive collision
  lanes; vertical positions have no statistical meaning. Dates and margins follow
  each selected county. This comparison is county-only, not town-versus-county ranking.
- The cost ring includes principal separately from interest/bills and follows reader
  inputs. Missing and optional costs remain explicit. It is not appreciation or an all-in quote.
- Stock flow requires nonmissing nonnegative completed/demolished figures and exact
  equality to the publisher's net figure. Somerset's latest 667 completed minus 47
  demolished differs from reported net 619, so no equation is drawn there. No loader
  repair, substituted net, or older-period fallback was introduced.

## Assumptions

- Follow-up approval covered computed visuals using existing data; it did not authorize source changes,
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
- The mosaic is representative, not a parcel map or available-rental inventory; vacancy
  includes seasonal and for-sale homes. Rounding and ACS five-year pooling are disclosed;
  change is not presented as statistically significant. Missing five-year pairs suppress it.
- More build-time observation reads are needed for vacancy; county comparison reuses
  summary endpoints. No acquisition, refresh or model reading regeneration occurred.
- The existing AI local-picture prose remains untouched, including its claims about
  vacancy and competition. Computed visual captions deliberately make no causal claim.

## Verification

- `npm test`: 477 tests passed in 61 files, including six new data-portrait tests and
  five artwork/disclosure tests.
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
- `node scripts/check-data-portraits.mjs`: development interactions passed at
  1280/390/320px, including manual selection canceling autoplay. Browser checks caught
  inherited 38px minimum button height overlapping 32px dot lanes, and focus/hover
  followed by click deselecting the cost slice; both were fixed before completion.
- `ART_ORIGIN=http://localhost:3002 node scripts/check-data-portraits.mjs`: final
  static-export interactions passed at all three widths, including positive net
  additions (20 − 14 = 6), negative additions (3 − 4 = −1), Somerset suppression,
  nonoverlapping county targets, keyboard/tap selection and autoplay cancellation.
- Follow-up screenshots inspected: desktop dark local picture and cost composition,
  mobile vacancy and stock flow. The final export adds zero dependencies.
