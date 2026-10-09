# National backdrop

## What changed

- Replace the landing page's two separately styled benchmarks with one “The national backdrop” section below the search/map. Keep two distinct measures, shorter headings, prominent values, source dates and definition controls.
- Add a small actual-data trend to each measure: mortgage rates over the preceding year, and annual home-price changes for twelve successive published months. Preserve unavailable-data messages.
- Fine lines, sample dots, dotted guides and neutral colours extend the illustrated-atlas aesthetic without invented data or motion that suggests incoming live values.

## Files/modules affected

- `web/app/page.tsx`, `ui-refinement.css`: shared section and responsive two-column/stacked layout.
- `web/components/NationalTrend.tsx`: static SVG plots, observed-point native titles, scale labels, date captions and accessible chart summaries.
- `web/lib/api.ts`: obtain trends from the existing per-metric national-series cache.
- `web/lib/nationalBenchmarks.ts`, its tests: trend selection, exact annual comparisons, missing-period gaps and time-proportional coordinates.
- `web/scripts/check-ui-refinement.mjs`: real plot paths, shared section, retained date/source/notice assertions and screenshots.

## Architectural or implementation decisions

- The mortgage plot uses the exact series selected for the headline: weekly if available, otherwise the existing monthly fallback. Never blend the two. Retain actual observations within the preceding calendar year; break a weekly line after more than eight days and a monthly line after more than 32 days.
- The FHFA plot shows annual percentage changes, not raw index levels, to match the headline. For each of the latest twelve calendar months, require that month's index and the exact same month one year earlier. Missing/invalid comparisons remain null gaps, never interpolated.
- Use real elapsed time along the x axis, independently scaled observed minima/maxima on the y axis, and flat centred lines for constant series. Do not connect across null gaps. Show range ticks and explicitly tell readers that the charts have separate scales.
- Server-render SVG, not a new charting dependency/client bundle. Existing static-export refresh behavior, sources, calculation provenance and cache semantics remain unchanged. Trends reuse promises already fetched for the two headlines.
- Preserve the mortgage quote caveat, FHFA coverage/seasonal adjustment/revision explanation, source links, required footer notice and visible dates. Historical changes are not forecasts. Chart summaries disclose basis, dates, range and gaps; native point titles expose precise observations with a pointer. Source links remain available for full publisher data.

## Assumptions

- User approved the compact shared strip and actual-data trends on the existing experimental branch. No new source, acquisition, warehouse change, model regeneration or production deployment.
- The chart inputs have ISO dates, as supplied by the validated API. Each publisher's actual latest period determines its history window; do not force both to end at today's date.
- Do not add additional national metrics without separate approval.

## New TODOs / limitations

- Independently scaled small plots are for within-series context, not comparison of slopes or magnitudes. Their explicit scale note and ticks must remain.
- Pointer-native point titles are not a full keyboard/touch exploration interface. The SVG summary and publisher links provide non-pointer context; future interaction should be scoped separately. No claim of exhaustive screen-reader/device verification.
- Automated accessibility audits supplement reader review. Missing history suppresses a chart rather than inventing a trend.

## Verification

- `npm run typecheck` — passed.
- `npm test` — 560 tests passed across 78 files. Four new cases cover annual change vs index level, exact month gaps, year clipping/weekly gaps/monthly fallback, elapsed-time positioning, negative values, constant series and insufficient/invalid history.
- Initial browser audit found the small blue source links below contrast requirements in light mode (4.34:1). Corrected them to underlined primary-colour links and rebuilt. Replaced SVG text ticks with separate fixed-size HTML labels so responsive plots do not stretch the typography.
- Browser checks also caught React 19's single-child requirement for SVG `<title>` content: several JSX text children caused an SSR hydration mismatch. Changed each point title to one complete string and added a server-render/hydration regression test. A separate case verifies empty history produces no invented chart.
- Final `npm run typecheck` and `npm test` — passed, 562 tests across 79 files, including the two render/hydration cases.
- Final `npm run build` — passed, 2,386 static pages. Development server used for diagnosis was stopped before this build; static preview remains on port 3002.
- `A11Y_ORIGIN=http://localhost:3002 npm run check:ui-refinement` — passed. Latest plotted values match the rounded headline figures; real paths, section labels, source dates/links and FHFA notice remain present. Desktop/mobile screenshots reviewed. Existing search/map mode and mobile accessibility checks passed.
- `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/' A11Y_OUTPUT=/tmp/national-backdrop-a11y.json npm run check:a11y` — passed all eight states (desktop/mobile, light/dark, closed/expanded), with no automated axe violations, application errors or page overflow. Manual/incomplete checks remain manual.
- `git diff --check` — passed. No separate frontend linter configured; no backend tests/acquisition/pipeline run for this frontend-only rendering/calculation change.
- `A11Y_ORIGIN=http://localhost:3002 npm run check:a11y:interactions` — passed after the tooltip correction, including retained map/search/theme/definition navigation, 12 expanded routes at 320px, unique IDs and no-JavaScript report fallback; no application errors.
