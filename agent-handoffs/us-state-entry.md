# United States entry and New Jersey profile redesign

## What changed

- `/` is now a United States coverage entry. New Jersey is explicitly the only available state profile. The national page shows the actual national mortgage benchmark, not invented national housing statistics.
- New Jersey moved to `/states/new-jersey`, with a statewide overview, a curated blue profile banner, a combined county/budget exploration workspace, and an expandable statewide evidence section.
- Overview figures distinguish the rolling residential sale median, national borrowing benchmark, and reported net construction. Dates, partial construction coverage and preliminary construction years remain visible.
- Supporting evidence includes existing sales and construction presentations plus every available statewide summary figure. Transaction windows and pooled survey periods retain both endpoints; survey margins are preserved.
- Navigation, local-page breadcrumbs and legacy state-region redirects point to the new state route. Existing county, municipality, ZIP, report and standalone affordability URLs remain unchanged.
- Tax-rate values now explicitly say dollars per $100 instead of displaying a unitless number. Mortgage overview figures retain two decimal places.
- Follow-up refinement: the national entrance introduces Housing as a public data project, retains the approved tagline, and explicitly says “Free to use · No fees. No subscription.” Repeated coverage text and longer state-card/benchmark descriptions were shortened. This is a free-access statement, not a change to source licensing or the non-commercial notice.
- National map experiment: replace the monogram/state-card layout with a stationary globe-projected US coverage selector. Only NJ is blue/raised and linked. Unavailable states are neutral and identify themselves on hover. NJ remains reachable via the locator and a normal text action.
- Map entry transition: activating the NJ shape, desktop locator or mobile map link zooms the geography toward NJ over 520ms, then opens the state page through client navigation. Locator labels fade during the zoom. The ordinary text action below the map remains immediate.
- National/state color hierarchy: national headings, labels, accent rule and borrowing figure use warm charcoal/ivory. The locator's world land and unavailable states use warm grays. NJ's map highlight, locator, mobile link, preview and state page retain blue. The national header is now correctly marked `data-kind="nation"` rather than `state`.
- Navigation/compactness follow-up: breadcrumb links hint national warm-neutral, state blue and local teal identities, including current profile crumbs. Removed the redundant NJ orientation sentence and repeated section kickers; tightened snapshot/workspace spacing and the empty gap before NJ provenance without removing qualifiers or county rows.
- Analytical map follow-up: removed modifier-wheel zoom. +/- controls now use a 160ms ease-out, retargeting from the live camera toward the accumulated click target. Geographic jumps keep their gentler flight. Full controls/height explanation is expandable; the color legend and missing-figure warnings remain visible.
- Copy/footnote follow-up: free-access copy now explicitly adds “Definitely no ads.” Removed the NJ “One state. Different housing markets.” tagline. A compact, accessible † link beside section navigation points to the unchanged statewide caveat texts below the evidence expansion, with a return link. Notes are visible there without opening the evidence; no license terms or measurement-specific caveats changed.
- Snapshot/national-zoom follow-up: moved † from section navigation to the “Statewide snapshot” heading. National coverage now has 44px +/- and Reset controls, 1–5× zoom and bounded dragging when enlarged. First zoom centers NJ; later zooms respect a panned view. Mobile sideways swipes pan, vertical swipes scroll the page. Wheel zoom is not added; pinch retains native browser zoom. Geographic outlines are transformed rather than reprojected on every frame; no new dependencies.
- Control consistency follow-up: national map reuses the NJ `globe-controls` markup/classes, dividers, mono labels and icon treatment. Shared atlas styling moved from NJ-only CSS into globals, so the two maps use one skin. United States restores national framing; New Jersey frames NJ without navigating; +/- use NJ's 1.4× steps. Reset is icon-only rather than a text label. National touch buttons remain 44px; mobile zoom is top-right and framing bottom-left. The NJ footnote is a 14px superscript, retaining a 44px effective pointer target without increasing the heading height.
- Control simplification: removed the national map's bottom-left NJ framing button and its divider. United States remains as the full-view action; NJ entry links, zoom, drag and reset remain unchanged. NJ's own map controls are unaffected.

## Files/modules affected

- `web/app/page.tsx`, `web/app/states/new-jersey/page.tsx`, `web/app/housing-entry.css`, root metadata.
- `StateOverview`, `StateModeWorkspace`, `Masthead`, `SectionJump`.
- Breadcrumbs on local profiles/reports, affordability, tax, freshness and revision history; not-found navigation; `web/public/_redirects`.
- `HomeSales` and `HomesAdded` accept the fields they actually use rather than requiring unrelated packet provenance fields. Their local-page behavior is unchanged.
- `web/lib/stateEntry.ts`, its tests, and the shared `rate_per_100` value formatter.
- Map follow-up: `NationalCoverageMap`, `web/lib/coverageMap.ts` and tests, and the geometry-only `/states.json` static route. Existing `globe.ts`, packing/unpacking and world-land assets are reused without modifying the analytical map.
- Navigation/zoom follow-up: `Crumbs`, shared breadcrumb/help styling in `globals.css`, `GlobeMap`, and `web/lib/mapMotion.ts` with three timing/easing tests.

