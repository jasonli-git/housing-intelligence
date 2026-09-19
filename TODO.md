# Housing Intelligence Platform — TODO

Open work only. Shipped detail lives in [CHANGELOG.md](CHANGELOG.md), decisions and
limitations in [ARCHITECTURE.md](ARCHITECTURE.md), milestone status and sequencing in
[ROADMAP.md](ROADMAP.md).

Completed milestone sections were removed on 2026-09-19 when this file was restructured
into `Now` / `Open` / `Parked`. They are recoverable with
`git show 62bc3c2:TODO.md`, and what they shipped is in `CHANGELOG.md`.

## Now — nothing in progress, as of 2026-09-18

**Milestone 16 shipped on 2026-09-18 as 0.18.0, and with it Version 2 is complete.**
Versions 3, 4 and 5 were scheduled on 2026-09-18 from the owner's draft — see
[ROADMAP.md](ROADMAP.md) for the tables and the reasoning.

The next milestone is **24, fresher figures**, and it leads Version 3 for a specific
reason: it moves every ACS window by a year and regenerates every county explanation, so
anything built on those figures first would be rework.

**Standing rule, from the source register (ROADMAP):** a milestone proposing a new
metric names the register row it comes from, or adds one. The register also holds the
rejected sources and why, so Niche, Redfin, ZTRAX, FBI crime data and metro-level
single-family rent do not get re-proposed.

**Before starting anything:** Docker has to be running for Postgres (`make db-up`), and
`make setup-eval` rather than `make setup` whenever the evaluation harness is needed.

## Open

Every open item, wherever the work originated. The tag in parentheses is where it was
first raised, not where it must be done.

### Correctness and data integrity

- [ ] **A missing Census permits year aborts the whole `hip acquire`.** (pre-M12 review)
      The adapter docstring says a year whose file does not exist yet "fails its own
      fetch and leaves the others alone"
      ([census_permits.py:38](src/hip/sources/census_permits.py:38)), but `fetch_all` is
      a plain generator with no per-ref exception handling, so the `SourceError`
      propagates and takes every remaining source with it. Dormant until
      `default_vintage` is bumped ahead of publication. Either make the docstring true
      by catching per ref, or correct the docstring — the current pairing is the worst of
      the two, because it invites someone to rely on behaviour that is not there.
      Demonstrated live on 2026-09-06 by the HUD 429 described under `@current` refs
      below.
- [ ] **`hip acquire` never re-checks a `@current` ref.** (M12, found 2026-09-06)
      `fetch` ([base.py:200](src/hip/sources/base.py:200)) short-circuits on a local
      index keyed by `ref.key`, so once a ref is cached it is never re-fetched. Correct
      for a dated vintage, wrong for refs whose vintage is literally `current` — Zillow
      replaces those monthly at a stable URL. Measured: a full `make pipeline` reported
      172 cached, 0 downloaded, and recomputed from bytes fetched on 2026-08-11 while
      Zillow's own URL reported `Last-Modified: 2026-08-16`. `--force` re-downloads all
      172 rather than the seven that moved, and earned a `429` from HUD doing it. Fix is
      a conditional request — `If-Modified-Since` / `If-None-Match`, 304 treated as a
      cache hit — which keeps content-addressing intact. **Deliberately deferred to
      Milestone 29**, scheduled refresh with retry and alerting.
- [ ] **The validation gate has no range bounds for the two HUD metrics.**
      (pre-M12 review) `hud_area_median_income` and `hud_income_limit_80` are absent from
      `VALUE_BOUNDS` ([gate.py](src/hip/validate/gate.py)), so the one metric family
      feeding `price_to_ami` passes unchecked. Every other loaded metric has bounds.
- [ ] **Revision tracking — what the platform currently throws away.** (M19, raised
      2026-09-07) Zillow revises published months retroactively and the warehouse cannot
      see it: `fact_metric_observation` is keyed on
      `(region_id, metric_id, period_start)` and the loader upserts, so a revised June
      silently replaces the old June with no record that the figure moved. The only trace
      is the superseded file in `data/raw/`, which nothing reads and the prune below
      would eventually delete.
- [ ] **Nothing prunes superseded raw releases, and a refresh cadence makes that
      unbounded.** (M19, measured 2026-09-06) The raw tier is content-addressed and
      immutable by design (ARCHITECTURE #10), so a refresh leaves both copies on disk:
      31 superseded copies and 264MB on 2026-09-11, most of it three earlier Zillow ZHVI
      files at ~76MB a release. `hip analyze` prunes unreferenced `hip_derived` releases;
      there is no equivalent for downloaded files. A retention rule has to keep every
      release a fact cites.
- [ ] **`hip load` re-fetches every source's refs just to rebuild provenance.** (M3)
      That is `acquire`-level work inside `load` — harmless while cached, wrong in
      principle. The loader should read the manifests instead.
- [ ] **Crosswalk weights carry ~1% area error for polygons with few vertices.** (M1)
      `ST_Transform` reprojects vertices without densifying edges. Negligible for real
      TIGER geometry, which is vertex-dense; it only shows up in synthetic test fixtures.
      Revisit if a source ever supplies coarse polygons.

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

- [ ] **`make publish` assembling both halves into one directory.** (M11) Its done
      criterion is a reachable public URL.
- [ ] **The 21 stored explanations are stale until regenerated.** (pre-M12 review) Every
      packet changed at Milestone 21, and nothing new ships until the regeneration after
      `v3`. The live site is static and unchanged until then.
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

- [ ] **`hip check-config` exits 1 on a clean checkout** because three source API keys
      are unset. (M0) Correct behaviour, but it means `check-config` cannot be wired into
      `make lint` or CI until the keys exist.
- [ ] **Starlette's `TestClient` emits a deprecation warning asking for `httpx2`.** (M0)
      Suppressed in `pyproject.toml` rather than fixed, because swapping the HTTP client
      was not Milestone 0 work. Revisit before it becomes an error.

### Open decisions — not scheduled, not decided

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

- [ ] **Top up the Anthropic credit before run `v3` — to at least $15.** About $3.47
      remained after `v2`'s judging batch — a count from quoted batch costs, not a
      console reading, so check the console. `v3` needs roughly $11.50–12.50 at the
      judge's new effort, `high`, for 165 verdicts since the four Qwen candidates joined
      on 2026-09-11 (it was $8–10 for 105). `hip eval cost --run v3` quotes it before
      anything is spent, and `hip eval judge` prints what was actually billed. The credit
      is read only by `hip eval judge`, so nothing else waits on it.
- [ ] **32 manifests and their files under `data/raw/` still contain live API keys.**
      (pre-M12 review) #76 stops new ones being written; it deliberately does not rewrite
      the immutable content-addressed tree that already exists. `data/` is gitignored and
      nothing published ever carried a key, so this is local hygiene rather than
      exposure — but the keys are also in an August chat transcript, which is the
      stronger reason to rotate. To clear the tree, delete the three sources and
      re-acquire.
- [ ] **Rotate the Qwen (DashScope) key when convenient.** Pasted into chat on
      2026-09-11 and written into `.env`.
- [ ] **Rotate the DeepSeek, Gemini and Mistral keys if the 2026-09-06 transcript is ever
      shared.** All three were pasted into chat to be written into `.env`, the same
      situation as the Census, FRED, BLS and Anthropic keys.
