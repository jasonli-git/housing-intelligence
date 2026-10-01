# Housing Intelligence Platform — TODO

Open work only. Shipped detail lives in [CHANGELOG.md](CHANGELOG.md), decisions and
limitations in [ARCHITECTURE.md](ARCHITECTURE.md), milestone status and sequencing in
[ROADMAP.md](ROADMAP.md).

Completed milestone sections were removed on 2026-09-19 when this file was restructured
into `Now` / `Open` / `Parked`. They are recoverable with
`git show 62bc3c2:TODO.md`, and what they shipped is in `CHANGELOG.md`.

**Last audited against the code on 2026-09-27.** Sixteen entries were closed: ten open
items the code had already resolved or that no longer apply, and six ticked ones whose
record lives in CHANGELOG or ARCHITECTURE — one of which hid an open decision, restated
under Open decisions. The rest were checked and, where they had drifted, rewritten. The
removed entries are in `git show ca49f74:TODO.md`.

## Now — Milestone 31 built, awaiting review (2026-09-30)

Milestone 31 is complete on `milestone/m31-licence-provenance` (0.26.0): every figure's
kind shown beside it, a licence class per source that a calculated figure inherits, the
notices the sources' terms require on every page, a CSV of each region's figures that
carries all three, a print footer, and a written acquisition policy. CHANGELOG 0.26.0
has what shipped and ARCHITECTURE #269–#271 the decisions.

**After the merge:** `make migrate` (0020 adds the columns), `hip sync-registry` (fills them
from config), then
`hip explain --dry-run` to re-cite the readings for free — packet 1.4 moves the packet
hash but not the content hash — then `make publish`, deploy and `make check-live`.

**Waiting on the owner,** under Parked: Zillow's and Realtor.com's terms, which refuse
automated readers, and whether to ask Freddie Mac about the mortgage rate.

**To resume:** `make db-up` for Postgres; `make api` for the API on 8000.

Open items a planned milestone now covers say so with **Scheduled: Milestone N**. They
stay here until that milestone starts and takes them into `Now`.

## Open

Every open item, wherever the work originated. The tag in parentheses is where it was
first raised, not where it must be done.

### Correctness and data integrity

- [ ] **A packet's `cagr` for a survey figure carries no margin.** (M30, #256) The
      Markdown report and so the readings leave a survey figure's annualised change out,
      because nothing computes its margin, but the packet's JSON still carries the
      number — an API response stating a survey figure without its margin, short of
      SPEC principle 12. Either compute the margin in `hip analyze` (the Census ratio
      formula carried through the root) or null the field for survey figures.

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