## Architectural or implementation decisions

- This is an information-architecture and presentation experiment, not a national data-ingestion milestone. National price/rent comparisons are not fabricated from NJ data.
- Existing state ranking fetches, map interactions, affordability calculations and query-string/history behavior are retained. The two explorer views are framed as one local-differences workspace, with the statewide context visible in both modes.
- The main budget navigation now opens the NJ workspace. Existing place-specific `/afford?place=...` entry points remain supported.
- The curated ticker is not the complete inventory: every published statewide level remains available in the evidence expansion. No state peer ranks are invented.
- The overview price is specifically `sr1a_median_sale_price_12m`. Neither a longer transaction window nor a house-price index substitutes for it when absent.
- Preliminary construction status is derived from existing construction observation vintages, not a hard-coded year. Reporting coverage is not treated as full coverage.
- Static-host redirects handle legacy `/regions/1` and `/regions/1/report`; Next's local development server does not process Cloudflare `_redirects`.
- The coverage map has no measure/color scale and no continuous animation. Its small NJ lift represents availability, never magnitude. State geometry loads near the viewport via IntersectionObserver; the regular state action is server-rendered. No new dependencies, API keys or WebGL requirement.
- Initial fixed framing was superseded by the snapshot/national-zoom follow-up: bounded enlarged-map dragging and explicit zoom buttons now supplement the mobile 44px NJ link. Reduced motion removes zoom/hover transitions; unavailable/failed geometry and JavaScript-disabled browsers retain the normal NJ link. Print restores the full-US frame and hides map controls.
- Entry motion uses a compositor transform of the existing SVG group, not per-frame geographic reprojection. The destination is prefetched on activation. Modified clicks, reduced motion, missing geometry and missing animation support retain ordinary links. Duplicate activation is guarded; a 650ms navigation fallback avoids waiting indefinitely for animation completion. Unmount, pageshow and Back reset/cancel the zoom and pending fallback.
- The full analytical map no longer handles wheel events at all. Normal wheel scrolling belongs to the page; Ctrl/Command-wheel behavior belongs to the browser (which may use it for browser zoom). Drag and geographic jump controls remain. Reduced-motion zoom synchronously updates the camera ref so rapid presses do not lose steps.

## Assumptions

- The intended hierarchy is United States → New Jersey → existing local profiles, with no other state presented as ready.
- Existing licensed data and the non-commercial notice remain unchanged.
- No model readings, warehouse data, canonical documents or deployment configuration should change in this experiment.

## New TODOs / limitations

