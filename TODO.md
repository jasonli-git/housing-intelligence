# Housing Intelligence Platform — TODO

Open work only. Shipped detail lives in [CHANGELOG.md](CHANGELOG.md), decisions and
limitations in [ARCHITECTURE.md](ARCHITECTURE.md), milestone status and sequencing in
[ROADMAP.md](ROADMAP.md).

Completed milestone sections were removed on 2026-09-19 when this file was restructured
into `Now` / `Open` / `Parked`. They are recoverable with
`git show 62bc3c2:TODO.md`, and what they shipped is in `CHANGELOG.md`.

## Now — Milestone 29 in review, as of 2026-09-20

**Milestone 29 is open as [PR #27](https://github.com/jasonli-git/housing-intelligence/pull/27)**,
with the review fixes on `fix/m29-refresh-guarantees`. Not merged, not deployed.

**A review of the branch found seven real defects**, all reproduced independently before
being changed and all now fixed with regression tests: a failed pipeline reported success
on the next run; an unreachable publisher was reported as confirmed unchanged; downstream
stages re-fetched their own inputs and broke the partial refresh; HUD's 571 municipal
files silently stopped being acquired; revision provenance was being deleted by two
different cleanups; identical bytes counted as an upstream change; and `make refresh`
cannot carry the exit codes a scheduler needs. ARCHITECTURE #195–#200.

**Verified end to end after the fixes.** A full refresh completed and recorded 802 refs,
including the 566 municipal CHAS refs that had gone missing; a second run answered in
**2.7 seconds** with seven confirmed 304s and correctly declined to rebuild.

**The live site is 0.20.1 and its numbers are behind the warehouse.** A deploy changes
published figures — the mortgage rate on every cost card, and 294,469 restated Zillow
values.

**To resume:** `make db-up` for Postgres. `uv run hip refresh` is the command a scheduler
runs; `make refresh` is for running it by hand.

## Open

Every open item, wherever the work originated. The tag in parentheses is where it was
first raised, not where it must be done.

### Correctness and data integrity

- [ ] **2,936 revision rows have an `old_release_id` that no longer resolves.**
      (M29, found in review 2026-09-20) They predate the retention fix in ARCHITECTURE
      #199: `_prune_orphan_derived_releases` had already deleted the `hip_derived`
      releases they pointed at before anything protected them. New orphans are now
      prevented — a full `analyze` under the fix created none — but these cannot be
      recovered, because the rows they referenced are gone. All 2,936 are derived
      metrics (2,435 `price_to_income`, 396 `rent_to_income`, 105 `price_to_ami`), where
      the pointer named the analyze run rather than a publisher's file, so what is lost
      is which *computation* produced the earlier value and not which source did. Decide
      whether to null the dangling ids — an unresolvable integer reads as a working
      reference — or leave them and say so where they are served.

- [ ] **The validation gate has no range bounds for the two HUD metrics.**
      (pre-M12 review) `hud_area_median_income` and `hud_income_limit_80` are absent from
      `VALUE_BOUNDS` ([gate.py](src/hip/validate/gate.py)), so the one metric family
      feeding `price_to_ami` passes unchecked. Every other loaded metric has bounds.
- [ ] **`hip load` re-fetches every source's refs just to rebuild provenance.** (M3)
      That is `acquire`-level work inside `load` — harmless while cached, wrong in
      principle. The loader should read the manifests instead.
- [ ] **Crosswalk weights carry ~1% area error for polygons with few vertices.** (M1)
      `ST_Transform` reprojects vertices without densifying edges. Negligible for real
      TIGER geometry, which is vertex-dense; it only shows up in synthetic test fixtures.
      Revisit if a source ever supplies coarse polygons.
- [ ] **A county has a tax bill but no tax rate.** (M25, #181) `nj_effective_tax_rate`
      is municipal only, because a county rate is a levy-weighted average and the
      weights — equalized valuations per municipality — are in the Table of Equalized
      Valuations PDF rather than the workbooks this milestone ingests. Either parse that
      PDF as a fourth layer of `nj_tax_rates`, or state on a county page why the rate
      stops at municipalities. Doing neither leaves an asymmetry a reader will notice
      before we do.
- [ ] **SR1A carries four fields the aggregates ignore.** (M25) `assessed_value_total`,
      `sales_ratio`, `year_built` and `living_space` are landed and unused. `living_space`
      is the one that matters: a price per square foot on *transactions* is not derivable
      from anything else the warehouse holds, and it is the figure that makes two towns'
      medians comparable when their housing stock differs. Check the field's fill rate
      before scoping it — the median is meaningless if half the deeds leave it blank.
- [ ] **`web/lib/groups.test.ts` pins a hand-copied metric catalog.** (M25, found
      2026-09-20) The comment says a new metric "shows up there as a failure to
      classify", but the catalog is a literal list snapshotted from `GET /metrics`, so
      four new metrics went unclassified without failing anything — they would have
      rendered under "Other measures" silently. Derive the list from
      `config/metrics.yml` or from a recorded API response, so the guard guards.

### Evaluation harness

- [ ] **A single transient error disqualifies a candidate model.** (pre-M12 review)
      `select_winner` requires `summary.errors == 0`
      ([src/hip/eval/report.py:193](src/hip/eval/report.py:193)). Right for local
      runtimes, where an error means the model genuinely could not run. One HTTP 429 from
      a hosted provider would disqualify an otherwise winning model on the same rule. The
      hosted runner needs retry with backoff, and this gate should become a *rate* with a
      stated threshold, the way the 5% fabrication bar already is (#59).
- [ ] **Cohort names are hardcoded inside the runners.** (pre-M12 review) `cohort="gguf"`
      in [ollama.py](src/hip/eval/runners/ollama.py) and `cohort="mlx"` in
      [mlx_runner.py](src/hip/eval/runners/mlx_runner.py), in both success and failure
      paths. Three hosted providers behind one `HostedRunner` cannot each be their own
      cohort under that scheme. Cohort should come from config, and `Cohort.runner`'s
      `Literal` has to gain the new value.
- [ ] **"The most recent evaluation run" is chosen lexically.** (pre-M12 review) `runs()`
      sorts directory names ([store.py:102](src/hip/eval/store.py:102)), so `v10` sorts
      before `v2` and `hip explain` would silently pick the older run's winner. Either
      name runs so they sort, or sort by modification time.
- [ ] **Two strings say the explanation layer is local.** (pre-M12 review) The judge's
      system prompt ([judge.py:47](src/hip/eval/judge.py:47)) and the API disclaimer
      ([explanations.py:31](src/hip/api/routers/explanations.py:31)). The disclaimer is a
      straight edit. The judge prompt is not: changing it changes scores, so hosted
      candidates cannot be compared against the stored `v1` judgments.
- [x] **`test_generations_are_written_as_they_complete_not_in_a_final_pass` was
      intermittent.** (M18) Seen 2026-09-11, during the M18 run, and again 2026-09-19.
      **Fixed 2026-09-19:** reproduced at 4 failures in 25 runs, then made deterministic.
      The race was in the test, not the runner — `pool.map` hands a freed worker the next
      scenario the moment an earlier `generate` returns, while the append happens on the
      main thread once it consumes that future, so sampling the file raced the writer.
      The last scenario now waits for the evidence instead of sampling for it. 0 failures
      in 50 runs, and a mutation to a final-pass write still fails it.
- [ ] **Move `import_gguf.sh` and `kvbench.sh` into the repo (`scripts/`).** (M8 prep)
      Still outstanding, and `import_gguf.sh` is now known to produce passthrough
      templates (ARCHITECTURE #62), so it needs the template fix before it is committed.
      They live in a `/private/tmp` scratchpad that does not survive a reboot.

### Test coverage

- [ ] **Tests: unpivot shape and gate behavior — never written.** (M2, corrected
      2026-08-13 after this line was briefly ticked in full) `test_matching.py` builds
      `stg_zillow_zhvi` as a hand-made fixture, so the dbt UNPIVOT of ~318 date columns
      is exercised by pipeline runs only. `hip.validate.gate` (216 lines) has no test
      importing it at all — the thing whose whole job is to block a bad load is the
      least-tested module in the pipeline.
- [ ] **Unit tests for the source adapters.** (M3, wider than first written) As of
      Milestone 7, 2 of 11 adapters have direct tests — `TigerAdapter`
      (`tests/test_sources.py`) and `ModivAdapter` (`tests/test_nj_modiv.py`). The nine
      metric adapters — Zillow ZHVI and ZORI, ACS, FRED, BLS, FHFA, permits, IRS, HUD —
      have none. They are exercised end to end by pipeline runs, but nothing drives
      `refs()` or `to_records()` against a stubbed response, so a publisher changing a
      response shape would surface as a pipeline failure rather than a test failure.
      `test_nj_modiv.py` is the pattern to copy — a `MockTransport` subclass, no network.

### API and scale limits

- [ ] **Two published limits have no headroom for Milestone 15.** (pre-M12 review)
      `/regions/{id}/metrics` is published at its default `limit=5000` with nothing in
      the response saying whether it truncated; the largest region carries 760
      observations today, so this is a watch item. `/rankings` caps at 1,000, below the
      3,144 counties Milestone 15 adds — a national ranking would be silently cut off at
      rank 1,000.
- [ ] **`GET /regions?q=` passes `%` and `_` through to `ILIKE`.** (pre-M12 review) A
      caller searching for `%` matches every region. Cosmetic today; worth settling
      before Milestone 17 builds real search over this endpoint.
- [ ] **New Jersey is hardcoded in three places**, despite `config/geography.yml` stating
      no state code is hard-coded anywhere in `src/hip`. (pre-M12 review) NJ's
      odd-numbered county FIPS in [registry.py:73](src/hip/sources/registry.py:73), which
      is a real arithmetic assumption about one state; and `?state=NJ` in both
      [publish.py:197](src/hip/publish.py:197) and
      [web/lib/api.ts:245](web/lib/api.ts:245). Blocks Milestone 14, not 12.
- [ ] **`python-dotenv` is imported but not declared.** (pre-M12 review) `load_env_file`
      ([config.py](src/hip/config.py)) imports it directly; it reaches the environment
      only as a transitive dependency of `pydantic-settings`. Load-bearing since #63 — a
      resolver change that drops it breaks `hip` at startup. One line in `pyproject.toml`.
      **Verified still undeclared 2026-09-19.**

### Frontend and presentation

- [ ] **Let a reader enter their own purchase price, with the published figure
      prefilled.** (owner's preference, 2026-09-20, stated alongside the ARCHITECTURE
      #187 decision — a direction, not an approved requirement.) The cost card already
      takes one input, the down payment, and now states a purchase price explicitly
      rather than implying "the typical home" — which is most of the way to a field a
      reader can overwrite with the price of a listing they are actually looking at. The
      value is that the card stops being about a town and starts being about a decision,
      while the assumptions behind it stay visible. **The boundary, from the owner
      2026-09-20:** an entered price changes that reader's payment scenario only, and
      never the town's published figures or its rankings — which settles most of what
      was unscoped here. Still open: whether an entered price persists across regions,
      and what the comparison strip says once the price is not the published one.
      **Not scheduled.**
- [ ] **Fold `redesign.css` into `globals.css`**, so each component has one set of rules
      rather than two whose winner depends on file order (#162's cost). (Quiet utility)
      Mechanical and large — worth its own review.
- [ ] **A lone card on its own row** — Mercer's seventh housing card — keeps a full row's
      borders, so it reads as unfinished. (Quiet utility)
- [ ] **The county picker does not preselect the county being viewed.** (M18) It opens on
      "Choose…" on every page; reading the path would need `usePathname` in the bar.
- [ ] **Shares still render as `0.68`, not `68%`.** (M21) `ratio` covers both multiples
      (price-to-income 4.5) and shares (homeownership 0.68). A share unit belongs with
      Milestone 18's design system.
- [ ] **The print rule that opens disclosures, `::details-content`, was checked in
      Chromium only.** (M18) A browser without it prints the licence label alone and the
      footer's institutions without their datasets. Check Safari and Firefox print
      previews before relying on it.
- [ ] **The README's screenshots predate the redesign** and Milestone 23: all eight show
      the old pages. (Quiet utility) Codex's 2026-09-19 investigation
      (`agent-handoffs/screenshot-automation.md`) built a working capture command and
      recommended against automating it per push — retaking them is now a manual step
      with tooling that exists.

### Map performance — open leads, for the end of V3

- [ ] **Unexplained: `slowest input 504ms`.** A single event took half a second to be
      answered with no long task anywhere. Likeliest candidates are a click forcing a
      large re-render and relayout — the town table's "Show all" is 585 rows — or a first
      interaction landing while the map is still doing its one-time work. Worth its own
      look before anything else is optimised.
- [ ] **The level switch, which happens mid-flight**, is the next lead if slowness
      persists. Crossing county to municipality swaps `inView` from 21 outlines to 564,
      rebuilds every prism for the first time, and recomputes the ramp's quantiles over
      564 values — on one frame, mid-zoom. Best remaining explanation for both a 141ms
      hand-on frame and a 110ms idle p95, and unlike everything else it has never been
      touched.
- [ ] **Not reproduced: reports being worse than the map.** No report page renders a
      `GlobeMap` — `/regions/[id]` and `/regions/[id]/report` have no map at all — so
      whatever is slow there is a different problem and needs its own look.

### Publication

- [ ] **`make check-live` samples one municipality, and never the interesting ones.**
      (found 2026-09-20, on its first use validating a real release) It verified the
      0.20.1 deploy by fetching Aberdeen, which is priced from Zillow like most places —
      so neither the transaction fallback nor the no-price case was exercised, and both
      were checked by hand afterwards. A sample drawn from the head of the search index
      finds the common path every time by construction. It should instead pin one region
      per *shape* the page can take, named explicitly rather than sampled: a Zillow-priced
      card, a transaction-priced card, and a region with neither.
- [ ] **Nothing stops `/afford` from acquiring a second price source.** (found
      2026-09-20) The comparison page reads `latest("zhvi_sfr", …)` directly rather than
      going through the warehouse ratios, so the test that keeps the transaction median
      out of `price_to_income` does not protect it — a map mixing Zillow-priced and
      deed-priced towns would render without failing anything. Verified Zillow-only on
      2026-09-20 by reading `web/app/afford/page.tsx`; that is a fact about today, not a
      guard.

- [ ] **`make publish` assembling both halves into one directory.** (M11) Its done
      criterion is a reachable public URL.
- [ ] **`hip explain` does not report what a run cost.** Found 2026-09-19 regenerating
      Milestone 24's readings: the command prints characters and figures bound per
      region but never a billed total, so the only way to know what a regeneration cost
      is the provider console. `hip eval judge` already prints what it was billed — the
      same treatment here would make a regeneration's cost checkable against the
      estimate `hip eval cost` gives.
- [ ] **Generation does not use any provider's batch pricing.** Raised 2026-09-19.
      `hip eval judge` submits through Anthropic's Batch API for a flat 50%; `hip
      explain` calls each provider's synchronous chat endpoint once per (region, model)
      at list price. Defensible at 21 counties and five models, where a run is under a
      dollar and finishes in about 45 minutes. It stops being noise at scale: the
      Milestone 19 estimate for full New Jersey municipal coverage is roughly $42 a
      refresh. Batching would need a per-provider path in `HostedRunner` with its own
      polling and partial-failure handling, and the local tier cannot batch at all —
      so this is a scale decision, not a cleanup.
- [ ] **`reports/evaluation/v1.md` is as rendered at Milestone 8.** (M13) A re-render
      would change its title and add Milestone 20's Effort columns without changing a
      figure, so it was left alone and reverted once. Already in ARCHITECTURE's Known
      Limitations — say if it should be re-rendered.
- [ ] **No example report is visible to anyone browsing the repository.** (M6) Both
      `data/` and `reports/` are gitignored, which is correct for rebuildable artifacts.
      If one is wanted as a portfolio artifact it needs a deliberate `git add -f` of a
      single file, not a change to `.gitignore`.

### Documentation upkeep

- [x] **Nothing detects a stale `README.md` Features list.** Found 2026-09-19, closed
      the same day by `tests/test_doc_consistency.py`: the list
      named M0–M9, M13, M17, M21 and M23 while M11, M12, M16, M18, M19 and M20 had all
      shipped — including M16's globe, the most recent milestone and the platform's main
      visual object. `ROADMAP.md` already records which milestones shipped, so a test can
      assert that every milestone marked shipped appears in the Features list and fail
      when one does not. It cannot write the prose — that is editorial — but it can
      refuse to let a shipped milestone go undescribed. Same shape as
      `tests/test_module_boundaries.py`, which parses source rather than trusting it.
      **Done.** The check found M10 undescribed on its first run; that entry is written.
- [ ] **Which README figures are mechanically derivable has never been settled.** The
      status counts (regions, observations, metrics, sources), the Tech Stack, the
      evaluation table and the resource and storage figures all have a queryable or
      file-based source; the status narrative, the Features descriptions and the setup
      prose do not. Deciding the boundary is what makes any "regenerate on deploy" work
      scopeable, and ARCHITECTURE #175 settles only the images half.

### Housekeeping

- [ ] **Nothing runs `ruff` automatically.** `make lint` exists and is run by hand, so
      a violation reaches `main` whenever someone runs `make test` and stops there —
      which happened on 2026-09-19, when the README features check landed in 0.18.x with
      an E501 and was only caught by the next milestone. Options considered and not
      chosen yet: a test that shells out to `ruff check`, which couples the suite to a
      linter version; or CI, which the repository does not have. Recorded rather than
      decided.
- [ ] **`hip check-config` exits 1 on a clean checkout** because three source API keys
      are unset. (M0) Correct behaviour, but it means `check-config` cannot be wired into
      `make lint` or CI until the keys exist.
- [ ] **Starlette's `TestClient` emits a deprecation warning asking for `httpx2`.** (M0)
      Suppressed in `pyproject.toml` rather than fixed, because swapping the HTTP client
      was not Milestone 0 work. Revisit before it becomes an error.

### Open decisions — not scheduled, not decided

- [ ] **How should a cross-region comparison handle two price sources?** (M25, opened
      2026-09-20 by the decision in ARCHITECTURE #187) The cost card may now be priced
      from Zillow's index or from a transaction median depending on the region, but
      `price_to_income` and `price_to_ami` are still computed from Zillow alone — so 163
      municipalities have a monthly cost and no price-to-income, and any attempt to give
      them one would rank a town measured on deeds against a neighbour measured on an
      index. The owner's condition was explicit: keep the fallback out of cross-region
      rankings until the comparison handles the difference. Options are to publish two
      separately-labelled ratio families, to rank only within a price source, or to leave
      the gap and say so on the page. **Leaning**, relayed by the owner 2026-09-20: two
      families, and eventually a transaction-based price-to-income computed for *every*
      qualifying town including those Zillow covers, so a reader compares one measure
      across the whole state rather than a different one per town — with the Zillow-based
      measure kept alongside it. That is a larger change than closing the gap, and it is
      schedulable separately from the cards that are now live. `tests/test_nj_sr1a.py` fails if the input is added
      before this is settled. **Not decided.**
- [ ] **Should a change of model force regeneration?** (deferred to M12) The preference
      list can fall through mid-run, so some regions may carry prose from one model and
      some from another. `region_explanations` stores `model_id`, `model_label` and
      `runtime`, and the dashboard shows them, so it is visible rather than hidden. A
      consistent voice costs a full re-run; leaving it is free but leaves several models'
      writing on the site indefinitely. Leaning toward leaving it. **Not decided.**
- [ ] **Staleness currently ignores model identity.** (deferred to M12)
      `hip.eval.explain.is_stale` compares only `packet_sha256`, so swapping models marks
      nothing stale. That is the correct default under the leaning above, but it is a
      default nobody chose — it falls out of the Milestone 8 implementation. Whichever
      way the decision above goes, this function should say so explicitly.
- [ ] **Milestone 17's second user path needs a query the static tree cannot answer.**
      Someone evaluating a place they are moving to wants it compared against where they
      live now, which is `/compare` — one of three endpoints in the publish manifest's
      `unpublishable` list, because an arbitrary set of region ids is combinatorial. The
      consumer entry point therefore carries a dependency on a browser-side query layer
      over published data, and is larger than its roadmap row suggests.
- [ ] **`place` versus `cousub` outside the strong-MCD states.** Not a Version 2
      decision — Milestone 14's nine states are all strong-MCD and Milestone 15 stops at
      county level. It becomes blocking the first time municipality-level data is wanted
      in a state where county subdivisions are statistical divisions.
      `config/geography.yml` already warns the identifier system is expensive to change
      once fact rows reference it.

### Data sources worth adding

- [ ] **ACS housing-stock tables** — B25002 and B25003 landed in Milestone 21 as vacancy
      and homeownership rates; **B25024 (units in structure) and B25034 (year built)
      remain.** Same `CENSUS_API_KEY`, same adapter. Note the raw cache keys on the
      layer, so a table needs a new layer (ARCHITECTURE #108) — "a `metrics.yml` entry
      and a column" turned out wrong.
- [ ] **FRED housing series** — `NJSTHPI` landed in Milestone 21 from FHFA's master file
      rather than FRED (ARCHITECTURE #109); **the three national series remain**: `HOUST`
      (housing starts), `RRVRUSQ156N` (rental vacancy), `MSPUS` (national median sale
      price). Each is a `sources.yml` line plus a `metric_id`.
- [ ] **Zillow's other cuts** — bottom-tier and top-tier ZHVI, SFR-only,
      new-construction sale price, days-to-pending, for-sale inventory. Same CSV host,
      same adapter, already anticipated.
- [ ] **LEHD LODES** — jobs by workplace and residence per census block, supporting
      jobs-housing balance and commute-shed analysis. Large but static files.
- [ ] **ACS ZIP-level data is not fetched.** (M3) Since 2020 ACS no longer nests ZCTAs
      within states, so a ZIP pull means downloading all ~33,000 nationally per vintage
      for the 598 that matter.
- [ ] **Municipal coverage is 403/564 (71%) under Zillow name matching** — a ceiling, not
      a bug. (M2, updated at M7) MOD-IV landed and `region_identifiers` holds 554 NJ
      codes, so a crosswalk exists, but routing Zillow through it still needs a
      Zillow-name-to-CD_CODE mapping MOD-IV does not supply. ACS closed the gap to
      564/564 separately; Zillow's 403 stands.
- [ ] **NJ Parcels geometry (`njgin_parcels`)** — **blocked.** No key needed, but the
      REST path Milestone 7 uses returns attributes only, and the geometry for a parcel
      map layer would be an enormous download.

## Parked / needs user input

- [ ] **Rotate the keys that were pasted into chat, then clear them from
      `data/raw/`.** In that order — scrubbing the cache while the keys are still live
      and still in a transcript is motion without effect.

      **Rotate (yours; these cannot be done here).** Each in its own provider console:
      **Qwen/DashScope**, pasted 2026-09-11. **DeepSeek**, **Gemini** and **Mistral**,
      pasted 2026-09-06. **Census**, **FRED**, **BLS** and **Anthropic**, pasted in
      earlier sessions. Update `.env` after each.

      **Then clear the cache (mine).** **22 manifests** under `data/raw/` still carry a
      live key in their recorded `url` — 21 `bls`, 1 `fred`. Re-measured 2026-09-20: the
      earlier figure of 68 counted every manifest across the three sources, but 46 of
      them have already rewritten themselves clean on a later fetch, `census_acs` among
      them at 24 of 24. ARCHITECTURE #76 stopped new ones being written and deliberately
      did not rewrite the immutable content-addressed tree, so the remainder are the ones
      not re-acquired since. Deleting those source trees and re-acquiring rewrites them
      without keys. Worth doing after rotation, not before.

      **Scope, measured 2026-09-19.** `data/` is gitignored, HUD's bearer token is not
      recorded (manifests hold `url` only, and nothing matches bearer/authorization/
      token), and **no published artifact has ever carried a key** — checked against
      `dist/artifacts`. The chat transcripts are the real exposure; the cache is hygiene.
