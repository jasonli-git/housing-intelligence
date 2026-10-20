# State-agnostic county derivation and geometry publication

## What changed

- Branch `refactor/state-agnostic` began from clean latest main `f692dee`.
- The source registry derives BLS/HUD county FIPS from loaded county regions for every scoped state. It no longer fabricates NJ's odd-numbered 001–041 sequence. Empty state inventories and malformed/wrong-state county identities fail loudly.
- Geometry publishes to `geo/{STATE}/{level}.json` for every configured state, with uppercase postal codes. The four old `geo/{level}.json` paths retain their explicit owner, configured as `scope.legacy_geo_state: NJ`; this remains NJ even in a two-state scope. A legacy owner outside scope is refused. Backdrop stays nationwide and unchanged.
- `api.geo(level, state, simplify?)` requires an explicit state. Its sole production caller, the Atlas county geometry route, explicitly passes NJ per Decision #398.
- Additional small/local structural fixes were listed to the owner before implementation: replace the one-state scope-name vocabulary with all US state/territory labels; remove NJ defaults from StateContextExhibits and StateBroadband; remove the Atlas state metadata's redundant `state_code ?? "NJ"` fallback (the API requires a state code). The NJ page passes its name explicitly, preserving its content and its county Atlas scope.
- Larger assumptions were inventoried, not repaired. This is not a claim that adding a state to config alone now yields complete data, pages or tools.
- No ingestion, migration, deployment, hosting/account changes, pinned-address or legacy-redirect changes. Only authorized new Decision #401 added to ARCHITECTURE; older rows and TODO untouched.

## Files/modules affected

