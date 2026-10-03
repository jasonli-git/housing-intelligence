# United States entry and New Jersey profile redesign

## What changed

- `/` is now a United States coverage entry. New Jersey is explicitly the only available state profile. The national page shows the actual national mortgage benchmark, not invented national housing statistics.
- New Jersey moved to `/states/new-jersey`, with a statewide overview, a curated blue profile banner, a combined county/budget exploration workspace, and an expandable statewide evidence section.
- Overview figures distinguish the rolling residential sale median, national borrowing benchmark, and reported net construction. Dates, partial construction coverage and preliminary construction years remain visible.
- Supporting evidence includes existing sales and construction presentations plus every available statewide summary figure. Transaction windows and pooled survey periods retain both endpoints; survey margins are preserved.
- Navigation, local-page breadcrumbs and legacy state-region redirects point to the new state route. Existing county, municipality, ZIP, report and standalone affordability URLs remain unchanged.
- Tax-rate values now explicitly say dollars per $100 instead of displaying a unitless number. Mortgage overview figures retain two decimal places.
- Follow-up refinement: the national entrance introduces Housing as a public data project, retains the approved tagline, and explicitly says “Free to use · No fees. No subscription.” Repeated coverage text and longer state-card/benchmark descriptions were shortened. This is a free-access statement, not a change to source licensing or the non-commercial notice.

## Files/modules affected

- `web/app/page.tsx`, `web/app/states/new-jersey/page.tsx`, `web/app/housing-entry.css`, root metadata.
- `StateOverview`, `StateModeWorkspace`, `Masthead`, `SectionJump`.
- Breadcrumbs on local profiles/reports, affordability, tax, freshness and revision history; not-found navigation; `web/public/_redirects`.
- `HomeSales` and `HomesAdded` accept the fields they actually use rather than requiring unrelated packet provenance fields. Their local-page behavior is unchanged.
- `web/lib/stateEntry.ts`, its tests, and the shared `rate_per_100` value formatter.

## Architectural or implementation decisions

- This is an information-architecture and presentation experiment, not a national data-ingestion milestone. National price/rent comparisons are not fabricated from NJ data.
- Existing state ranking fetches, map interactions, affordability calculations and query-string/history behavior are retained. The two explorer views are framed as one local-differences workspace, with the statewide context visible in both modes.
- The main budget navigation now opens the NJ workspace. Existing place-specific `/afford?place=...` entry points remain supported.
- The curated ticker is not the complete inventory: every published statewide level remains available in the evidence expansion. No state peer ranks are invented.
- The overview price is specifically `sr1a_median_sale_price_12m`. Neither a longer transaction window nor a house-price index substitutes for it when absent.
- Preliminary construction status is derived from existing construction observation vintages, not a hard-coded year. Reporting coverage is not treated as full coverage.
- Static-host redirects handle legacy `/regions/1` and `/regions/1/report`; Next's local development server does not process Cloudflare `_redirects`.

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

## Verification

- `npm run typecheck`: passed.
- `npm test`: 44 files, 404 tests passed, including five new state-entry tests.
- `git diff --check`: passed.
- Headless Playwright: root and state pages at 1440px, 390px and 320px had no document horizontal overflow. Light and dark screenshots were inspected.
- Entry-copy follow-up: type checking, all 404 tests and diff checks passed again; headless checks at 1440px/light, 390px/dark and 320px/light confirmed the tagline/free-access/coverage text, no horizontal overflow or page errors, and working NJ navigation.
- Browser checks: national → state navigation; direct budget URL; mode switching and browser Back; state ticker remains visible in budget mode; local NJ breadcrumb; statewide evidence opens with 28 figure rows and six construction years; no page errors in the navigation check.
- Focused mobile sale-price definition was wholly within the 390px × 900px viewport (left 33, right 321, top 649, bottom 817). Two initial inspection scripts used incorrect tooltip selectors and failed; the corrected check passed.
- `npm run build`: passed; generated 2,378 static pages, including `/` and `/states/new-jersey`. Both exported HTML files exist and `out/_redirects` exactly matches the source redirect file. The artifact-origin warning noted above was emitted.