- Additional states require actual data and profile coverage before they can appear as available destinations.
- The old root URL intentionally changes meaning. Old `/?mode=afford` bookmarks should use `/states/new-jersey?mode=afford#nj-explore`; no root redirect can preserve the new national entry at the same URL.
- This does not add a statewide modeled interpretation or cost-to-own scenario: the available statewide measures do not supply all the local cost inputs.
- No deployment or merge was performed. Live Cloudflare redirect behavior requires deployment verification; the exported redirect file is checked locally.
- The local build's artifact-origin warning remains: report Markdown downloads resolve to localhost unless `NEXT_PUBLIC_ARTIFACT_URL` is set for deployment.
- The first national locator shows the contiguous US, not Alaska/Hawaii/Puerto Rico; its label and accessible description say so. It is a stationary selection surface, not a replacement for the full NJ map's pan/zoom controls. World land is decorative context, not data coverage.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 44 files, 404 tests passed, including five new state-entry tests.
- `git diff --check`: passed.
- Headless Playwright: root and state pages at 1440px, 390px and 320px had no document horizontal overflow. Light and dark screenshots were inspected.
- Entry-copy follow-up: type checking, all 404 tests and diff checks passed again; headless checks at 1440px/light, 390px/dark and 320px/light confirmed the tagline/free-access/coverage text, no horizontal overflow or page errors, and working NJ navigation.
- Map follow-up: type checking and 407 tests across 45 files passed. Headless checks at 1440px, 390px and 320px showed no horizontal overflow; light/dark screenshots inspected. Mobile NJ navigation, page scrolling, reduced-motion mode, request-failure fallback and JS-disabled NJ link verified. No `/map.json` request on the entry; `/states.json` measured 57,770 uncompressed bytes in the local snapshot.
- Map follow-up production build passed with 2,379 static outputs. Exported `states.json` contains only precision and 52 packed state/backdrop outlines, including NJ; no housing measures.
- Transition follow-up: type checking and all 407 tests passed. Headless checks observed the zoom transform, successful desktop/keyboard/mobile arrivals, clean Back reset, no mobile animation under reduced motion, and no page errors. The first inspection click targeted empty SVG-anchor bounds and timed out; clicking the painted locator rectangle passed.
- Transition follow-up: modified clicks did not start motion; cancelling motion still reached NJ. `git diff --check` and the production export passed again (2,379 outputs); the existing artifact-origin warning remains.
- Color hierarchy follow-up: type checking, all 407 tests and diff checks passed. Light/dark desktop and 390px/320px mobile screenshots inspected; computed colors confirm neutral national title/rule/labels and blue NJ preview/state title. No horizontal overflow; mobile NJ navigation still works. An initial mobile test lacked a touch-enabled context; it was corrected and rerun successfully.
- Color hierarchy production export passed again (2,379 outputs), with the existing artifact-origin warning unchanged.
- Navigation/zoom follow-up: type checking and 410 tests across 46 files passed; diff check passed. Browser checks at 1440px, 390px and 320px confirmed no NJ/county horizontal overflow, neutral/blue/teal breadcrumb colors, wheel page scrolling, no app interception of synthetic modifier-wheel events, working help expansion, and reduced-motion zoom without a flight. Five rapid zoom clicks settled by the 250ms check; camera ground paths stayed unchanged through a further 400ms. Comparing entire SVG HTML was inconclusive because the separate county rise animation continues; the ground-path check isolates camera movement. All 21 initial county rows and switching to budget mode were verified. Fresh mobile dark screenshot inspected.
- Navigation/zoom production export passed (2,379 static outputs). The existing artifact-origin warning remains; local development was restarted on port 3000 afterward.
- Copy/footnote follow-up: `npm run typecheck`, all 410 tests and `git diff --check` passed. Headless browser checks at 1440px, 390px and 320px verified the full no-fees/no-subscription/no-ads message, removal of the NJ tagline, all three unchanged note paragraphs, working footnote/return links, no horizontal overflow and no page errors. Mobile footnote-reference screenshot inspected.
- Copy/footnote production build passed with 2,379 static outputs; the existing artifact-origin warning is unchanged. Local preview restarted on port 3000.
- Snapshot/national-zoom follow-up: type checking and 413 tests across 46 files passed, including first/repeated NJ-centered zoom, panned-center retention and bounded/reset viewport tests. Headless desktop/390px/320px checks verified zoom, maximum zoom, Reset, pan, no horizontal overflow or page errors, and † in the snapshot rather than the section-navigation row; all three note paragraphs remain. Real mobile touch checks caught premature capture loss and a small vertical-map nudge; both fixed and rerun. Sideways swipes now complete, vertical swipes scroll without changing the map, and zoomed mobile NJ entry plus Back reset work. Mobile zoom screenshot inspected.
- Zoomed desktop NJ entry also passed; reduced-motion viewport transition computed as 0s; print hid controls and restored the untransformed US geometry.
- Snapshot/national-zoom production export passed with 2,379 static outputs and the unchanged artifact-origin warning. Diff check passed; local preview restarted on port 3000.
- Control consistency: type checking, all 413 tests and diff check passed. Headless checks at 1440px, 390px and 320px verified NJ/US map framing, zoom/reset, no horizontal overflow or page errors, non-overlapping mobile control groups and working superscript footnote navigation. Mobile map/snapshot screenshots inspected.
- Control consistency production export passed with 2,379 static outputs; the pre-existing artifact-origin warning remains. Local development restarted on port 3000.
- Control simplification: type checking, all 413 tests and diff check passed. Browser checks at 1440px and 390px confirmed only United States remains in the bottom-left group, NJ entry links remain, zoom/full-view reset works, and neither page overflows horizontally.
- Control simplification production export passed with 2,379 static outputs; existing artifact-origin warning unchanged. Local preview restarted on port 3000.
- Browser checks: national → state navigation; direct budget URL; mode switching and browser Back; state ticker remains visible in budget mode; local NJ breadcrumb; statewide evidence opens with 28 figure rows and six construction years; no page errors in the navigation check.
- Focused mobile sale-price definition was wholly within the 390px × 900px viewport (left 33, right 321, top 649, bottom 817). Two initial inspection scripts used incorrect tooltip selectors and failed; the corrected check passed.
- `npm run build`: passed; generated 2,378 static pages, including `/` and `/states/new-jersey`. Both exported HTML files exist and `out/_redirects` exactly matches the source redirect file. The artifact-origin warning noted above was emitted.