- `src/hip/sources/registry.py`, `src/hip/publish.py`, `src/hip/config.py`, `config/geography.yml`
- `tests/test_county_scope.py`, `tests/test_publish.py`, `tests/test_sources.py` (registration unit test isolates the spine read)
- `web/lib/api.ts` / test, `web/lib/names.ts` / test
- `web/app/atlas/counties.json/route.ts`, NJ page, StateContextExhibits / test, StateBroadband
- `scripts/audit_state_assumptions.py`, `scripts/compare_state_publication.py`
- `ARCHITECTURE.md` (new row #401), this handoff

## Architectural or implementation decisions

- County acquisition depends on the already-loaded geography spine, not on observations or BLS coverage. Counties without housing facts remain counties. Read the regions table through a short-lived SQLAlchemy connection and dispose it; do not import the later warehouse stage into sources or change the dependency rule. No cache can conceal newly loaded county identities.
- Two-state county tests use an isolated SQLite spine with NJ plus Alaska's even-numbered and high county codes. No second state is loaded into the actual warehouse.
- Publication planning remains pure: states and optional compatibility owner are inputs supplied from config by publish. Unit tests cover NJ + NY canonical paths, stable NJ aliases independent of ordering, missing owner and output-path uniqueness.
- Compatibility is a data-publication alias, not an HTTP redirect. Existing geometry bytes are preserved; new canonical files are additive in artifacts/R2, not Pages.
- `make check-dist` checks manifest existence, production origins and missing-page errors, not a particular geo naming scheme. `check-live.mjs` validates the published artifact manifest/content and samples readable page paths; it contains no fixed `geo/county.json` requirement. The old path remains supported anyway, and the existing slow publish test that samples it is retained.
- The county Atlas remains deliberately NJ-specific (#398). Pinned public paths (#367) and legacy HTTP/HTML compatibility (#400) are byte-compared and unchanged.

## Assumptions

- Scope's geography spine has been loaded before BLS/HUD acquisition. A missing county inventory is an error, not a guessed list.
- No new state's source coverage or legal/cost rules are assumed. A state-name label is vocabulary, not an availability announcement.
- A byte diff distinguishes raw identity from visible-text equivalence. Build timestamps/IDs and changed compiled bundles must be reported as differences, never silently called byte-identical.

## New TODOs / limitations

### The geography config's broad claim is still not literally true

The three requested generic seams are fixed, but `config/geography.yml` still says no state code is hard-coded anywhere in src/hip. **That blanket statement remains false.** The inventory below shows exactly which occurrences remain. In particular:
- `sources/census_lodes.py`: NJ main/crosswalk URLs and home-state exclusion.
- `sources/fema.py`: NJ NFHL and claims filters/filename.
- `sources/hmda.py`: NJ discovery/download filters and file/layer naming.
- `sources/epa_sdwis.py`: NJ primacy-agency URL.
- `sources/community.py`: CDC NJ filter; NJ school/crime parser identities are also explicitly jurisdiction-specific.
- `sources/infrastructure.py`: UCMR/EIA state filters and the reviewed NJ LEAD archive/count guard.
- `sources/hud_assistance.py`: federal assisted-property state filters and FIPS construction.
- `sources/fcc.py`: manual NJ archive names, county set, state/block identity guards.
- Legitimate occurrences remain in the all-state FIPS catalog, NJ-only adapters (`nj_*` / NJDEP), publisher notices, NJ metrics, historical migrations and explanatory examples. These are not silently rewritten into unreviewed multi-state parsers.

Expanding those sources requires reviewing file shape, exact provenance, source-specific state layers, staging and aggregation—not just changing a literal. No such expansion occurred here.

### Further structural candidates (not implemented)

The inventory table gives matching file:line references. Additional assumptions a literal scan cannot fully expose:
- `src/hip/sources/bts_ntm.py:33`: a fixed geographic BOX around NJ, referenced by the national transit-stop adapter.
- `src/hip/warehouse/names.py:14`: municipality-name uniqueness currently spans the entire loaded warehouse; cross-state namesakes may need state-qualified labels.
- Generic place/report breadcrumbs and local-profile location copy still point to NJ; they need state-page destinations and jurisdiction-aware tools together.
- `web/lib/ownership.ts` applies NJ seller fees; guide/property checks and cost-card deposit/legal advice need jurisdiction selection before use for another state.
- Home availability locator and coverage statistics, state destination catalogs, scoped help/budget tools, and source completeness reporting need coordinated coverage decisions. Do not turn these into national availability claims just because geometry exists.
- dbt/config datasets outside the requested scan were not generalized or certified. No promise is made about every geographic assumption in the repository.

## Verification

- Before publication: full `make publish` completed locally with the original publisher process and original web code; 19,225 artifact files (19,136 manifest artifacts plus metadata/photos), 14,947 site files. Saved a hard-linked baseline snapshot at `/private/tmp/hip-state-before-xwJ6g4/dist` before the after build. No source data downloaded for another state.
- Targeted Python tests: 25 passed, four slow deselected (the full suite is separately required below).
- `make test-all`: 1,251 Python tests passed, one skipped; 700 frontend tests / 114 files passed. **Ran `tests/test_analytics.py` against the live local warehouse, including both transactional rebuilds**, with the publication API stopped. Skip identified separately with `-rs`: `test_a_region_with_no_known_margin_cannot_be_placed` has no case because every current rent observation carries a margin. No new state was ingested.
- Separate final `npm test`: 700 passed; `npx tsc --noEmit`: passed; `npm run publication:test`: five passed. These were repeated after the final frontend default/fallback changes.
- Ruff passed for affected Python files; mypy passed for registry/publisher. Direct live NJ county derivation matched the old 21-code list exactly. Initial new test fixtures (fetch timers/reused Response/type signature and default text expectations) were corrected before the successful runs.
- Final affected-unit rerun: 74 passed, four slow deselected. The existing HUD registration unit test now stubs county lookup so it does not accidentally require a live database; the derivation itself has separate isolated tests.
- After `make publish` passed: 19,229 artifact files (19,140 manifest artifacts plus metadata/photos), 14,947 site files. `make check-dist` passed. `check-live` expectations were inspected; the remote check was not run, because no deployment was authorized and the live manifest is intentionally still the previous one.
- Raw comparison command: `uv run python scripts/compare_state_publication.py /private/tmp/hip-state-before-xwJ6g4/dist dist --output /private/tmp/hip-state-publication-diff.json`. All paths and changed-file lists remain in that local JSON. The script does **not** normalize bytes before counting them; the HTML main-text check is separately labelled, not a byte-identity claim.

### Before/after publication results and the raw-byte limitation

| Tree | Before | After | Same-path byte-identical | Changed same-path files |
|---|---:|---:|---:|---|
| Artifacts | 19,225 | 19,229 | 19,222 | Three: manifest, freshness, revisions |
| Site | 14,947 | 14,947 | 669 | 2,380 HTML + 11,895 RSC text files |
| Combined | 34,172 | 34,176 | 19,891 | 14,278 |

- Exactly four additive data files: `geo/NJ/{state,county,municipality,zip}.json`. Each is byte-identical to its old unscoped counterpart, and all four old files are byte-identical to baseline. No data artifact removed.
- `freshness.json` and `revisions.json` differ only in their root `generated_at` timestamps; removing that field from parsed copies produced exact object equality. No source/figure/revision data changed. Manifest differs for its build metadata, those two hashes and the four new entries.
- Site added three Next manifests under a new build-ID directory and removed the three manifests under the old ID. All 598 fallback aliases, `_redirects`, pinned `place-routes.json`, Atlas `atlas/counties.json`, other JSON and shared content-hashed assets remain byte-identical.
- **Strict raw-byte identity of unchanged-layout HTML/RSC was not achieved.** Existing build clocks, Next build IDs and streaming serialization are nondeterministic. The footer's build time moved from `2026-10-20T20:46:00.279Z` to `2026-10-20T21:02:55.335Z`; the Next ID moved from `_kvXsp0Wws-Wp5bAN5mnK` to `zIbbqQRvTckURrsjLXu8N`. Live freshness/revision fetches during the page build also carry their own later generated timestamps.
- Clock/ID replacement alone does not explain every raw serialization difference. Inspected examples show identical Flight import records arriving in different order (`_not-found.txt`, `nj/aberdeen.txt`) and identical Atlas window objects emitted in different key order (`atlas.txt`). No claim is made that every RSC record was independently semantically normalized. **All 2,380 HTML main-text comparisons matched**, separately from the raw counts; no price, figure, page/report text or URL change was observed.
- A deterministic clock/build-ID/Flight-output refactor would be separate work if literal HTML/RSC byte identity is required as a merge gate. It was not silently added to this bounded state-parameterization task. Data-byte and existing-geometry compatibility checks passed; raw site-byte equality must not be reported as passed.
- `git diff --check` passed. No deploy, account change, new-state ingestion or pinned-address/legacy-rule modification occurred.

## Exhaustive scoped token inventory

Reproduce: `uv run python scripts/audit_state_assumptions.py`. One hit means one matching source line, even with several tokens. Tests, test fixtures and bytecode are excluded; JSON, migrations, comments and CSS are included. Every matched line is assigned once. A = legitimate NJ source/content/identity (including intentional coverage); B = structural assumption, deferred unless noted above; C = numeric/SVG/style/milestone or substring noise, not an NJ assumption. No unresolved C geography case was found; assumptions without these tokens can still exist.

210 files; 3200 matching lines. A: 2965; B: 49; C: 186.

| File | Category: matching lines | Review / disposition |
|---|---|---|
| `src/hip/analytics/compute.py` | A: 62,471; C: 101 | NJ-only source/content/identity; retained |
| `src/hip/analytics/persistence.py` | C: 1 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/analytics/relationships.py` | A: 50 | NJ-only source/content/identity; retained |
| `src/hip/analytics/similar.py` | A: 3,53 | NJ-only source/content/identity; retained |
| `src/hip/api/main.py` | A: 38 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/analytics.py` | C: 377 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/api/routers/community.py` | A: 31 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/income_limits.py` | A: 3 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/infrastructure.py` | A: 123; C: 118 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/migration.py` | A: 55 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/persistence.py` | C: 2 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/api/routers/regions.py` | A: 34,73,183,247 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/water_systems.py` | A: 46 | NJ-only source/content/identity; retained |
| `src/hip/api/routers/work_destinations.py` | A: 4,25 | NJ-only source/content/identity; retained |
| `src/hip/cli.py` | A: 165,1160,1164; C: 1083 | NJ-only source/content/identity; retained |
| `src/hip/completeness.py` | A: 66,67,68,69,85,106,107,108,124,125,126,127,128,129,130,131,132,139,143,144,145,220,281,324,326,348,604,613,623,660; B: 592; C: 167 | Broadband completeness check selects one state entity |
| `src/hip/config.py` | A: 129,436; C: 392,489,519,925,1057 | NJ-only source/content/identity; retained |
| `src/hip/eval/formats.py` | A: 286; C: 121,169 | NJ-only source/content/identity; retained |
| `src/hip/eval/runners/__init__.py` | C: 26 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/eval/runners/hosted.py` | C: 8,548 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/eval/runners/ollama.py` | C: 49,213 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/eval/selection.py` | C: 24 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/eval_cli.py` | C: 341,539,728 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/footprint.py` | A: 13 | NJ-only source/content/identity; retained |
| `src/hip/geography/backdrop.py` | A: 3,10 | NJ-only source/content/identity; retained |
| `src/hip/geography/matching.py` | A: 14,258 | NJ-only source/content/identity; retained |
| `src/hip/geography/regions.py` | A: 187,188 | NJ-only source/content/identity; retained |
| `src/hip/landing/tabular.py` | A: 349,432 | NJ-only source/content/identity; retained |
| `src/hip/packets/assemble.py` | A: 250; C: 168 | NJ-only source/content/identity; retained |
| `src/hip/packets/causal.py` | C: 18 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/packets/caveats.py` | A: 88,94,106,107,280,281,286,287; C: 17,128,298 | NJ-only source/content/identity; retained |
| `src/hip/packets/citations.py` | C: 76 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/packets/prediction.py` | C: 1 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/packets/report.py` | A: 90,91,96,102; C: 147,388 | NJ-only source/content/identity; retained |
| `src/hip/packets/schema.py` | A: 90; C: 56 | NJ-only source/content/identity; retained |
| `src/hip/packets/survey.py` | A: 23 | NJ-only source/content/identity; retained |
| `src/hip/parcels.py` | A: 13,46,119,120,136,163,169,175,354,363 | NJ-only source/content/identity; retained |
| `src/hip/publish.py` | A: 226,450; C: 95 | NJ-only source/content/identity; retained |
| `src/hip/sources/arcgis.py` | A: 3,4,11,12,19,48,151 | NJ-only source/content/identity; retained |
| `src/hip/sources/base.py` | A: 288,554; C: 653 | NJ-only source/content/identity; retained |
| `src/hip/sources/bls.py` | A: 9 | NJ-only source/content/identity; retained |
| `src/hip/sources/bts_ntm.py` | A: 7,11,15,32 | NJ-only source/content/identity; retained |
| `src/hip/sources/census_acs.py` | A: 13,184,185; C: 11,80,94,110,114,195,215 | NJ-only source/content/identity; retained |
| `src/hip/sources/census_blocks.py` | A: 6,69 | NJ-only source/content/identity; retained |
| `src/hip/sources/census_lodes.py` | A: 1,9,10,11,15,37,42,52,94; B: 70,76,89,97 | LODES main/crosswalk and home-state selection; needs source/staging expansion |
| `src/hip/sources/census_pep.py` | A: 18 | NJ-only source/content/identity; retained |
| `src/hip/sources/census_permits.py` | A: 11,42 | NJ-only source/content/identity; retained |
| `src/hip/sources/census_saipe.py` | C: 3 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/sources/community.py` | A: 22,23,24,80,97,196,200,212,275,312,421,503,515,536; B: 402; C: 353 | CDC PLACES state filter (NJ school/crime adapters are legitimate A) |
| `src/hip/sources/epa_sdwis.py` | A: 1,7,14,17; B: 36 | Federal water-violation request pinned to NJ |
| `src/hip/sources/fcc.py` | A: 238,322; B: 35,149,216,220,234,267 | FCC manual summaries/location file contract is NJ-only |
| `src/hip/sources/fema.py` | A: 8,13,40,73; B: 46,88,95,104 | Federal hazard/claims filters and filename pinned to NJ |
| `src/hip/sources/fhfa.py` | C: 44 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/sources/fred.py` | A: 5 | NJ-only source/content/identity; retained |
| `src/hip/sources/hmda.py` | A: 10,34,61; B: 49,51,58,64 | Federal loan discovery/download contract pinned to NJ |
| `src/hip/sources/hud.py` | A: 236,306,496,548; C: 622,623 | NJ-only source/content/identity; retained |
| `src/hip/sources/hud_assistance.py` | A: 13,111,278; B: 82,103,263 | Federal assisted-property parsing filters/codes NJ; reviewed inventory contract |
| `src/hip/sources/infrastructure.py` | A: 35,38,48,158,302,320,326,332,340; B: 118,244,355,362,373 | UCMR/EIA/LEAD filters and count guard; LEAD edition explicitly NJ-only |
| `src/hip/sources/nj_affordable.py` | A: 20,21,57,66 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_bpu.py` | A: 9,13,66,82,84,195,200 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_construction.py` | A: 1,26,40,88,121,129 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_equalized.py` | A: 1,26,53,81,99,100,109 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_modiv.py` | A: 1,5,8,9,39,51,55,134,161,168; C: 191 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_revaluations.py` | A: 1,29,35,91,108,143 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_sr1a.py` | A: 1,3,11,12,14,36,37,52,94,98,110,112,124; C: 75,83 | NJ-only source/content/identity; retained |
| `src/hip/sources/nj_tax_rates.py` | A: 1,4,13,26,49,69,71; C: 24 | NJ-only source/content/identity; retained |
| `src/hip/sources/njdep.py` | A: 1,4,6,10,13,17,18,23,25,35,44,56,57,60,69 | NJ-only source/content/identity; retained |
| `src/hip/sources/registry.py` | A: 53,54,55,56,57,58,59,60,61,79,81,83,88,141,201,339 | NJ-only source/content/identity; retained |
| `src/hip/transform/dbt_runner.py` | A: 45,46,47,48,49,50,56,72,112,125,146; C: 54 | NJ-only source/content/identity; retained |
| `src/hip/validate/gate.py` | A: 29,30,31,33,48,49,52,70,85,91 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/community.py` | A: 16,17,18,25,26,27 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/freshness.py` | A: 25,45,128,221 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/infrastructure.py` | A: 16,18,19,20 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/load.py` | A: 294,667,716,718,857,922,929; C: 440 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0008_region_name_lsad.py` | A: 5; C: 9,10,11,12,13,14,15,16 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0012_map_backdrop.py` | A: 3,6,14 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0014_modiv_tax_year.py` | A: 6 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0018_margins_everywhere.py` | A: 6 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0021_withdrawn_figures.py` | C: 2,5 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/warehouse/migrations/versions/0023_water_systems.py` | A: 28 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0027_work_destinations.py` | A: 6,31 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0031_migration_flows.py` | A: 5,32 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/migrations/versions/0032_revision_tolerance.py` | C: 1 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/warehouse/migrations/versions/0034_hmda_exact_medians.py` | C: 14 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/warehouse/migrations/versions/0035_region_persistence.py` | C: 1,19 | Non-geographic numeric/comment/style matches; no change |
| `src/hip/warehouse/migrations/versions/0037_ranking_ties.py` | A: 3 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/models.py` | A: 86,88 | NJ-only source/content/identity; retained |
| `src/hip/warehouse/names.py` | A: 1,3,6 | NJ-only source/content/identity; retained |
| `web/app/[state]/[place]/page.tsx` | A: 84,215,268,282,438,469; B: 119,120,125,425,443 | Profile location, breadcrumb/tool copy; needs state-page/tool routing together |
| `web/app/[state]/[place]/report/page.tsx` | A: 79; B: 196 | Generic report breadcrumb has one state destination |
| `web/app/afford-horizon.css` | A: 1 | NJ-only source/content/identity; retained |
| `web/app/afford/page.tsx` | A: 16,25,40,54,61 | NJ-only source/content/identity; retained |
| `web/app/atlas-pages.css` | A: 1 | NJ county Atlas is intentional (#398); retained, explicit geo caller |
| `web/app/atlas/atlas.css` | C: 66,160 | NJ county Atlas is intentional (#398); retained, explicit geo caller |
| `web/app/atlas/counties.json/route.ts` | A: 5,6 | NJ county Atlas is intentional (#398); retained, explicit geo caller |
| `web/app/atlas/page.tsx` | A: 15,43,49 | NJ county Atlas is intentional (#398); retained, explicit geo caller |
| `web/app/budget-explorer.css` | A: 15,16,17; C: 96 | NJ-only source/content/identity; retained |
| `web/app/changes/page.tsx` | A: 41,56 | NJ-only source/content/identity; retained |
| `web/app/county-cabinet.css` | A: 2,3,4,5,8,29,30,31,32,33,34,35,36,37,38,39,40,41,43,44,45,46 | NJ-only source/content/identity; retained |
| `web/app/data-horizon.css` | A: 21; C: 48 | NJ-only source/content/identity; retained |
| `web/app/freshness/page.tsx` | A: 51,66,126,136 | NJ-only source/content/identity; retained |
| `web/app/globals.css` | A: 370,375,680,1018,1025,1169,1252,1253,1254,1728,1736,1737,1738,2063,2180,3596,3611; C: 513,1003,1717,1947,2227,2324,2867,3280 | NJ-only source/content/identity; retained |
| `web/app/guide-horizon.css` | C: 106,107 | Non-geographic numeric/comment/style matches; no change |
| `web/app/guide/page.tsx` | A: 16,36,41 | NJ-only source/content/identity; retained |
| `web/app/help/inventory.json/route.ts` | A: 7 | NJ-only source/content/identity; retained |
| `web/app/help/page.tsx` | A: 12,17,28 | NJ-only source/content/identity; retained |
| `web/app/home-horizon.css` | C: 64 | Non-geographic numeric/comment/style matches; no change |
| `web/app/home-plate.css` | C: 43,54 | Non-geographic numeric/comment/style matches; no change |
| `web/app/home-refresh.css` | C: 30,31 | Non-geographic numeric/comment/style matches; no change |
| `web/app/horizon-theme.css` | A: 1,31,457; C: 195 | NJ-only source/content/identity; retained |
| `web/app/housing-entry.css` | A: 1,2,98,99,100,107,113,114,115,116; C: 3,10,16 | NJ-only source/content/identity; retained |
| `web/app/housing-mosaic.css` | A: 61,62,63,64,65,66,67,68,69,70,83,84,85,86,87; C: 12 | NJ-only source/content/identity; retained |
| `web/app/kinds.css` | C: 15 | Non-geographic numeric/comment/style matches; no change |
| `web/app/layout.tsx` | A: 54; C: 72 | NJ-only source/content/identity; retained |
| `web/app/learning-exhibits.css` | C: 112 | Non-geographic numeric/comment/style matches; no change |
| `web/app/new-jersey.css` | A: 1,2,3,4,5,6,7,8,9,10,11,12,13,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,65,68,69,70,73,74,75,76,77,78,79,82,83,88,89,93,94,98,99,100,104,105,106,107,108,109,111,116,117,118,119,120,121,123,124,125,126,127,128,129,133,134,135,139,140,144,145,146,147,148,149,150,151,152,153,154,155,156,159,165,166,167,172,173,174,178,179,180,181,182,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,203,204,205,206,207,208,209 | NJ-only source/content/identity; retained |
| `web/app/not-found.tsx` | A: 19,22 | NJ-only source/content/identity; retained |
| `web/app/page.tsx` | A: 21,22,34,91 | NJ-only source/content/identity; retained |
| `web/app/place-first.css` | A: 19,30,31,52,53; C: 12,16,17 | NJ-only source/content/identity; retained |
| `web/app/place-photo.css` | A: 6; C: 25 | NJ-only source/content/identity; retained |
| `web/app/quiet-county.css` | A: 161,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,201,202,203,204,205,206,207,210,211,212,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235; C: 147,283,311,393,410 | NJ-only source/content/identity; retained |
| `web/app/search.json/route.ts` | C: 9 | Non-geographic numeric/comment/style matches; no change |
| `web/app/sources/page.tsx` | A: 36 | NJ-only source/content/identity; retained |
| `web/app/state-exhibits.css` | A: 33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,65,66; C: 18 | NJ-only source/content/identity; retained |
| `web/app/state-navigation.css` | A: 1,11,12,13,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,45,46,47,48,49,53,54 | NJ-only source/content/identity; retained |
| `web/app/states/new-jersey/page.tsx` | A: 44,62,74,76,86,95,97,170,171,174,186,198,200,202,205,213,216,217,219,220,221; C: 196 | NJ-only source/content/identity; retained |
| `web/app/tax-horizon.css` | C: 61 | Non-geographic numeric/comment/style matches; no change |
| `web/app/tax/page.tsx` | A: 15,28,29,32,33,49,52 | NJ-only source/content/identity; retained |
| `web/app/terms/page.tsx` | A: 111,120 | NJ-only source/content/identity; retained |
| `web/app/tokens.css` | C: 209,256 | Non-geographic numeric/comment/style matches; no change |
| `web/app/ui-refinement.css` | A: 144,145,146,147,148,149,150,151,152,153,159,160,163,169,185,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,224,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,254,255,256,257,258,259,260,261,263; C: 18,49,68,381,421,491 | NJ-only source/content/identity; retained |
| `web/components/AbstractField.tsx` | C: 18 | Non-geographic numeric/comment/style matches; no change |
| `web/components/AffordExplorer.tsx` | A: 45,96,220,318,333 | NJ-only source/content/identity; retained |
| `web/components/AffordableHousing.tsx` | A: 131,184 | NJ-only source/content/identity; retained |
| `web/components/BroadbandPlace.tsx` | A: 15 | NJ-only source/content/identity; retained |
| `web/components/CommunityContext.tsx` | A: 9,30,39,45,49,50,74 | NJ-only source/content/identity; retained |
| `web/components/CostToOwn.tsx` | A: 20,155,308,328,404,496,832,875 | NJ-only source/content/identity; retained |
| `web/components/CountyCabinet.tsx` | A: 17 | NJ-only source/content/identity; retained |
| `web/components/Crumbs.tsx` | A: 16,59 | NJ-only source/content/identity; retained |
| `web/components/DataScale.tsx` | A: 30,33,35,37 | NJ-only source/content/identity; retained |
| `web/components/DecisionGuide.tsx` | A: 132,237,414 | NJ-only source/content/identity; retained |
| `web/components/FloodRisk.tsx` | A: 17,18,80,84,107,126,136 | NJ-only source/content/identity; retained |
| `web/components/ForYourHousehold.tsx` | A: 182,186 | NJ-only source/content/identity; retained |
| `web/components/GardenStateArtwork.tsx` | A: 1; C: 6 | NJ-only source/content/identity; retained |
| `web/components/GroundAndWater.tsx` | A: 3,10,12,13,16,20,35,36,37,53,59,69,92,116,117,123,134,143,148 | NJ-only source/content/identity; retained |
| `web/components/HomeSales.tsx` | A: 51,52 | NJ-only source/content/identity; retained |
| `web/components/HomesAdded.tsx` | A: 48,49,50,141 | NJ-only source/content/identity; retained |
| `web/components/HousingAtlas.tsx` | A: 21,134,234,242,246,250,281,283 | NJ county Atlas is intentional (#398); retained, explicit geo caller |
| `web/components/HowUnusual.tsx` | B: 63; C: 49 | Noninteractive exhibit caption assumes NJ; coordinate with state exhibit caller |
| `web/components/Ledger.tsx` | A: 86,87 | NJ-only source/content/identity; retained |
| `web/components/LocalEvidenceCharts.tsx` | A: 7 | NJ-only source/content/identity; retained |
| `web/components/LocalNextSteps.tsx` | A: 26,27,28 | NJ-only source/content/identity; retained |
| `web/components/Masthead.tsx` | A: 25,50,54 | NJ-only source/content/identity; retained |
| `web/components/NationalCoverageMap.tsx` | A: 25,180,182,252,254,284,291; B: 124,224,240,248,293; C: 251 | Single covered-state locator/availability; separate home navigation expansion |
| `web/components/PlaceSearch.tsx` | C: 12 | Non-geographic numeric/comment/style matches; no change |
| `web/components/SectionJump.tsx` | B: 16 | State-profile section selector knows the NJ template only |
| `web/components/SimilarPlaces.tsx` | B: 47 | Generic empty-state text names NJ; coordinate with matching geography/cohorts |
| `web/components/SourceFooter.tsx` | A: 62 | NJ-only source/content/identity; retained |
| `web/components/StateModeWorkspace.tsx` | A: 26 | NJ-only source/content/identity; retained |
| `web/components/StateOverview.tsx` | A: 19,27 | NJ-only source/content/identity; retained |
| `web/components/TaxLookup.tsx` | A: 36,37,70,212,265,313,337,339,399,400,401,417,418 | NJ-only source/content/identity; retained |
| `web/components/ThemeToggle.tsx` | C: 12 | Non-geographic numeric/comment/style matches; no change |
| `web/components/TownRow.tsx` | A: 7 | NJ-only source/content/identity; retained |
| `web/components/Utilities.tsx` | A: 2,10,11,12,36,38,45,46,54,59 | NJ-only source/content/identity; retained |
| `web/lib/addressSearch.ts` | A: 2,68,84 | NJ-only source/content/identity; retained |
| `web/lib/affordData.ts` | B: 23,24 | Budget enumeration is NJ-scoped; decide tool coverage before expanding |
| `web/lib/affordableHousing.ts` | A: 45,46,47 | NJ-only source/content/identity; retained |
| `web/lib/api.ts` | A: 342,690,732,755 | NJ-only source/content/identity; retained |
| `web/lib/citations.ts` | A: 170 | NJ-only source/content/identity; retained |
| `web/lib/costInputs.ts` | A: 16,44 | NJ-only source/content/identity; retained |
| `web/lib/costRules.ts` | A: 6,98,128,129,130,131,135,136,151,154,156,167,168,172,173,174,179,180 | NJ-only source/content/identity; retained |
| `web/lib/countyLookups.ts` | A: 9,13 | NJ-only source/content/identity; retained |
| `web/lib/coverageMap.ts` | A: 14,66; B: 4 | State destination catalog; new state page must exist before adding destination |
| `web/lib/dataScale.ts` | B: 17 | Home-page coverage counter filters NJ; must expand with its explanatory copy |
| `web/lib/evidence.ts` | A: 88 | NJ-only source/content/identity; retained |
| `web/lib/format.ts` | A: 88,89,94,100; C: 20 | NJ-only source/content/identity; retained |
| `web/lib/gettingAround.ts` | A: 45; C: 9 | NJ-only source/content/identity; retained |
| `web/lib/globe.ts` | C: 17 | Non-geographic numeric/comment/style matches; no change |
| `web/lib/groups.ts` | A: 27,87,88,91,135,136,137,138,139,140,141,142,143,213,246,288,292,293,294; C: 42,83,110,166,217,355 | NJ-only source/content/identity; retained |
| `web/lib/guide.ts` | A: 291,292,293,295,296,297,300,301,302,317,324,383,384,386,403,404,410,442,534,540,541,546,548 | NJ-only source/content/identity; retained |
| `web/lib/hazards.ts` | A: 35 | NJ-only source/content/identity; retained |
| `web/lib/housingMosaic.ts` | A: 79,81,82,83,85,91 | NJ-only source/content/identity; retained |
| `web/lib/inquiries.ts` | A: 7,12 | NJ-only source/content/identity; retained |
| `web/lib/kinds.ts` | A: 37,38,39,40,143,144,145,160,162,163,164,165,166,167,168,169,170,177,181,182,183,191 | NJ-only source/content/identity; retained |
| `web/lib/mapDefinitions.ts` | A: 1 | NJ-only source/content/identity; retained |
| `web/lib/mapdata.ts` | A: 7,41 | NJ-only source/content/identity; retained |
| `web/lib/measures.ts` | A: 2 | NJ-only source/content/identity; retained |
| `web/lib/meta.ts` | A: 40,41,42 | NJ-only source/content/identity; retained |
| `web/lib/names.ts` | A: 18,45,52 | NJ-only source/content/identity; retained |
| `web/lib/notices.ts` | A: 3,4,7,8 | NJ-only source/content/identity; retained |
| `web/lib/ownership.ts` | A: 18; B: 247 | Generic buy/rent model applies NJ seller fees; needs jurisdiction rules |
| `web/lib/parcels.ts` | A: 20,21,22,23,183 | NJ-only source/content/identity; retained |
| `web/lib/photos.json` | A: 3,4,6,12,29,37,38,41,55,64,81,90,107,109,110,116,133,159,185,211,219,220,223,237,246,263,289,298,315,341,367,376,393,402,419,428,445,453,454,457,471,480,497,523,549,558; C: 68,126,250,432,484,510 | NJ-only source/content/identity; retained |
| `web/lib/photos.ts` | A: 2 | NJ-only source/content/identity; retained |
| `web/lib/placeRoutes.json` | A: 4,5,10,11,16,17,22,23,28,29,34,35,40,41,46,47,52,53,58,59,64,65,70,71,76,77,82,83,88,89,94,95,100,101,106,107,112,113,118,119,124,125,130,131,136,137,142,143,148,149,154,155,160,161,166,167,172,173,178,179,184,185,190,191,196,197,202,203,208,209,214,215,220,221,226,227,232,233,238,239,244,245,250,251,256,257,262,263,268,269,274,275,280,281,286,287,292,293,298,299,304,305,310,311,316,317,322,323,328,329,334,335,340,341,346,347,352,353,358,359,364,365,370,371,376,377,382,383,388,389,394,395,400,401,406,407,412,413,418,419,424,425,430,431,436,437,442,443,448,449,454,455,460,461,466,467,472,473,478,479,484,485,490,491,496,497,502,503,508,509,514,515,520,521,526,527,532,533,538,539,544,545,550,551,556,557,562,563,568,569,574,575,580,581,586,587,592,593,598,599,604,605,610,611,616,617,622,623,628,629,634,635,640,641,646,647,652,653,658,659,664,665,670,671,676,677,682,683,688,689,694,695,700,701,706,707,712,713,718,719,724,725,730,731,736,737,742,743,748,749,754,755,760,761,766,767,772,773,778,779,784,785,790,791,796,797,802,803,808,809,814,815,820,821,826,827,832,833,838,839,844,845,850,851,856,857,862,863,868,869,874,875,880,881,886,887,892,893,898,899,904,905,910,911,916,917,922,923,928,929,934,935,940,941,946,947,952,953,958,959,964,965,970,971,976,977,982,983,988,989,994,995,1000,1001,1006,1007,1012,1013,1018,1019,1024,1025,1030,1031,1036,1037,1042,1043,1048,1049,1054,1055,1060,1061,1066,1067,1072,1073,1078,1079,1084,1085,1090,1091,1096,1097,1102,1103,1108,1109,1114,1115,1120,1121,1126,1127,1132,1133,1138,1139,1144,1145,1150,1151,1156,1157,1162,1163,1168,1169,1174,1175,1180,1181,1186,1187,1192,1193,1198,1199,1204,1205,1210,1211,1216,1217,1222,1223,1228,1229,1234,1235,1240,1241,1246,1247,1252,1253,1258,1259,1264,1265,1270,1271,1276,1277,1282,1283,1288,1289,1294,1295,1300,1301,1306,1307,1312,1313,1318,1319,1324,1325,1330,1331,1336,1337,1342,1343,1348,1349,1354,1355,1360,1361,1366,1367,1372,1373,1378,1379,1384,1385,1390,1391,1396,1397,1402,1403,1408,1409,1414,1415,1420,1421,1426,1427,1432,1433,1438,1439,1444,1445,1450,1451,1456,1457,1462,1463,1468,1469,1474,1475,1480,1481,1486,1487,1492,1493,1498,1499,1504,1505,1510,1511,1516,1517,1522,1523,1528,1529,1534,1535,1540,1541,1546,1547,1552,1553,1558,1559,1564,1565,1570,1571,1576,1577,1582,1583,1588,1589,1594,1595,1600,1601,1606,1607,1612,1613,1618,1619,1624,1625,1630,1631,1636,1637,1642,1643,1648,1649,1654,1655,1660,1661,1666,1667,1672,1673,1678,1679,1684,1685,1690,1691,1696,1697,1702,1703,1708,1709,1714,1715,1720,1721,1726,1727,1732,1733,1738,1739,1744,1745,1750,1751,1756,1757,1762,1763,1768,1769,1774,1775,1780,1781,1786,1787,1792,1793,1798,1799,1804,1805,1810,1811,1816,1817,1822,1823,1828,1829,1834,1835,1840,1841,1846,1847,1852,1853,1858,1859,1864,1865,1870,1871,1876,1877,1882,1883,1888,1889,1894,1895,1900,1901,1906,1907,1912,1913,1918,1919,1924,1925,1930,1931,1936,1937,1942,1943,1948,1949,1954,1955,1960,1961,1966,1967,1972,1973,1978,1979,1984,1985,1990,1991,1996,1997,2002,2003,2008,2009,2014,2015,2020,2021,2026,2027,2032,2033,2038,2039,2044,2045,2050,2051,2056,2057,2062,2063,2068,2069,2074,2075,2080,2081,2086,2087,2092,2093,2098,2099,2104,2105,2110,2111,2116,2117,2122,2123,2128,2129,2134,2135,2140,2141,2146,2147,2152,2153,2158,2159,2164,2165,2170,2171,2176,2177,2182,2183,2188,2189,2194,2195,2200,2201,2206,2207,2212,2213,2218,2219,2224,2225,2230,2231,2236,2237,2242,2243,2248,2249,2254,2255,2260,2261,2266,2267,2272,2273,2278,2279,2284,2285,2290,2291,2296,2297,2302,2303,2308,2309,2314,2315,2320,2321,2326,2327,2332,2333,2338,2339,2344,2345,2350,2351,2356,2357,2362,2363,2368,2369,2374,2375,2380,2381,2386,2387,2392,2393,2398,2399,2404,2405,2410,2411,2416,2417,2422,2423,2428,2429,2434,2435,2440,2441,2446,2447,2452,2453,2458,2459,2464,2465,2470,2471,2476,2477,2482,2483,2488,2489,2494,2495,2500,2501,2506,2507,2512,2513,2518,2519,2524,2525,2530,2531,2536,2537,2542,2543,2548,2549,2554,2555,2560,2561,2566,2567,2572,2573,2578,2579,2584,2585,2590,2591,2596,2597,2602,2603,2608,2609,2614,2615,2620,2621,2626,2627,2632,2633,2638,2639,2644,2645,2650,2651,2656,2657,2662,2663,2668,2669,2674,2675,2680,2681,2686,2687,2692,2693,2698,2699,2704,2705,2710,2711,2716,2717,2722,2723,2728,2729,2734,2735,2740,2741,2746,2747,2752,2753,2758,2759,2764,2765,2770,2771,2776,2777,2782,2783,2788,2789,2794,2795,2800,2801,2806,2807,2812,2813,2818,2819,2824,2825,2830,2831,2836,2837,2842,2843,2848,2849,2854,2855,2860,2861,2866,2867,2872,2873,2878,2879,2884,2885,2890,2891,2896,2897,2902,2903,2908,2909,2914,2915,2920,2921,2926,2927,2932,2933,2938,2939,2944,2945,2950,2951,2956,2957,2962,2963,2968,2969,2974,2975,2980,2981,2986,2987,2992,2993,2998,2999,3004,3005,3010,3011,3016,3017,3022,3023,3028,3029,3034,3035,3040,3041,3046,3047,3052,3053,3058,3059,3064,3065,3070,3071,3076,3077,3082,3083,3088,3089,3094,3095,3100,3101,3106,3107,3112,3113,3118,3119,3124,3125,3130,3131,3136,3137,3142,3143,3148,3149,3154,3155,3160,3161,3166,3167,3172,3173,3178,3179,3184,3185,3190,3191,3196,3197,3202,3203,3208,3209,3214,3215,3220,3221,3226,3227,3232,3233,3238,3239,3244,3245,3250,3251,3256,3257,3262,3263,3268,3269,3274,3275,3280,3281,3286,3287,3292,3293,3298,3299,3304,3305,3310,3311,3316,3317,3322,3323,3328,3329,3334,3335,3340,3341,3346,3347,3352,3353,3358,3359,3364,3365,3370,3371,3376,3377,3382,3383,3388,3389,3394,3395,3400,3401,3406,3407,3412,3413,3418,3419,3424,3425,3430,3431,3436,3437,3442,3443,3448,3449,3454,3455,3460,3461,3466,3467,3472,3473,3478,3479,3484,3485,3490,3491,3496,3497,3502,3503,3508,3509,3514,3520,3526,3532,3538,3544,3550,3556,3562,3568,3574,3580,3586,3592,3598,3604,3610,3616,3622,3628,3634,3640,3646,3652,3658,3664,3670,3671,3676,3682,3688,3694,3700,3706,3712,3718,3724,3730,3736,3742,3748,3754,3760,3766,3772,3778,3784,3790,3796,3802,3808,3814,3820,3826,3832,3838,3844,3850,3856,3862,3868,3874,3880,3886,3892,3898,3904,3910,3916,3922,3928,3934,3940,3946,3952,3958,3964,3970,3976,3982,3988,3994,4000,4006,4012,4018,4024,4030,4036,4042,4048,4054,4060,4066,4072,4078,4084,4090,4096,4102,4108,4114,4120,4126,4132,4138,4144,4150,4156,4157,4162,4168,4174,4180,4186,4192,4198,4204,4210,4216,4222,4228,4234,4240,4246,4252,4258,4264,4270,4276,4282,4288,4294,4300,4306,4312,4318,4324,4330,4336,4342,4348,4354,4360,4366,4372,4378,4384,4390,4396,4402,4408,4414,4420,4426,4432,4438,4444,4450,4456,4462,4468,4474,4480,4486,4492,4498,4504,4510,4516,4522,4528,4534,4540,4546,4552,4558,4564,4570,4571,4576,4582,4588,4594,4600,4606,4612,4618,4624,4630,4636,4642,4648,4654,4660,4666,4672,4678,4684,4690,4696,4702,4708,4714,4720,4726,4732,4738,4744,4750,4756,4762,4768,4774,4780,4786,4792,4798,4804,4810,4816,4822,4828,4834,4840,4841,4846,4852,4858,4864,4870,4876,4882,4888,4894,4900,4901,4906,4912,4918,4924,4930,4936,4942,4948,4954,4960,4966,4972,4978,4984,4990,4996,5002,5008,5014,5020,5026,5032,5038,5044,5050,5056,5062,5068,5074,5080,5086,5092,5098,5104,5110,5116,5122,5128,5134,5140,5146,5152,5158,5164,5170,5176,5182,5188,5194,5200,5206,5212,5218,5224,5230,5236,5242,5248,5254,5260,5266,5272,5278,5284,5290,5296,5302,5308,5314,5320,5326,5332,5338,5344,5350,5356,5362,5368,5374,5380,5386,5392,5398,5404,5410,5416,5422,5428,5434,5440,5446,5452,5458,5464,5470,5476,5482,5488,5494,5500,5506,5512,5518,5524,5530,5536,5537,5542,5548,5549,5554,5560,5566,5572,5578,5584,5590,5596,5602,5608,5614,5620,5626,5632,5638,5644,5645,5650,5656,5662,5668,5674,5680,5686,5692,5698,5704,5710,5716,5722,5728,5734,5740,5746,5752,5758,5764,5770,5776,5782,5788,5794,5800,5806,5812,5818,5824,5830,5836,5842,5848,5854,5860,5866,5872,5878,5884,5885,5890,5896,5902,5908,5914,5920,5926,5932,5938,5944,5950,5956,5962,5968,5974,5980,5986,5992,5998,6004,6010,6016,6022,6028,6034,6040,6046,6052,6058,6064,6070,6076,6082,6088,6094,6100,6106,6112,6118,6124,6130,6136,6142,6148,6154,6160,6161,6166,6172,6178,6184,6190,6196,6202,6208,6214,6220,6226,6232,6238,6244,6250,6256,6262,6268,6274,6280,6286,6292,6298,6304,6310,6316,6322,6323,6328,6334,6340,6346,6347,6352,6353,6358,6364,6370,6376,6382,6388,6389,6394,6400,6406,6412,6418,6424,6430,6436,6442,6448,6454,6460,6466,6472,6478,6484,6490,6496,6502,6508,6514,6520,6526,6532,6538,6544,6550,6556,6562,6568,6574,6580,6586,6592,6598,6604,6610,6616,6622,6628,6634,6640,6646,6652,6658,6664,6670,6676,6682,6688,6694,6700,6706,6712,6718,6724,6725,6730,6731,6736,6742,6748,6754,6760,6766,6772,6778,6784,6790,6796,6802,6808,6814,6820,6826,6832,6838,6844,6850,6856,6862,6868,6874,6880,6886,6892,6898,6904,6910,6916,6922,6928,6934,6940,6946,6952,6958,6964,6970,6976,6982,6988,6994,7000,7006,7012,7018,7024,7030,7036,7042,7048,7054,7060,7066,7072,7078,7084,7090,7096; C: 194,794,1394,1994,2030,2036,2042,2048,2054,2060,2066,2072,2078,2084,2594,3194,3669,3908,4155,4508,4569,4839,4899,5108,5535,5547,5643,5708,5883,6159,6308,6321,6345,6351,6387,6723,6729,6908,6944,6950,6956,6962,6968,6974,6980,6986,6992,6998 | Pinned identities, not new-state allocation; unchanged (#367/#400) |
| `web/lib/placeRoutes.ts` | A: 5,6; B: 17 | One state-id destination; pinned local paths intentionally unchanged |
| `web/lib/placeSlugs.ts` | A: 6 | NJ-only source/content/identity; retained |
| `web/lib/reportProblem.ts` | A: 65 | NJ-only source/content/identity; retained |
| `web/lib/reportSources.ts` | A: 8,9,10,11,13 | NJ-only source/content/identity; retained |
| `web/lib/schools.ts` | A: 2 | NJ-only source/content/identity; retained |
| `web/lib/search.ts` | A: 6,16,20,21,42 | NJ-only source/content/identity; retained |
| `web/lib/sources.ts` | A: 58,59 | NJ-only source/content/identity; retained |
| `web/lib/stateEntry.ts` | A: 9,10,11 | NJ-only source/content/identity; retained |
| `web/lib/terms.ts` | A: 35,39,43,47,57,149,365,367,368,371,375,471,492,496,500,504,508,512,516,520,524,623,624,625,639,640,641,643,647,653,671,672,684,801,811,829,885,940 | NJ-only source/content/identity; retained |
| `web/lib/theme.ts` | C: 2 | Non-geographic numeric/comment/style matches; no change |
| `web/lib/uncertainty.ts` | A: 12,63,68,75,193,283 | NJ-only source/content/identity; retained |
| `web/lib/verdict.ts` | A: 44,115,451,454,467 | NJ-only source/content/identity; retained |
| `web/lib/waterReports.ts` | A: 6,7 | NJ-only source/content/identity; retained |
| `web/lib/windows.ts` | A: 2,53 | NJ-only source/content/identity; retained |
| `web/lib/world-land.json` | C: 1 | Non-geographic numeric/comment/style matches; no change |

