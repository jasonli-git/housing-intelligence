# Readable place URLs

## What changed
- County, municipality and ZIP HTML pages and printable reports now use readable URLs: `/regions/princeton`, `/regions/somerset-county`, `/regions/zip-07030`, and `/report` beneath each.
- Search, breadcrumbs, county directories/comparisons, budget results, buyer's guide, similar places, migration/work destinations and figure-revision links use the readable paths. Canonical/share metadata and the sitemap use the same addresses.
- Every numeric place URL has a Cloudflare Pages 301. County/town numeric reports also have 301s. Numeric ZIP reports use a tiny static browser redirect, with an HTML-refresh fallback when JavaScript is off, and a visible continuation link.
- API requests, published JSON, CSV/Markdown downloads, numeric budget/guide query parameters and database identifiers are unchanged.
- `check-live` samples the readable paths from this build's exported `place-routes.json`, with numeric fallback for older builds.

## Files/modules affected
- `web/lib/placeRoutes.json`: pinned slug/geographic identity registry (1,184 places).
- `web/lib/placeRoutes.ts`, `placeSlugs.ts`, `placeRoutes.test.ts`: resolution, allocation, collision/stability/identity checks and public-link helpers.
- `web/app/regions/[id]/page.tsx`, `report/page.tsx`, `sitemap.ts`, `changes/page.tsx`, `web/lib/search.ts` and linked navigation components.
- `web/components/LegacyPlaceAddress.tsx`: numeric-to-readable navigation in development.
- `web/public/_redirects`, `web/package.json`, `web/scripts/refresh-place-routes.mjs`, `write-place-aliases.mjs`, `check-readable-urls.mjs`, `check-live.mjs`.
- Existing link assertions updated; the work-destination test's invented Hoboken ID was corrected to the registry's actual Hoboken ID.

## Architectural or implementation decisions
- Still a static export, with no Worker, Functions, new dependencies, account changes or paid service.
- Namesakes use legal type and county, including the Boonton town/township pair. Further collisions receive geographic identifiers. ZIP slugs retain leading zeroes and use `zip-` to distinguish them from legacy IDs.
- Public addresses are pinned, not recalculated on ordinary builds. Renames and later namesakes cannot steal old URLs. Builds and registry refreshes reject changed geographic identity for an existing numeric ID.
- Registry updates are explicit: run `cd web && npm run routes:refresh` against the local API, review and commit both the registry and redirects. The refresh tool uses Node's native TypeScript support (Node 22.18+; tested on 26.10). Ordinary builds do not require that feature or rewrite tracked files.
- `npm run build` runs the alias writer after Next's export. Do not deploy an export made with bare `next build` alone: it would omit the compatibility files and build-specific public path index.
- The initial full-copy alias approach built successfully but created 28,532 files, exceeding the Pages free-plan cap. Replaced with 2,368 sub-kilobyte HTML compatibility aliases, yielding 16,693 exported files.
- The 1,772 static redirect rules fit Pages' 2,000-static-rule cap. Giving all ZIP reports server redirects would exceed it. Avoided adding cloud infrastructure just for those old report addresses.
- Limits verified against official docs: https://developers.cloudflare.com/pages/platform/limits/ and https://developers.cloudflare.com/pages/configuration/redirects/ .

## Assumptions
- Assigned branch: `feature/readable-place-urls`, created from main independently of open UI PR #141. No merge or deployment.
- Existing data IDs are stable. A reseed/renumber must be reconciled explicitly rather than silently assigning a place's URL to another geography.
- This task changes public HTML routes only, not tool-query syntax, source rights, analytics, geography or metrics.

## New TODOs / limitations
- ZIP numeric reports return HTTP 200 before a browser/HTML refresh, not HTTP 301. Search engines receive the canonical readable URL and noindex on the small alias. Old report social-preview clients that do not follow a refresh may show the generic moved-page title; new readable report URLs have normal metadata.
- The JavaScript alias preserves query and fragment. The no-JavaScript refresh reaches the full report but does not promise preservation of reader-specific query/fragment state.
- New regions with data require an explicit registry refresh before publication; the build fails clearly rather than emitting unstable/new numeric URLs. This can block a scheduled publication until the registry is reviewed.
- Future geographic expansion will eventually require revisiting redirect/file caps. The generator and alias writer fail loudly at the current free-plan limits.
- `make check-live` was adapted but not run against production: this branch is not deployed, and a new two-part `dist/` publish was not generated. The build-specific address map and current redirect targets were tested locally.
- Merge/reconcile with UI PR #141 carefully: both touch the region/report page modules. Do not discard that PR's presentation changes when resolving conflicts.
- Canonical documentation unchanged; Claude should reconcile routing/deployment documentation after review.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 556 tests / 77 files passed, including eight new route/allocation tests and exhaustive resolution/uniqueness over the registry. Initial failures were old numeric-link assertions and a synthetic geographic-identity mismatch; corrected the fixtures/assertions and reran successfully.
- `npm run routes:refresh`: passed; repeated refresh produced identical registry and redirect SHA-256 hashes.
- `npm run build`: final Next export passed, 2,386 pages, then 2,368 compatibility aliases. Final alias writer rerun after adding the public address index passed: 16,693 files, below 20,000.
- `WRANGLER_SEND_METRICS=false wrangler pages dev web/out --port 3006 --ip 127.0.0.1`: actual local Pages runtime parsed all 1,772 redirect rules. This was local only, not a deployment.
- `node scripts/check-readable-urls.mjs`: passed. Checked exported route/report/alias existence for the sitemap-listed registry, unique redirect sources and matching targets, nonnumeric sitemap paths, build address map, actual host 301s and query preservation. Chromium at 390/1280px verified primary county/town/ZIP and namesake pages, canonical metadata, no numeric page links, search navigation, report shortcut navigation, legacy ZIP-report query/fragment preservation, and the no-JavaScript HTML-refresh fallback.
- `node --check` on refresh/alias/route-check/check-live scripts: passed.
- Enumerated all exported assets: largest file 2,516,932 bytes; none exceed Pages' 25 MiB per-file cap.
- `git diff --check`: passed.
- Full backend tests, full accessibility/print audits and production checks were not rerun: calculations and page aesthetics are unchanged; this task's verification focuses on routing/build compatibility.
