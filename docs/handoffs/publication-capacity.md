# Publication capacity

## What changed

- Work stays on `refactor/publication-capacity`. No hosting/account settings, purchases, deployment or data loading.
- Post-build aliases are written only when no `_redirects` rule exists. Repeated runs remove only generated aliases at rule-covered numeric page/report paths. ZIP pages, printable reports and Next payloads are unchanged.
- Every sitemap-listed registry entry's two legacy addresses must have **exactly one** rule or alias, with a correct existing canonical target. State/nation rules are included too. Duplicate rules, unsupported rule syntax, missing targets and wrong alias targets fail validation/build.
- Build now emits a categorized inventory and complete legacy manifest into ignored `web/.publication/`, never inside the uploaded site. The manifest includes 2,370 addresses: 2 × 1,183 local places plus four state/nation addresses.
- Inactive compatibility candidates: Cloudflare Bulk Redirect CSV, a route Worker and one Pages Function at `functions/regions/[[path]].js`, generated outside the active project/deploy paths. Local preparation hard-links canonical assets into a disposable emulator tree, with no legacy aliases or `_redirects`; it never modifies the source export.
- A synthetic file-manifest build mirrors the actual NJ-sized place/state payload footprint under reserved `/zz/` names. This is not a Next render, geographic expansion or deployment proof.
- Updated the old URL browser test's stale report-link selector to the current `eyebrow-report` link. Added Decision #400; #367 is unchanged.

## Files/modules affected

- `web/scripts/write-place-aliases.mjs`, `check-readable-urls.mjs`
- `web/scripts/lib/publication.mjs`, `legacy-resolver.mjs`
- `web/scripts/publication-capacity.mjs`, `check-publication-capacity.mjs`
- `web/scripts/prepare-legacy-candidates.mjs`, `check-legacy-candidates.mjs`, `publication.test.mjs`
- `web/package.json`, `.gitignore`, `ARCHITECTURE.md` (authorized new Decisions Log row only)

## Architectural or implementation decisions

### Measured export

Full build retains 1,183 places (21 counties, 564 municipalities, 598 ZIPs), each with a report. Each place contributes **12 canonical HTML/RSC files**, plus one fallback alias for ZIP reports only.

| Category | Files | Bytes |
|---|---:|---:|
| Canonical HTML | 2,380 | 1,168,518,410 |
| RSC payloads | 11,896 | 1,895,042,069 |
| Legacy aliases | 598 | 364,780 |
| Shared Next assets | 61 | 1,883,172 |
| JSON | 5 | 6,741,610 |
| Other | 7 | 323,940 |
| **Total** | **14,947** | **3,072,873,981** |

The exact byte inventory is build-specific; regenerate with `npm run publication:inventory`. File-count headroom: **5,053**. Rules: **1,772**, leaving **228** static-rule slots. Of these rules, 1,768 cover registry entries; four cover state/nation pages. Thus 2,366 → 598 aliases, saving **1,768** files. The same current export with all old aliases would contain **16,715** files; TODO's older 16,682 is not this build's baseline.

All local places currently have the same canonical file count. County payloads total 87,853,012 bytes; municipalities 1,655,104,510; ZIPs 1,313,858,495. These figures exclude legacy aliases. The per-place file/byte inventory is retained in `.publication/inventory.json`.

### Synthetic second-state capacity result

The test adds 1,183 synthetic place/report route bundles plus the real state route's six-file shape; existing shared assets remain shared. It adds **14,202 canonical files**, not fabricated household/data observations.

| Scenario | Projected files | Static rules | Bulk entries if used | Pages Free fits? |
|---|---:|---:|---:|---|
| Current rules + ZIP-report aliases | 29,747 | 3,544 | — | No: both ceilings |
| All compatibility outside Pages assets | 28,551 | 0 | 4,740 | No: file ceiling |

The second row fits the documented 100,000 paid file cap and 10,000 Free Bulk Redirect entry cap in isolation, **not a claim of account capacity or deployability**. Actual second-state size, additional shared assets and existing account use remain unmeasured. Paid file capacity does not raise `_redirects` capacity. Free-plan hosting remains unresolved for a NJ-sized second state; keep this TODO open.

### Compatibility candidates (all inactive)

| Candidate | File/rule savings if activated later | Execution / quota | Operations |
|---|---|---|---|
| Bulk Redirects | All 598 remaining aliases; remove 1,772 Pages rules | No site Function/Worker invocation for a matching redirect; Free allowance 10,000 entries across account lists | Requires account list/rule setup, proxied hostname and a separate release/rollback process; production custom domain coverage, not automatically `pages.dev` previews |
| Route Worker on `/regions/*` | Same | Runs code per legacy hit; shares Workers Free 100,000/day quota | Requires Worker/route setup. Generated module uses same-origin `fetch(request)` to pass unmatched paths to the origin; known redirects tested locally, origin routing/loop behavior still needs a real route preview before activation |
| Pages Function for `/regions/*` | Same, plus a small invocation-route metadata file | Runs code per legacy hit; shares Workers Free 100,000/day quota | One generated handler ships with a future site deployment, no separate account rule. Explicit `_routes.json` limits invocation to `/regions/*`; uses `next()` for unknown/API paths. Supports previews. This branch does **not** put it in active `web/functions/` |

