# Export payloads — measured, no configuration adopted

## What changed

- Measured the installed **Next 16.3.5** static export on `experiment/export-payloads`, based on `main` at `fc3b845`.
- Ran independent full `npm run build` runs for the unchanged baseline and the documented `experimental.prefetchInlining` budget `{ maxSize: 65536, maxBundleSize: 262144 }`. Ran **both** `npm run publication:inventory` and `npm run publication:capacity` after each.
- Added `web/scripts/check-export-navigation.mjs`, a reproducible local Pages/Chromium probe for real navigation, history, deep reloads, payload 404s, and network cost. It neither blocks requests nor deletes/modifies Next output.
- **Restored `web/next.config.mjs` exactly to `main`. Recommend no configuration change for this task.** The supported reduction still does not fit a second NJ-sized state, and the existing accessibility check is red on both variants. No unsupported flag, output deletion, router rewrite or hosting change is left on the branch.

## Files/modules affected

- Added `web/scripts/check-export-navigation.mjs`.
- Added this handoff. Leave it in place until the owner reviews the PR.
- `next.config.mjs` was temporarily changed for one measured build, then restored with no final diff. No application/page/component, ZIP/report, pinned route registry, `_redirects`, legacy alias setup or capacity assertion change.
- No canonical documentation change: since no config is adopted, no Decision #404 is added and no old Decisions Log row is edited.

## Architectural or implementation decisions

### Installed docs read first; exact controls and limits

Read the installed `web/node_modules/next/dist/docs/` files, not an older Next tutorial:

| Installed document | Relevant documented behavior |
|---|---|
| `01-app/02-guides/static-exports.md` | `output: 'export'` produces static HTML and client-navigation payloads: “The resulting component will be rendered into static HTML for the initial page load and a static payload for client navigation between routes.” |
| `01-app/02-guides/prefetching.md` | The client cache is keyed by route segments; sibling navigation can reuse parent layouts. Disabling prefetch changes when a route is fetched, not the export file contract. |
| `01-app/03-api-reference/02-components/link.md`, `prefetch` section | `<Link prefetch={false}>`: “Prefetching will never happen both on entering the viewport and on hover.” This is not an option to omit files. |
| `01-app/03-api-reference/05-config/01-next-config-js/prefetchInlining.md` | `experimental.prefetchInlining` defaults to `true`; `false` means “Each segment is prefetched as its own request.” Its `maxSize` is “Largest a single segment response can be to still be eligible for inlining.” Defaults are 2,048 bytes per segment and 10,240 bytes per bundle, measured gzip-compressed. `maxBundleSize` caps total bundled compressed bytes. This experimental but documented control can reduce separately emitted segment responses. Turning it **off** is the opposite of disabling per-segment output. |
| `01-app/03-api-reference/03-file-conventions/02-route-segment-config/prefetch.md` | Segment `prefetch = 'force-disabled'` controls advance requests and requires `cacheComponents`; it is not a static-export payload suppression switch. It does not suppress route metadata or the full-route payload. |
| `01-app/03-api-reference/05-config/01-next-config-js/partialPrefetching.md` and `cacheComponents.md` | Partial Prefetching requires Cache Components and changes the app's caching/rendering model. It is not a documented file-emission-off option for this existing static app. No Cache Components migration was attempted. |

**No supported option was found in this installed release to turn off all per-segment static output, or to omit the full-route `.txt` for an App Router static export.** In particular, `experimental.clientSegmentCache` is absent from this version's config types/schema and docs; no unknown config or undocumented environment override was tried. The requested literal “per-segment off” and “all `.txt` off” rows are unavailable, not fabricated build variants. The larger documented inlining budget is an additional bounded measurement, not a claim to implement either unavailable switch.

Cross-checked implementation to distinguish emission from request scheduling:

- `next/dist/server/app-render/app-render.js`: `shouldGenerateStaticFlightData` checks static generation; static prerender paths collect Flight and segment data. `collectSegmentData` decomposes full Flight output.
- `next/dist/server/app-render/collect-segment-data.js`: emits `_tree`, `_full` and segment responses; inlined parents need no separate response. Bundling is not removal of the router protocol.
- `next/dist/export/routes/app-page.js`: fully static pages write full-route RSC and segment files from that metadata.
- `next/dist/export/index.js`: copies the full RSC to `<route>.txt` and converts segment filenames into public static-export paths. **The measured public layout is `<route>/__next._tree.txt`, `__next._full.txt`, `__next._index.txt`, etc., not a public `.segments/` directory.** `.segments/` is an intermediate/internal spelling. Inventory and navigation checks cover the actual `.txt` files.

### Capacity result

Raw exported bytes are on-disk file lengths, not compressed CDN traffic. Each projection uses the existing synthetic manifest builder, mirroring all **1,183 places**, their ZIP/report/payload files and the state page while sharing JS/CSS. It does not ingest/render a second state.

