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

## Now — Milestone 51 in review (2026-10-07)

Milestone 51, relationship facts, is built on `milestone/m51-relationship-facts` as
0.49.0 (ARCHITECTURE #336–#339), PR open, not merged. The warehouse is migrated (0033),
loaded and analysed, and 20 of the 21 county readings were regenerated against packet
1.5 (see the reading items under Open).
After merge: `make publish`, `make deploy`, `make check-live`, then `make clean-dist`.
Next: Milestone 52, historical persistence facts, only when asked.

**To resume:** `make db-up` for Postgres; `make api` for the API on 8000. A new
environment needs the FCC summary ZIP in `data/manual/fcc_bdc/` (ARCHITECTURE #322).

Open items a planned milestone now covers say so with **Scheduled: Milestone N**. They
stay here until that milestone starts and takes them into `Now`.

## Open

Every open item, wherever the work originated. The tag in parentheses is where it was
first raised, not where it must be done.

### Correctness and data integrity

- [ ] **62 school-district associations have no NJDOE performance record.** (M47, #319)
      Boundary and performance editions or excluded district types; review the publisher
      IDs. Kept unmatched, never matched by name.
- [ ] **Crime newer than 2023.** (M47, #320) NJSP's newer reporting route warns a zero
      can be delinquent reporting; audit its missing-report codes and schema before
      replacing the reviewed 2023 workbook. A town's own figures need an evidenced
      agency-to-municipality crosswalk, not names.
- [ ] **The completeness check counts facts only.** (M47) Its tables do not see the
      community inventory's suppressions, agency months or CDC intervals; the coverage
      for those is in the M47 handoff until the check reads `community_records`.

- [ ] **BPU reliability covers JCP&L only.** (M42, #308) ACE's 2024 annual filing was
      found but not imported; PSE&G's and Rockland's are unverified, and the BPU portal
      challenges automated access. EIA-861 covers all four in the meantime.
- [ ] **NJDEP's public lead-line layer stops at the 2024 submission**, though statewide
      2025 totals exist. (M42) A newer per-system export would have to be requested.
- [ ] **Five counties have no DOE energy burden.** (M42) Essex, Hudson, Middlesex,
      Monmouth and Somerset carry signed weights or costs in DOE's file; withheld, not
      zeroed, until DOE explains them.
- [ ] **LIHTC is downloaded by hand each spring.** (M41, #307) HUD's release page
      answers scripts with an empty 202, so discovery reads `unreachable`. When HUD
      publishes 2025 data (announced for spring 2027), download the ZIP, copy the
      property workbook to `data/manual/hud_lihtc/LIHTCPUB_2025.xlsx`, and run
      `hip acquire --source hud_lihtc --vintage 2025`; the handoff
      (`agent-handoffs/affordable-housing-assistance.md`) has the full steps.
- [ ] **636 LIHTC projects are not placed in a town.** (M41) 591 resolve only to a
      county and 45 only to the state, where a Census place spans several towns.
- [ ] **Most of Morris County has no flood zone share.** (M40, #301) FEMA's digital map
      covers 14.6% of its homes and Atlantic's 53%; the share is withheld below 95%.
      Morris's paper FIRMs are not read. Re-check when FEMA's coverage moves: the page
      fills in on its own once `fema_mapped_homes_share` reaches 0.95.
- [ ] **New Jersey's PFAS violations are not counted.** (M40, #304) EPA's SDWIS carries
      no PFAS code for New Jersey in 2021–2026. Milestone 42 added measured PFAS from
      EPA's UCMR 5, which is not a violation record; NJDEP's own violations are still
      not read, and Drinking Water Watch remains the link.
- [ ] **Flood claims are not placed in towns.** (M40, #302) 11.5% of New Jersey's
      claims are in 2010 block groups. A 2010-to-2020 block group relationship file from
      the Census would place them; until then a town shows its county's.

- [ ] **DCA's Construction Reporter has stopped at January 2026.** (M39, #300) DCA says
      the program is being overhauled. When its 2025 yearly summary posts (one usually
      does around July), discovery finds it and it replaces the preliminary year to date
      on its own; if the overhaul changes the files' names or layout, the adapter
      refuses rather than misreading. Worth a look each quarter.
- [ ] **Fewer towns report each year.** (M39) Certificates from 559 towns in 2014 and
      527 in 2024; demolitions from 542 and 465. County and state totals cover less of
      their area than they did, which the page says, but a long-run line of county
      totals mixes a real trend with a reporting one. A per-town series is unaffected.
- [ ] **The New Jersey page has no "Is it adding homes?" section.** (M39) The state's
      figures are loaded and in its tables; the section is on town and county pages only,
      because the state page is laid out differently. Add it if the state view needs it.

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

- [ ] **Crosswalk weights carry ~1% area error for polygons with few vertices.** (M1)
      `ST_Transform` reprojects vertices without densifying edges. Negligible for real
      TIGER geometry, which is vertex-dense; it only shows up in synthetic test fixtures.
      Revisit if a source ever supplies coarse polygons.
- [ ] **SR1A carries four fields the aggregates ignore.** (M25) `assessed_value_total`,
      `sales_ratio`, `year_built` and `living_space` are landed and unused. `living_space`
      is the one that matters: a price per square foot on *transactions* is not derivable
      from anything else the warehouse holds, and it is the figure that makes two towns'
      medians comparable when their housing stock differs. Check the field's fill rate
      before scoping it — the median is meaningless if half the deeds leave it blank.
      **Scheduled: Milestone 36.**
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

- [ ] **The rubric benchmark for the next consumer-reading list.** (M51, #341) Gemini
      3.7 Flash answers as 3.8, so every reading now comes from Flash-Lite. The owner
      chose a full rubric run before deciding, judged by Claude Opus 5.5, over: Gemini 3.8
      Flash (low thinking), Gemini 3.1 Flash-Lite, DeepSeek Flash (thinking off) and
      Claude Haiku 5.5, with 3.7 Flash's `v3` score as a reference from another judge.
      Not run until the owner says go. Ready: Anthropic is a provider and Haiku 5.5 is
      configured at low effort (#342); `hip eval models --probe` on 2026-10-08 passed
      3.8 Flash and Haiku and flagged 3.7 as substituted. GLM and Kimi were considered
      and dropped by the owner (2026-10-08).
- [ ] **Salem has no current reading.** (M51) Flash-Lite and DeepSeek were refused by
      the gates (jargon, a population figure, survey figures without margins, four
      figures) and Gemma could not run (below), so Salem's 2026-10-05 reading stays,
      marked out of date. Retry once the first model is settled.
- [ ] **Gemma's context window no longer holds every packet.** (M51) Packet 1.5's
      relationships pushed Salem's prompt past `limits.context_tokens` (12,288,
      `config/evaluation.yml`), so the local last resort failed rather than truncate.
      Measure the largest county prompt and Gemma's memory at a larger window before
      raising it.

- [ ] **A reading's claims without a figure go unchecked.** (#275, 2026-10-01) Gemini's
      test reading of Hudson said rents take "a particularly large share of household
      budgets" under *What stands out here?* with no figure behind the words
      (`reports/evaluation/readings-v6.md`; ARCHITECTURE, Known Limitations, "Binding
      checks figures, not claims"). Binding checks numbers only, so a figure-free claim
      passes whether the packet supports it or not. Possible directions, none decided:
      a gate that refuses comparative words ("large share", "highest", "among the")
      in a sentence that cites no figure for the measure named; or the judge's
      `factual_accuracy` run on a sample of published readings after each regeneration.
      Milestone 51 (#337) refuses causal wording between *cited* measures; a causal
      claim between measures named only in words is the same blind spot.
      A second case on the packets of Milestone 34 (`reports/evaluation/readings-v8.md`):
      Cumberland's reading called Zillow's home value a five-year survey estimate.

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
      and CHAS and the parsing of the last two, and `tests/test_migration.py` the IRS's
      requests, discovery and file shape (M50). Zillow's ZHVI and ZORI, FRED, BLS and
      FHFA still have nothing that reads a stubbed response, so a publisher changing a
      file's shape surfaces as a pipeline failure rather than a test failure.
      `test_nj_modiv.py` is the pattern to copy — a `MockTransport` subclass, no network.

### API and scale limits

- [ ] **Two published limits have no headroom for Milestone 15.** (pre-M12 review)
      `/regions/{id}/metrics` is published at its default `limit=5000` with nothing in
      the response saying whether it truncated; the largest region carries 1,152
      observations since Milestone 34 (Hudson County; 760 before), so this is a watch
      item. `/rankings` caps at 1,000, below the
      3,144 counties national coverage would add (Milestone 15, unscheduled) — a national
      ranking would be silently cut off at rank 1,000.
- [ ] **Rank ranges compare every pair of regions, and Milestone 34 made that slow.**
      (M34, measured 2026-10-01) `_rank_ranges` joins each ranking group to itself, so
      a group costs the square of its regions: 598 ZCTAs across 26 more ranked metrics
      and five windows took the step to about three minutes a rebuild, and the Python
      suite, which rebuilt six times, to well over half an hour (since 2026-10-02 it
      rebuilds twice, under `make test-all`; #299). The weekly refresh
      rebuilds once, so it is tolerable for New Jersey; at Milestone 14's seven states it
      is not. A sort-based count, or the step moved to DuckDB, are the leads.
- [ ] **New Jersey is hardcoded in three places**, despite `config/geography.yml` stating
      no state code is hard-coded anywhere in `src/hip`. (pre-M12 review) NJ's
      odd-numbered county FIPS in [registry.py:100](src/hip/sources/registry.py:100),
      which is a real arithmetic assumption about one state; and `?state=NJ` in both
      [publish.py:200](src/hip/publish.py:200) and
      [web/lib/api.ts:437](web/lib/api.ts:437). Blocks the Northeast expansion
      (Milestone 14, unscheduled).
### Frontend and presentation

- [ ] **"Somewhere like here, but cheaper" for ZIP codes.** (M46, #317) Towns only: ZIP
      codes have no recorded-sales price, and matching them on Zillow's or the ACS's
      value would compare a different measure from towns'. Needs a ZIP-level SR1A price
      (sales placed by their parcel's ZIP) or a decision to use another measure there.

- [ ] **Accessibility still needs people, not scripts.** (M43, #309) Screen-reader
      review with VoiceOver and Safari, and NVDA with Firefox or Chrome; a physical
      iPhone; true 200% text and 400% zoom; print in Safari and Firefox; and axe's
      remaining needs-review results. The handoff (`m43-accessibility-audit.md`) lists
      each.
- [ ] **The home page's illustration loops with no pause control.** (M43, #309) Removed
      at the owner's request on 2026-10-05; WCAG 2.2.2 asks for one on anything that
      moves for more than five seconds. Reduced motion stops it. The New Jersey header
      artwork added 2026-10-06 (#311) loops the same way.
- [ ] **The budget explorer's comparison scope is not in its address.** (PR #86, Codex
      handoff `local-page-layout.md`) A page's link opens `/afford` with its place and
      county; switching to another county or all New Jersey changes local state only,
      so a shared or reloaded link returns to the original scope.
- [ ] **`/?mode=afford` bookmarks open the national entry.** (PR #88, #94, #305) Old
      `/states/new-jersey?mode=afford` links now forward to `/afford`, but the root
      address cannot, since `/` is a real page; a county page's `?mode=afford` shows
      the profile.
- [ ] **Re-read the cost rules once a year.** (M33) `web/lib/costRules.ts` carries HUD's
      FHA premiums, NJ's transfer and graduated fees, the CFPB's closing range and Freddie
      Mac's mortgage-insurance range, each with `reviewed: 2026-10-01`. Next: 2027-10-01,
      or when HUD issues a mortgagee letter on premiums.
- [ ] **ZIP pages have no insurance or utility figures.** (M33, #279) The ACS is not
      fetched by ZIP (Milestone 34), so a ZIP's cost card reads as a partial estimate.

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
      and schedules schools, commutes and crime for Milestones 45–47 (flood risk was
      answered by Milestone 40), but no page tells a reader; the check counts 6 of its
      17 questions as neither answered nor declined. A short statement on the site would move them to declined.
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

- [ ] **The county lookup links are not checked automatically.** (M38, #293) All 21
      worked by hand on 2026-10-02; a county moving its search would leave a dead link
      until someone notices. `check-live` could request each, at the cost of 21 requests
      to county servers per deploy.
- [ ] **A removal list deleted inside iCloud reads as "no removals".** (#296) Publishing
      refuses when the list's folder is missing or the file is an undownloaded
      placeholder, but a list deleted outright (iCloud keeps it 30 days in Recently
      Deleted) looks like the state before the first notice. A count of withdrawals
      recorded in the published manifest, checked against the next publish, would catch
      it.

- [ ] **The site's status link cannot say when a check last succeeded.** (PR #45, #251)
      It names the Friday schedule and the build date; a quiet Friday that found nothing
      leaves the build date where it was, and nothing published records the run itself.
      Publishing the last successful check apart from the snapshot would let it say so.
- [ ] **`npm run build` alone points report links at localhost.** (PR #45) Without
      `NEXT_PUBLIC_ARTIFACT_URL` the Markdown-report link falls back to the local API;
      `make publish` sets it, so the deployed site is right, but a bare build warns and
      is wrong.
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

- [ ] **Re-read the publishers' release calendars before they run out.** (#298) Recorded
      by hand on 2026-10-02 in `config/sources.yml`: BLS's ends 2026-12-30, Zillow's
      2026-12-17, FHFA's 2027-11-30, the Census Bureau's population estimates May 2027,
      HUD's rents 2027-10-01. Past the last date the page says "No date announced",
      which is true but less useful. Check each January; add the ACS edition's date when
      the Census Bureau announces it.
- [ ] **Gemini Flash prices double on 2027-01-01.** Gemini 3.6–3.8 Flash's introductory
      $0.75 / $3.75 per million tokens ends 2026-12-31 and becomes $1.50 / $7.50 (Flex
      half of each). Update `config/evaluation.yml` that day, or `hip explain`'s cost
      line will under-report by half.

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
      a violation reaches `main` whenever someone runs `make test` or `make test-all`
      and stops there —
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

- [ ] **Revisit the refresh's hour when generation costs scale.** (2026-10-02, #259) The
      Friday 08:00 run is kept for now. Some Gemini Flex calls fall back to the standard
      price (4 of 23 on 2026-10-02), costing cents a run; if more states multiply the
      readings, test whether an overnight slot after Thursday's releases (Friday 01:00
      ET is also DeepSeek off-peak; 02:00 is not) gets Flex more often. Needs the Mac
      awake then, since launchd runs a missed slot at wake.

- [ ] **A lawyer's read of the lookup under Daniel's Law.** (M38, #295) The removal route
      takes the cautious reading; whether an address with no name is covered, and whether
      the lookup needs more, is unsettled and was not reviewed by counsel.

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

- [ ] **The site owes FRED a sentence in a terms of use it doesn't have.** (M32,
      #278) FRED's API terms: an application for other users must "explicitly state in
      your application's terms of use that, by using your application, your users are
      agreeing to be bound by the FRED® API Terms of Use". The site shows FRED's notice
      and links its terms, but has no terms of use. A short terms page linked from the
      footer, saying that and nothing it can't keep, settles it.
- [ ] **The Markdown report does not carry each figure's kind or licence.** (M31) The
      report page and the CSV do, and the downloadable Markdown closes with the terms and
      notices and leaves display-only figures out (`render_report`). The kind and licence
      per row are left out on purpose: `render_markdown` is also the payload a reading's
      model is given, and a change to it is a change to every reading's input, which
      wants its own side-by-side.

### Data sources worth adding

- [ ] **Milestone 34's ACS depth stops at ZCTA; tracts have none of it.** (M34) The
      warehouse holds 2,181 tracts and the ACS publishes every M34 table for them, but
      no tract page shows Census figures yet. Left out by decision on 2026-10-01; the
      adapter would take a `tract` level beside `county` and `cousub`.

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
- [ ] **Jobs located in a place, from LODES** — Milestone 45 read where residents work
      (#313), not how many jobs a place holds. LODES's workplace-area (WAC) file, or the
      origin–destination files already landed summed by workplace, would give a
      jobs-to-homes balance. Not scheduled.
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

- [ ] **Revisit: donations or grants under the non-commercial decision?** (owner,
      2026-10-07) #323 rules out ads, sponsorship and a paid tier for good, and stays as
      is. To revisit: whether to allow individual donations (nothing shown in return)
      or a public-interest grant, while still excluding corporate sponsorship. Before
      any money is taken, check each restricted source's terms (Zillow, FRED, Freddie
      Mac, and CostQuest if licensed) against that specific arrangement, and keep what
      licence requests have said ("free, non-commercial") true.

- [ ] **Deploy speed-ups, held by the owner 2026-10-07.** Measured that day: a deploy
      took 18–20 minutes, of which `hip publish` was about 10 (now 1m 51s, run eight
      requests at once). Two more, each keeping every check:
      - **Upload only changed pages to Pages** (about 4 minutes to under 1 on most
        deploys). Every build gives each page a new build ID and "Built" date, so all
        ~14,250 files upload each time. Needs a build ID derived from code and data, and
        the owner's choice of what the footer's "Built" date shows (data date, not
        clock), or every page still changes daily.
      - **Run `check-dist` once, not twice** (about 25 seconds): `deploy` and
        `check-live` each run it over the 4.3GB tree.

- [ ] **FCC town and ZIP figures, and automatic updates.** (M47, #322) The county summary
      is imported by hand from the public download; check its selector for a newer
      edition. Waiting on the owner's inquiries:
      - **FCC** (2026-10-07): the API agreement's public-statement and security clauses.
        No reply yet.
      - **CostQuest, location Fabric** (2026-10-07): Maggie (NBF Support) replied that
        Tier 4R is "typically" for academic institutions and government bodies, and
        asked for context. The owner answered the same day: independent developer, free
        non-commercial site (#323), Fabric used only to assign FCC records to towns and
        ZIP areas, aggregates published, never records or addresses; asked whether this
        qualifies or whether a university partnership or other licence would. Awaiting
        a reply; follow up after about two weeks. A partner's licence would need to
        cover publishing on this site.
      - **Towns without the Fabric, measured 2026-10-07:** the FCC's New Jersey
        Census-place summary (701 places, owner's download) covers 323 of 564 towns
        exactly — every borough (252), city (52), town (15) and village (3), and no
        township (0 of 241) — about 49% of homes. A place counts as a town where 99.5%
        of each's 2020 homes are in the other, by LODES's block crosswalk (ARCHITECTURE
        #313); the result was the same at 95%. Not built, by the owner's choice
        (2026-10-07): a layer for boroughs and cities only would leave townships on
        the county figure beside them, so wait for CostQuest; revisit only if the
        Fabric is refused. ZIP codes still need the Fabric. One FCC place is not in
        the 2020 crosswalk; check which place boundaries the FCC file uses first.

- [ ] **NJDEP radon tiers: waiting on NJDEP.** (M49, #331) The guide shows test-every-home
      advice and links, not a tier: the tier table is undated, links
      `radon_tier_2015.pdf` and lists pre-2013 Princeton, and its pages refuse scripts.
      Terms are answered (nj.gov legal statement, Section F). The owner asked NJDEP
      through the Radiation Protection contact form on 2026-10-07 whether the tiers have
      been updated since 2015, whether an update is planned, and for a downloadable file.
      Recommended, not yet decided by the owner: add a tier only if NJDEP says it is
      current and gives a file to refresh from — matched to towns by name, type and
      county (540 entries, combined towns named) and shown beside the test advice —
      and keep the advice alone if the tiers are still 2015's. Follow up after about two
      weeks.

- [ ] **NJ TRANSIT service frequency.** (M45, decided 2026-10-06) Only NJ TRANSIT's own
      GTFS says how often anything runs. It needs a developer account the owner would
      register, its agreement says the data "is not to be relied on for any commercial
      purposes", and it asks that the data be used "as-is", which counting trips may
      not be. Waiting on the owner: register and accept, or leave frequency out.

- [ ] **Milestone 44, evictions: how to read DCA's dashboard.** (handoff
      `agent-handoffs/m44-evictions.md`) DCA's Joseph Naylor replied 2026-10-07: the
      figures are not available as a download, and showing them publicly is no problem.
      Terms are answered for display; still open: whether the court's (AOC) figures it
      shows carry their own terms, the corrected year labels, and how to acquire them —
      the dashboard's own export if it has one, an owner-run manual export like Zillow's,
      or not at all. Owner's decision.
- [ ] **Advanced Data Protection for the removal list.** (#296) The list holds protected
      addresses in iCloud Drive, which Apple can read unless Advanced Data Protection is
      on (System Settings → Apple Account → iCloud). Tabled by the owner 2026-10-02.

- [ ] **Readings stale only when the figures they cite change?** Zillow's monthly
      release moves every packet's content hash, so every reading is rewritten monthly
      whether or not it quotes Zillow. The stored binding names each figure a reading
      cites, so staleness could be decided on those alone. Risk: a sentence like "rents
      rose sharply" that cites no figure goes out of date unnoticed. Matters at
      municipal scale (about $42 a refresh, Milestone 19's estimate), not at 21
      counties. Owner's decision; it would amend Milestone 13's staleness rule.

      **Measured 2026-10-01:** 34 of the 42 published readings quote a figure that
      changes monthly (Zillow's home value in 32), so the rule would spare at most 8
      readings a Zillow month — less once the risk is covered. Covering it: count as
      cited every measure a reading names in words as well as in figures, and keep a
      reading only if its stored text still binds to the new packet and passes every
      gate. That shrinks the risk to wording no measure name appears in, and shrinks
      the saving further. **Kept parked by the owner (2026-10-01)**: the saving is
      small while nearly every reading quotes a monthly figure.

- [ ] **Zillow's files are downloaded by hand, as a standing arrangement.** (M31, #272)
      Its Terms of Use forbid automated fetching, and its pages neither exempt a monthly
      scripted download of the public CSVs nor offer a channel to ask (2026-09-30: the
      contact page lists customer support, press and ZTRAX only). Milestone 32 found no
      route around it: the licensed API's terms forbid what the site does (#278), so
      nothing is applied for, and this stays the arrangement.
- [ ] **Rotate the keys that were pasted into chat.** The cache half is finished (see
      below); this is the part that matters and the part only you can do.

      **Rotate (yours; these cannot be done here).** Each in its own provider console:
      **Qwen/DashScope**, pasted 2026-09-11, and **Mistral**, pasted 2026-09-06 — both
      providers were removed on 2026-10-08 (#340), so revoke these rather than rotate,
      and delete `MISTRAL_API_KEY` and `DASHSCOPE_API_KEY` from `.env`. **DeepSeek** and
      **Gemini**, pasted 2026-09-06. **Census**, **FRED**, **BLS** and **Anthropic**, pasted in
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