All candidates preserve GET/HEAD queries, use an exact allowlist, never redirect unknown ids or numeric API/download subpaths, and specify no new fragment so browsers inherit the old one. POST to a known legacy page returns 405. The CSV enables only query preservation, with no subdomain/subpath matching or suffix forwarding. No inferred slugs or API-side lookup at request time.

**Recommended follow-up:** choose file capacity separately from compatibility. Bulk Redirects avoids per-hit application execution but requires account configuration; a scoped Pages Function keeps routing with the site at the cost of the shared request quota. Before activating either, update `routes:refresh` so it no longer enforces/emits the old Pages-rule strategy; validate preview and production domains, deploy the replacement first, verify every target, then remove aliases/rules. Keep a rollback-compatible build and do not leave two competing compatibility authorities.

### Official documentation verified 2026-10-20

- [Pages redirects, Per file](https://developers.cloudflare.com/pages/configuration/redirects/): redirects are followed regardless of whether an asset matches. This is the authority for deleting shadowed alias files; also states `_redirects` does not apply to Function-served requests.
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/): 20,000 Free / 100,000 paid files; 25 MiB per asset; 2,000 static + 100 dynamic redirect rules. Paid file-limit setup has additional Wrangler/project requirements; this task does not change them.
- [Redirect Rules availability](https://developers.cloudflare.com/rules/url-forwarding/#availability): Free 10,000 Bulk entries across lists, five lists and 15 rules, account-wide; proxied DNS required. We have not inspected account use.
- [Bulk CSV format](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/reference/csv-file-format/): no header; seven ordered fields. [Parameters](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/reference/parameters/): query preservation and exact-match controls.
- [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/): catch-all file naming and `_routes.json` invocation scope. [Pricing](https://developers.cloudflare.com/pages/functions/pricing/): Functions share the Workers Free 100,000/day allowance; non-Function static requests are free/unlimited.
- **Unconfirmed plan limits cited: none.** Account entitlements, remaining quotas and any special agreements were not inspected. These are documented plan defaults, not an account audit. No plan-price dollar figures are assumed.

## Assumptions

- Published legacy page addresses are the documented extensionless `/regions/<id>` and `/regions/<id>/report`; API/data paths are separate and unchanged.
- Static redirect syntax is currently exact local-target 301s only. New dynamic/rewrite/external rules require deliberately extending validation rather than silently shadowing fallback pages.
- The synthetic test uses one NJ-sized cohort as a stress case, not a forecast for a named second state.

## New TODOs / limitations

- Decide the file-capacity architecture after reviewing these counts: an eligible higher-capacity plan, alternative asset delivery, or a separately tested rendering/export strategy. No ZIP/report/RSC reduction was approved here.
- Candidate activation, host/DNS/account changes and deployment require separate authorization. A prepared CSV is not uploaded; Bulk behavior was validated against its documented format, not a live account.
- Worker module behavior was tested with Request/Response and a stubbed origin; the Pages Function was also exercised in the real local Cloudflare runtime. No production Workers route or quota-exhaustion behavior was tested.
- Keep manual pinned-route review for newly supported places. This task does not auto-allocate/commit public URLs during Friday runs.
- Diagnostics live outside `out`/`dist`, and must not be included in uploads. Disposable candidate trees contain hard-linked build assets; prepare afresh for a different export and do not edit linked assets.
- No Python analytics suite run: this is frontend publication tooling, and the documented live-warehouse test-isolation issue remains open.

## Verification

- Commands run: `npm run build`; `npm run typecheck`; `npm test`; `npm run publication:test`; `npm run publication:inventory`; `npm run publication:capacity`; `npm run publication:prepare`; `npm run publication:candidates`; `node scripts/check-readable-urls.mjs`; repeated alias generation; `git diff --check`.
- Frontend suite: 699 tests / 114 files passed. Publication unit suite: five tests passed (strict rules, sitemap filtering, exclusivity/target failures, request semantics, per-place attribution).
- Local Pages server on port 3006: 1,772 rules parsed, current 301/query behavior and desktop/mobile report/search navigation, ZIP browser fallback with/without JS passed.
- Local-only candidate Pages Function on port 3007: 301 targets, exact passthrough/404 behavior, query preservation and browser fragment inheritance with/without JS passed. Both generated code candidates checked for every one of 2,370 entries using GET and HEAD; every CSV row matched its manifest.
- First post-build check exposed a URL-versus-path argument bug in the new validator; fixed, then rebuilt. First URL browser run exposed a stale existing report-link selector; updated and reran successfully. The installed Wrangler 4.129.0/workerd rejected a 2026-10-20 compatibility date; used supported 2026-09-03 locally, without installing/upgrading anything.
- Final full `npm run build` passed: 2,389 static route entries, 14,947 exported files, 598 aliases and validated exactly-one compatibility coverage. A repeat of the alias generator retained the same counts. `git diff --check` passed.