| Option | Exported files | Exported bytes | RSC `.txt` files | Projected files: second state, current compatibility | Projected files: all legacy compatibility off Pages assets | Fits Pages Free? | Navigation |
|---|---:|---:|---:|---:|---:|---|---|
| Unchanged main/default inlining | 14,947 | 3,072,906,380 | 11,896 | 29,747 | 28,551 | No | 14/14 client journeys; history/deep reload passed; zero payload 404s |
| Inlining: 64 KiB per segment / 256 KiB bundle | 12,568 | 3,070,554,914 | 9,517 | 25,001 | 23,805 | No | 14/14 client journeys; history/deep reload passed; zero payload 404s |
| Per-segment output fully off | N/A | N/A | N/A | N/A | N/A | Not available | No supported build option; not simulated by deletion |
| All static-export `.txt` off | N/A | N/A | N/A | N/A | N/A | Not available | No supported build option; not simulated by deletion |

The documented budget removes **2,379 files**, but only **2,351,466 bytes (~0.077%)**. Counties/towns/ZIPs move from 12 to 10 canonical files per place, not approximately four. Both builds retain **2,380 canonical HTML files**, **598 aliases** and **1,772 static redirect rules**. With the extra state and current compatibility, rules project to **3,544**, also above the existing 2,000-rule allowance. Even the favorable no-legacy-assets scenario is **3,805 files too large** after inlining.

`check-publication-capacity.mjs`'s assertion that the mirror exceeds Free remains **true in both runs**. It was not changed, weakened or bypassed. No mirrored-cohort success was hidden by treating its assertion as a bug.

### Browser cost, not just file count

Local **Wrangler 4.129.0 `pages dev`**, Chromium, **1280px and 390px**, fresh browser context per journey. No physical mobile, Safari/Firefox, public-CDN latency or real second-state performance claim. CDP `Network.loadingFinished.encodedDataLength` measures local encoded transfer bytes including response headers, not decoded file sizes. Timings/prefetch races can affect request placement; these are observed samples, not statistical benchmarks.

The probe records **source load plus automatic prefetch separately from click-time downloads** so a zero-byte click does not pretend a prefetched page was free. All 28 measured transitions (14 per variant) kept the same document/sentinel; **zero new full-page loads replaced client transitions**. Back/forward and deliberate hard reloads succeeded for every journey.

Click phase: **requests / encoded transfer bytes**. These include search-index and script/style fetches, not only RSC.

| Width | Journey | Baseline | Larger inlining budget |
|---:|---|---:|---:|
| 1280 | Place → parent county | 0 / 0 | 4 / 201,436 |
| 1280 | Place → report | 1 / 172 | 1 / 172 |
| 1280 | Report → place | 1 / 172 | 1 / 172 |
| 1280 | Header buyer guide | 3 / 10,987 | 3 / 10,986 |
| 1280 | Header home | 2 / 344 | 2 / 344 |
| 1280 | Home search result | 7 / 101,804 | 7 / 101,804 |
| 1280 | Header search result | 2 / 70,902 | 2 / 70,869 |
| 390 | Place → parent county | 0 / 0 | 0 / 0 |
| 390 | Place → report | 1 / 172 | 1 / 172 |
| 390 | Report → place | 1 / 172 | 1 / 172 |
| 390 | Header buyer guide | 33 / 169,336 | 34 / 220,760 |
| 390 | Header home | 2 / 344 | 2 / 344 |
| 390 | Home search result | 8 / 100,292 | 6 / 100,291 |
| 390 | Header search result | 2 / 70,902 | 6 / 157,994 |

Across each viewport's seven fresh-context journeys:

| Width / variant | Source load + prefetch requests / bytes | Click requests / bytes | Click document requests |
|---|---:|---:|---:|
| 1280 baseline | 525 / 5,612,154 | 16 / 184,381 | 0 |
| 1280 inlining | 518 / 6,073,407 | 20 / 385,783 | 0 |
| 390 baseline | 321 / 4,538,935 | 47 / 341,218 | 0 |
| 390 inlining | 314 / 4,735,759 | 50 / 479,733 | 0 |

Fewer standalone files can mean **more repeated shared-layout data in bundles**; the measured transfer totals increased, despite a small reduction in initial request count. No network win is claimed. Full raw request logs and per-journey counts are retained locally in `/private/tmp/hip-payload-{baseline,inlining}-navigation.json`.

## Assumptions

- The 20,000-file Pages Free ceiling is the task's existing capacity threshold, also encoded by #400's tools. No account plan inspection, purchase or configuration change.
- Synthetic mirroring shares existing assets and is an optimistic file-manifest projection, not proof that a real second state's code/data adds zero other assets.
- Existing source/warehouse data are read only for builds; no ingestion/analytics rebuild.
- Baseline static export retained intact at `/private/tmp/hip-payload-baseline-site`. No individual Next-written files were deleted or requests artificially blocked to obtain savings. Final `make publish` uses its normal clean-build workflow.

## New TODOs / limitations