- [ ] **HUD income limits are dated by calendar year, so the newest ends in the
      future.** (found 2026-09-23, verifying Milestone 26) `stg_hud_income_limits`
      dates each year 1 January to 31 December, so FY2026's limits run to 2026-12-31 —
      a date not yet reached — and `price_to_ami` inherits it; the county reports now
      say their metrics "reach to 2026-12-31". The site labels the period "2026", as HUD
      names it, so no page misreads. But the dates also claim FY2026 applied from
      January, when a year's limits apply from the effective date in HUD's annual notice
      (not checked here). Dating by effective date, as Fair Market Rents are (#106), is
      the fix to weigh; it moves every AMI ratio's window. Since Milestone 27 a reader can
      see it: `/freshness` shows the source's data "through Dec 2026", marked as a period
      still under way.

- [ ] **The validation gate has no range bounds for the two HUD metrics.**
      (pre-M12 review) `hud_area_median_income` and `hud_income_limit_80` are absent from
      `VALUE_BOUNDS` ([gate.py](src/hip/validate/gate.py)), so the one metric family
      feeding `price_to_ami` passes unchecked. Every other loaded metric has bounds.
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
      **Scheduled: Milestone 37.**
- [ ] **SR1A carries four fields the aggregates ignore.** (M25) `assessed_value_total`,
      `sales_ratio`, `year_built` and `living_space` are landed and unused. `living_space`
      is the one that matters: a price per square foot on *transactions* is not derivable
      from anything else the warehouse holds, and it is the figure that makes two towns'
      medians comparable when their housing stock differs. Check the field's fill rate
      before scoping it — the median is meaningless if half the deeds leave it blank.
      **Scheduled: Milestone 36.**
- [ ] **`web/lib/groups.test.ts` pins a hand-copied metric catalog.** (M25, found
      2026-09-20) The comment says a new metric "shows up there as a failure to
      classify", but the catalog is a literal list snapshotted from `GET /metrics`, so
      four new metrics went unclassified without failing anything — they would have
      rendered under "Other measures" silently. Derive the list from
      `config/metrics.yml` or from a recorded API response, so the guard guards.

- [ ] **A revalidated source's last check is recorded nowhere the freshness page
      reads.** (M27, #222) Zillow, FRED and FHFA are asked every refresh, but only
      whether a file changed is kept, so `/freshness` says it does not yet record when.
      Recording the check time per source at `hip refresh` and loading it with the
      discoveries would let the page show a date it can back.

- [ ] **HUD's CHAS figures carry no margins of error, which SPEC principle 12 requires.**
      (M28, #235, #246) HUD's API publishes none; its bulk CHAS files do (`_moe` columns
      beside each `_est`). Switching the adapter to the bulk files would give the three
      CHAS figures their margins and their ranks ranges; meanwhile each reads "no margin
      available".
- [ ] **`/changes` shows revised survey figures without margins.** (M28, #246) The
      revision trigger (#194) records old and new values only; recording the margins
      beside them would let the page show both, as principle 12 asks.

### Evaluation harness

- [ ] **`import_gguf.sh` was lost, so nothing in the repo rebuilds the local models.**
      (M8 prep; found lost 2026-09-23) It and `kvbench.sh` lived in a `/private/tmp`
      scratchpad and did not survive a reboot around 2026-09-15. The four
      `bench-*` models in Ollama still work, so this matters only when one is next
      imported — and then the script has to be rewritten with the passthrough-template
      defect fixed (ARCHITECTURE #62). `kvbench.sh` is not needed: the KV-cache question it
      served was settled without a change (#215).

### Test coverage

- [ ] **`tests/test_analytics.py` rebuilds the analytics tables in the live warehouse.**
      (found in review of PR #56, 2026-09-30) Its tests call `rebuild(get_engine())`
      against the same database the API serves, so a suite run while the API or another
      query is busy can deadlock. Nothing is lost — the rebuild is one transaction and
      rolls back — but the run fails for a reason unrelated to the code. Point these
      tests at a scratch schema or a disposable database.
- [ ] **Tests: unpivot shape and gate behavior — never written.** (M2, corrected
      2026-08-13 after this line was briefly ticked in full) `test_matching.py` builds
      `stg_zillow_zhvi` as a hand-made fixture, so the dbt UNPIVOT of ~318 date columns
      is exercised by pipeline runs only. `hip.validate.gate` (216 lines) has no test
      importing it at all — the thing whose whole job is to block a bad load is the
      least-tested module in the pipeline.
- [ ] **Unit tests for the source adapters.** (M3; narrowed 2026-09-27) Coverage has
      grown: TIGER, MOD-IV, SR1A and the NJ tax rates have their own tests, and
      `tests/test_sources.py` drives the requests of ACS, PEP, permits, Fair Market Rents
      and CHAS and the parsing of the last two. Zillow's ZHVI and ZORI, FRED, BLS, FHFA
      and IRS still have nothing that reads a stubbed response, so a publisher changing a
      file's shape surfaces as a pipeline failure rather than a test failure.
      `test_nj_modiv.py` is the pattern to copy — a `MockTransport` subclass, no network.

### API and scale limits

- [ ] **Two published limits have no headroom for Milestone 15.** (pre-M12 review)
      `/regions/{id}/metrics` is published at its default `limit=5000` with nothing in
      the response saying whether it truncated; the largest region carries 760
      observations today, so this is a watch item. `/rankings` caps at 1,000, below the
      3,144 counties national coverage would add (Milestone 15, unscheduled) — a national
      ranking would be silently cut off at rank 1,000.
- [ ] **`GET /regions?q=` passes `%` and `_` through to `ILIKE`.** (pre-M12 review) A
      caller searching for `%` matches every region. Cosmetic today; worth settling
      before Milestone 17 builds real search over this endpoint.
- [ ] **New Jersey is hardcoded in three places**, despite `config/geography.yml` stating
      no state code is hard-coded anywhere in `src/hip`. (pre-M12 review) NJ's
      odd-numbered county FIPS in [registry.py:100](src/hip/sources/registry.py:100),
      which is a real arithmetic assumption about one state; and `?state=NJ` in both
      [publish.py:200](src/hip/publish.py:200) and
      [web/lib/api.ts:437](web/lib/api.ts:437). Blocks the Northeast expansion
      (Milestone 14, unscheduled).
### Frontend and presentation

- [ ] **The paused-banner swipe and the atlas redesign are unverified on a real iPhone.**
      (PR #46, PR #48) Both were checked in Chromium only, the swipe with its touch
      emulation; iOS Safari's scrolling, pointer events and sticky table headers differ
      enough to be worth one pass on a device.
- [ ] **15 municipality pages priced from deeds show a caveat about Zillow's home
      value.** (M25/#187, found 2026-09-21 while reviewing the region redesign) Where
      Zillow publishes no home value, the cost card is priced from SR1A transactions —
      but the comparison caveat beside it still reads "Zillow's rent covers every kind of
      rental home, mostly apartments, while **its home value** covers single-family
      houses only". There is no Zillow home value on those pages. Verified live on
      Howell, Randolph, Wall and 12 others; it predates the redesign, which only moved
      the sentence. The rent half is still true and still worth saying, so this needs the
      sentence split rather than removed.
- [ ] **No component tests cover the region page's interactive behaviour.** (#201,
      declared by Codex in its handoff) Auto-advance, arrow wrapping, the progress
      hairline, floating definitions, responsive paging and report isolation were checked
      in a browser and are held by nothing. The project has no harness for interactive
      React; adding one is the prerequisite, and the report-isolation boundary is the
      piece most worth pinning, since a regression there would put client behaviour into
      printed reports.

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
      **Scheduled: Milestone 33.**
- [ ] **Fold `redesign.css` into `globals.css`**, so each component has one set of rules
      rather than two whose winner depends on file order (#162's cost). (Quiet utility)
      Mechanical and large — worth its own review.
- [ ] **The print rule that opens disclosures, `::details-content`, was checked in
      Chromium only.** (M18) A browser without it prints the licence label alone and the
      footer's institutions without their datasets. Check Safari and Firefox print
      previews before relying on it.
- [ ] **The README has no screenshots.** (Quiet utility) The eight it had predated the
      redesign and Milestone 23 and were removed; the section says so. Codex's
      2026-09-19 investigation (`agent-handoffs/screenshot-automation.md`) built a
      working capture command, `npm run screenshot:poc`, and recommended against
      automating it per push — retaking them is a manual step with tooling that exists.
      **Still blocked:** Milestone 27 chose this Mac on 2026-09-25, and only a runner
      off it unblocks automation (ARCHITECTURE #175).

- [ ] **The site does not say which questions it declines.** (M27 completeness run)
      ROADMAP decided on 2026-09-13 not to forecast prices or give investment advice,
      and schedules schools, commutes, crime and flood risk for Milestones 39–45, but no
      page tells a reader; the check counts 7 of its 17 questions as neither answered
      nor declined. A short statement on the site would move them to declined.
- [ ] **Report a problem is on a region's two full metric tables only.** (M27, #221)
      The cost cards, the verdict sentence, the New Jersey rankings and `/afford` quote
      figures without it. ROADMAP's row asked for every figure.
- [ ] **A figure's own history of values is not shown.** (M27, #224) `/changes`
      summarises each refresh; a region page neither marks a revised figure nor shows its
      earlier values, which `fact_revision` holds.

- [ ] **A model-comparison page on the site.** Dropped from Milestone 31 by the owner
      (2026-09-30); `reports/evaluation/v1.md`–`v3.md` and the readings side-by-sides cover
      it in Markdown. If revived: one page from the latest run, earlier runs listed but
      not merged, since their judging differed.

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

- [ ] **The site's status link cannot say when a check last succeeded.** (PR #45, #251)
      It names the Friday schedule and the build date; a quiet Friday that found nothing
      leaves the build date where it was, and nothing published records the run itself.
      Publishing the last successful check apart from the snapshot would let it say so.
- [ ] **`npm run build` alone points report links at localhost.** (PR #45) Without
      `NEXT_PUBLIC_ARTIFACT_URL` the Markdown-report link falls back to the local API;
      `make publish` sets it, so the deployed site is right, but a bare build warns and
      is wrong.
- [ ] **A failed `check-live` has no written runbook.** (raised 2026-09-26, after 0.24.0's
      deploy) The Friday run and `hip regenerate-now` send an urgent Pushover alert —
      "check-live failed after deploy … Check the log on the Mac" — and stop; nothing says
      what to do next. The steps today: rerun `make check-live`; if it fails again, read
      which page or manifest it names, fix forward (`make publish`, `make deploy`, `make
      check-live`), and roll the Pages site back from Cloudflare's dashboard if readers
      are meanwhile seeing a broken page. Belongs in README's Publishing section.
- [ ] **`check-live` alerts on its first failure, transient or not.** (raised 2026-09-26)
      A CDN still propagating, or a page-timing race like the one PR #42 fixed, reads the
      same as a real mismatch, and the site is already deployed by then. One retry after
      a short wait, before the urgent alert, would separate the two; a failure to start
      Chromium is the checker's own problem and could say so.
- [ ] **The published data files cannot be rolled back.** (raised 2026-09-26) `make
      publish` deletes the previous `dist/`, and `rclone sync` overwrites R2 in place, so
      only the Pages site has a previous deployment to return to — and rolling back the
      site alone would leave it beside the new artifacts. Keeping the last good build
      (or versioned artifact paths) would give both halves a way back.

- [ ] **Nothing stops `/afford` from acquiring a second price source.** (found
      2026-09-20) The comparison page reads `latest("zhvi_sfr", …)` directly rather than
      going through the warehouse ratios, so the test that keeps the transaction median
      out of `price_to_income` does not protect it — a map mixing Zillow-priced and
      deed-priced towns would render without failing anything. Verified Zillow-only on
      2026-09-20 by reading `web/app/afford/page.tsx`; that is a fact about today, not a
      guard.

### Documentation upkeep

- [ ] **Which README figures are mechanically derivable has never been settled.** The
      status counts (regions, observations, metrics, sources), the Tech Stack, the
      evaluation table and the resource and storage figures all have a queryable or
      file-based source; the status narrative, the Features descriptions and the setup
      prose do not. Deciding the boundary is what makes any "regenerate on deploy" work
      scopeable, and ARCHITECTURE #175 settles only the images half.

- [ ] **ARCHITECTURE's Module Layout stops at 2026-09-11, plus Milestones 27 and 28's
      files.** (found 2026-09-26) Files from Milestones 24–26 and 29 are missing —
      `sources/nj_sr1a.py` and `sources/nj_tax_rates.py` among them — and its counts
      are stale (15 sources and 31 metrics; 16 and 38 today). Its schema DDL block
      predates migrations 0012–0019, which the section says. The status lines at the top
      were brought up to date in Milestone 30.

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
      Suppressed in `pyproject.toml` for the test suite rather than fixed, because
      swapping the HTTP client was not Milestone 0 work — but every `hip` command prints
      it too (checked 2026-09-27), so it fills the scheduled runs' logs. Revisit before
      it becomes an error.

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
- [ ] **The 21 committed county reports are a snapshot that goes stale silently.**
      (M6; restated 2026-09-27) `reports/**` is gitignored, but the three evaluation
      reports and the 21 county reports were force-added and are tracked. The county
      reports were last regenerated on 2026-09-25, so they predate Milestone 28's
      renter cost burden fix, and the weekly run leaves them alone (it packs without
      `--report`, #227). Either regenerate and commit them whenever the data moves, or
      stop tracking them and link the published reports. **Not decided.**
- [ ] **Milestone 17's second user path needs a query the static tree cannot answer.**
      Someone evaluating a place they are moving to wants it compared against where they
      live now, which is `/compare` — one of three endpoints in the publish manifest's
      `unpublishable` list, because an arbitrary set of region ids is combinatorial. The
      consumer entry point therefore carries a dependency on a browser-side query layer
      over published data, and is larger than its roadmap row suggests.
- [ ] **`place` versus `cousub` outside the strong-MCD states.** Not yet a live
      decision — the Northeast states of Milestone 14 are all strong-MCD, Milestone 15
      stops at county level, and both are unscheduled. It becomes blocking the first time municipality-level data is wanted
      in a state where county subdivisions are statistical divisions.
      `config/geography.yml` already warns the identifier system is expensive to change
      once fact rows reference it.

- [ ] **Commercial-use rights are recorded only as the terms state them.** (M27
      completeness run; narrowed by Milestone 31) Every source's terms were read on
      2026-09-30 and classed in `config/sources.yml` (#269), which settles display,
      download and derived figures; whether each allows *commercial* use is what
      Milestone 32's licence table has to state, source by source. Zillow's terms are
      unconfirmed (see Parked). **Scheduled: Milestone 32.**
- [ ] **The Markdown report does not carry each figure's kind or licence.** (M31) The
      report page and the CSV do. Left out on purpose: the Markdown is also the payload a
      reading's model is given, and a change to it is a change to every reading's input,
      which wants its own side-by-side.

### Data sources worth adding

- [ ] **ACS housing-stock tables** — B25002 and B25003 landed in Milestone 21 as vacancy
      and homeownership rates; **B25024 (units in structure) and B25034 (year built)
      remain.** Same `CENSUS_API_KEY`, same adapter. Note the raw cache keys on the
      layer, so a table needs a new layer (ARCHITECTURE #108) — "a `metrics.yml` entry
      and a column" turned out wrong.
      **Scheduled: Milestone 34.**
- [ ] **FRED housing series** — `NJSTHPI` landed in Milestone 21 from FHFA's master file
      rather than FRED (ARCHITECTURE #109); **the three national series remain**: `HOUST`
      (housing starts), `RRVRUSQ156N` (rental vacancy), `MSPUS` (national median sale
      price). Each is a `sources.yml` line plus a `metric_id`.
- [ ] **Zillow's other cuts** — bottom-tier and top-tier ZHVI, SFR-only,
      new-construction sale price, days-to-pending, for-sale inventory. Same CSV host,
      same adapter, already anticipated.
- [ ] **LEHD LODES** — jobs by workplace and residence per census block, supporting
      jobs-housing balance and commute-shed analysis. Large but static files.
      **Scheduled: Milestone 43.**
- [ ] **ACS ZIP-level data is not fetched.** (M3) Since 2020 ACS no longer nests ZCTAs
      within states, so a ZIP pull means downloading all ~33,000 nationally per vintage
      for the 598 that matter.
      **Scheduled: Milestone 34.**
- [ ] **Zillow's home value reaches 388 of 564 municipalities (69%)** — a ceiling, not a
      bug. (M2, updated at M7; recounted 2026-09-27, when it was 403 before) MOD-IV landed
      and `region_identifiers` holds 554 NJ codes, so a crosswalk exists, but routing
      Zillow through it still needs a Zillow-name-to-CD_CODE mapping MOD-IV does not
      supply. ACS closed the gap to 564/564 separately, and since Milestone 25 a town
      without a Zillow value is priced from its recorded sales where it has them.
- [ ] **NJ Parcels geometry (`njgin_parcels`)** — **blocked.** No key needed, but the
      REST path Milestone 7 uses returns attributes only, and the geometry for a parcel
      map layer would be an enormous download.

## Parked / needs user input

- [ ] **Zillow's files are downloaded by hand, as a standing arrangement.** (M31, #272)
      Its Terms of Use forbid automated fetching, and its pages neither exempt a monthly
      scripted download of the public CSVs nor offer a channel to ask (2026-09-30: the
      contact page lists customer support, press and ZTRAX only). Revisit with
      Milestone 32: if it says go, the question goes to the Zillow Group developer
      program with the commercial application. A yes means `manual = False` on
      `_ZillowAdapter`. **Scheduled: Milestone 32.**
- [ ] **Ask Freddie Mac about the mortgage rate?** (M31, #269) Its PMMS page allows use
      with attribution; its general terms forbid publishing or redistributing its data
      without an agreement. The site shows the weekly and monthly rate, credited, and
      leaves it out of the CSV downloads; its series is still in the site's public JSON,
      which the pages are built from. Nothing public reconciles the two, so this is a question
      only Freddie Mac can answer — a candidate for the owner's outreach, or leave it as
      it stands.

- [ ] **Rotate the keys that were pasted into chat.** The cache half is finished (see
      below); this is the part that matters and the part only you can do.

      **Rotate (yours; these cannot be done here).** Each in its own provider console:
      **Qwen/DashScope**, pasted 2026-09-11. **DeepSeek**, **Gemini** and **Mistral**,
      pasted 2026-09-06. **Census**, **FRED**, **BLS** and **Anthropic**, pasted in
      earlier sessions. Update `.env` after each.

      **The cache half is done, as a side effect.** `hip prune-raw --apply` on
      2026-09-20 removed the superseded copies those 22 manifests belonged to — 21
      `bls` and 1 `fred` — so **0 manifests now carry a live key** and the 46 that
      remain all read `key=***`, having been written after ARCHITECTURE #76. Nothing
      further is needed here.

      **Scope, measured 2026-09-19.** `data/` is gitignored, HUD's bearer token is not
      recorded (manifests hold `url` only, and nothing matches bearer/authorization/
      token), and **no published artifact has ever carried a key** — checked against
      `dist/artifacts`. The chat transcripts are the real exposure; the cache is hygiene.