- **No supported config-only path measured here fits the second NJ-sized state on Free.** A different publication/router/asset architecture would need separate scope and verification. None was implemented or activated.
- Address the existing accessibility failures separately: contrast on the scanned page set, and the script's 390px first-Tab/skip-link assertions. No styling/focus fix was bundled into this experiment.
- Literal navigation “without all payloads” cannot be demonstrated under the allowed supported-config constraint. The candidate tests fewer separately emitted responses, not payload-free routing or a fallback-to-full-load hack.
- No Decision #404 because `next.config.mjs` ends identical to `main`. No change to the capacity assertion because its conclusion did not change. No claims that the known hosting or redirect bottlenecks are closed.
- Retain this handoff until owner review.

## Verification

### Builds and inventories

For each measured variant, from `web/`:

```sh
npm run build
npm run publication:inventory
npm run publication:capacity
```

Both full builds passed. Their inventory and synthetic-capacity JSON snapshots are `/private/tmp/hip-payload-{baseline,inlining}-{inventory,capacity}.json`; full build and measurement logs use the same prefixes. Baseline/default config was confirmed identical to `origin/main` after restoration, as were `_redirects` and `placeRoutes.json`.

### Navigation and existing browser checks

Start local Pages with `WRANGLER_SEND_METRICS=false wrangler pages dev out --port 3002 --ip 127.0.0.1 --inspector-port 9237 --persist-to /private/tmp/hip-payload-workerd`. No deploy or account operation.

```sh
EXPORT_CHECK_VARIANT=baseline EXPORT_CHECK_OUTPUT=/private/tmp/hip-payload-baseline-navigation.json node scripts/check-export-navigation.mjs
# Repeat for the inlining build, with its own variant/output name.
ROUTE_CHECK_ORIGIN=http://localhost:3002 node scripts/check-readable-urls.mjs
A11Y_ORIGIN=http://localhost:3002 A11Y_OUTPUT=/private/tmp/hip-payload-baseline-a11y.json node scripts/check-accessibility.mjs
# Repeat accessibility against the inlining build with a separate output path.
```

| Check | Result |
|---|---|
| New navigation/network probe | **Passed both builds**, 14 journeys each: place/county, report both directions, header tools/home and both search locations, desktop/390px, history and hard reload. Zero `.txt`/segment 404s or page errors. An initial probe used an obsolete guide-heading expectation; corrected the test to the actual title and reran successfully. |
| `check-readable-urls.mjs` | **Passed both builds**, including 1,772 rules, query preservation, ZIP alias/no-JS behavior, desktop/mobile report/search navigation. |
| `check-accessibility.mjs` | **Failed both builds with identical results**: 60 records, 24 records with `color-contrast` findings, 20 records with `Skip link is not first in tab order` errors (390px, both themes), no overflow. Paths/states/violation IDs/node counts/errors matched exactly between variants. These are baseline findings, not silently waived or called a pass. |
| `check-atlas-globe.mjs` | **Passed candidate** (the current script checks the flat-map design despite its legacy name). |
| `check-atlas-measures.mjs` | **Passed candidate**. |
| `check-atlas-motion.mjs` | **Passed candidate**. |
| `check-atlas-navigation.mjs` | **Passed candidate**. |
| `check-atlas-comparison-pressure.mjs` | **Passed candidate**. |
| `check-atlas-readiness.mjs` | **Passed candidate**. |

There are **six** `check-atlas-*.mjs` scripts on current `main`, not five; all six were run and reported. Logs are `/private/tmp/hip-payload-inlining-check-atlas-<name>.mjs.log`. Accessibility findings appear on `/`, NJ, the three sampled place pages, affordability, tax, freshness, changes and the sampled report; raw JSON retains target/failure details. No physical-device or production validation was performed.

### Final checks after restoring main's configuration

- `npm test`: **700 passed / 114 files**.
- `npx tsc --noEmit`: **passed**.
- `npm run publication:test`: **all five passed**.
- `node --check scripts/check-export-navigation.mjs`: **passed**.
- Full **`make publish` passed** with restored defaults: 19,229 artifact files, **14,947 site files**, all 2,389 static pages built, aliases/coverage/capacity diagnostics completed. Log: `/private/tmp/hip-payload-final-publish.log`.
- **`make check-dist` passed**, including completeness of all 1,814 published ranking/observation lists and the existing page/link checks.
- After `make publish` moved `web/out` to `dist/site`, ran both measurements again with `PUBLICATION_ROOT=../dist/site`: **14,947 files**, 3,072,906,853 bytes, 11,896 RSC files; favorable second-state projection **28,551**, still above Free. The slight byte drift from the first default build is routine rebuilt HTML metadata; no config change remains. Final snapshots/logs: `/private/tmp/hip-payload-final-{inventory,capacity}.{json,log}`.
- `git diff --exit-code origin/main -- web/next.config.mjs web/public/_redirects web/lib/placeRoutes.json` passed: all three unchanged. `git diff --check` passed. No deploy, hosting/account change, purchase or new-state ingestion.

## Recommendation

**None. Keep the default config.** The measured supported option buys modest file headroom, but misses the most favorable second-state target by 3,805 files, does not materially reduce total bytes, and increased transfer in the sampled journeys. Every required check did not pass, so the candidate is not retained. This is a completed negative capacity experiment, not a second-state-readiness implementation.
