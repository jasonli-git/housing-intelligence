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

**Triaged on 2026-10-09**, with the owner: ten dated chores moved into the Calendar
table under Open, and seven items closed — two the code had already done (ZIP pages'
insurance and utility figures, and the housing-stock tables, both Milestone 34), two
overtaken (the lost `import_gguf.sh`, since generation is hosted only, #345; a batch path
for Haiku, since GPT-6 Luna heads the list on Flex at half price, #352), and three that
were records rather than work, moved to the file that owns each (Zillow's coverage
ceiling and parcel geometry to ARCHITECTURE's limitations, the model-comparison page to
ROADMAP's unscheduled ideas). They are in `git show a26d401:TODO.md`.

## Now — launch readiness (2026-10-09)

The correctness pass (ARCHITECTURE #350, #353–#356), the terms and privacy pages (#357),
site metadata (#358) and the reliability work (#359) have shipped. On 2026-10-09 the
owner parked the four data additions (below, under Parked) rather than build them:
none answers a reader question the site cannot already answer. The next focus is the
owner's to choose. Version 3 is complete and Version 4 optional (owner, 2026-10-09).

## Open

Every open item, wherever the work originated. The tag in parentheses is where it was
first raised, not where it must be done.

### Calendar — dated and recurring chores

Not open work: each comes round on a date. The steps live where the row says.

| When | Chore | Steps |
|---|---|---|
| Each January | Re-read the publishers' release calendars (BLS's ends 2026-12-30, Zillow's 2026-12-17; FHFA, PEP and HUD's run to 2027); add the ACS edition's date when announced (#298) | `config/sources.yml` `release_calendar` |
| 2027-01-01 | Gemini 3.6–3.8 Flash's introductory price ends: $1.50 / $7.50 per million tokens (Flex half); update `config/evaluation.yml` the same day | — |
| Each quarter | Look at DCA's Construction Reporter, stopped at January 2026 while DCA overhauls it; discovery picks up the yearly summary (usually July) on its own, and a changed layout is refused (#300) | `config/sources.yml` `nj_construction` |
| Each June and December | FCC's broadband summaries (`fcc_bdc`) are downloaded by hand, so no refresh notices a new filing (#360). Look for an as-of date or revision newer than the one held | Download the county and place summaries from FCC's data download into `data/manual/fcc_bdc/`, then `hip acquire --source fcc_bdc --vintage <as-of>_<revision>` |
| Each January | DOE's LEAD energy burden (`doe_lead`) is pinned to its 2022 data, and a newer edition would be a new OpenEI submission at a new address (#360). Look for one | If there is one, review its county file against `EnergyBurdenAdapter` before moving the URL |
| About December 2026 | SAIPE's 2025 income estimates extend the long-run comparison past 2024 (#348) | automatic on refresh |
| With each CHAS release (about a year after 2025-12-23) | Download the county and town ZIPs and the dictionary; review Table 8; add to `CHAS_BULK_REVIEWED` (#353) | `config/sources.yml` `hud_chas_bulk` |
| Spring 2027 | LIHTC 2025: download by hand to `data/manual/hud_lihtc/LIHTCPUB_2025.xlsx`, then `hip acquire --source hud_lihtc --vintage 2025` (#307) | `agent-handoffs/affordable-housing-assistance.md` |
| About June 2027 | Request the four utilities' 2026 reliability reports from BPU's Records Custodian; review each table into `REPORTS` (#347) | `config/sources.yml` `nj_bpu_reports` |
| Late summer each year | Add NCES's next district directory to `CCD_LEA`; `DISTRICT_SUCCESSORS` is rechecked on read, and its rows can go once NJOGIS redraws the Henry Hudson merger (#356) | `hip.sources.community` |
| 2027-10-01 | Re-read the cost rules in `web/lib/costRules.ts` (HUD's FHA premiums, NJ's transfer fees, the CFPB's closing range, Freddie Mac's mortgage-insurance range), or sooner on a HUD mortgagee letter on premiums | `web/lib/costRules.ts` |
| Before it expires | Renew the restricted OpenAI key (List models: Read; Chat completions: Request) and replace `OPENAI_API_KEY` in `.env`; $5 prepaid, auto-recharge off (#351) | OpenAI console |

### Correctness and data integrity

- [ ] **Hudson's long-run comparison is withheld.** (M52, #348) FHFA's index over SAIPE
      income rose 16.3% over 2019–2024 while Zillow's value over ACS income fell 2.3%:
      Hudson's mix leans to condominiums, which FHFA's mortgage-based index and Zillow's
      typical value weigh differently. Revisit if a later year brings them into line, or
      decide whether a disagreement of a few points near zero should withhold at all.
- [ ] **Crime newer than 2023.** (M47, #320) NJSP's newer reporting route warns a zero
      can be delinquent reporting; audit its missing-report codes and schema before
      replacing the reviewed 2023 workbook. A town's own figures need an evidenced
      agency-to-municipality crosswalk, not names.
- [ ] **NJDEP's public lead-line layer stops at the 2024 submission**, though statewide
      2025 totals exist. (M42) The owner asked NJDEP's lead-in-drinking-water program;
      Brandon Carreno (Division of Water Supply & Geoscience) replied 2026-10-08 that the
      2025 and 2026 per-system submissions exist but are not hosted online, and that the
      way to get them is an OPRA request (https://www.nj.gov/dep/opra/opraform.html).
      The owner filed one on 2026-10-08 for the per-system inventory counts by category
      in CSV or Excel; NJDEP has seven business days to answer. A one-off extract means a new request each year unless NJDEP
      publishes the layer again; check whether it arrives with any reuse conditions
      beyond the layer's Data Distribution Agreement (`config/sources.yml`).
- [ ] **Five counties have no DOE energy burden.** (M42) Essex, Hudson, Middlesex,
      Monmouth and Somerset carry signed weights or costs in DOE's file; withheld, not
      zeroed, until DOE explains them.
- [ ] **Most of Morris County has no flood zone share.** (M40, #301) FEMA's digital map
      covers 14.6% of its homes and Atlantic's 53%; the share is withheld below 95%.
      Morris's paper FIRMs are not read. Re-check when FEMA's coverage moves: the page
      fills in on its own once `fema_mapped_homes_share` reaches 0.95.
- [ ] **New Jersey's PFAS violations are not counted.** (M40, #304) EPA's SDWIS carries
      no PFAS code for New Jersey in 2021–2026. Milestone 42 added measured PFAS from
      EPA's UCMR 5, which is not a violation record; NJDEP's own violations are still
      not read, and Drinking Water Watch remains the link.
- [ ] **27 towns show their county's flood claims.** (#354) FEMA's block-group codes
      cannot separate their claims from a neighbour's (the Wildwoods, parts of Warren
      County). A claim-level field that names the census vintage, if FEMA adds one, or
      its rounded coordinates, would settle them; recheck when OpenFEMA's dictionary
      changes.

- [ ] **HUD income limits are dated by calendar year in the facts.** (found
      2026-09-23; #350) What a reader sees now names HUD's effective date — `/freshness`
      says "in force since 1 May 2026", the household section "in force from" — but
      `stg_hud_income_limits` still dates each year 1 January to 31 December, so the
      packets' AMI windows and `price_to_ami`'s periods do. Re-dating the facts by
      effective date means anchoring `price_to_ami`'s pairing on each year's start and
      accepting windows that end in the following year ("2022–2027"). Owner's decision.

### Evaluation harness

- [ ] **Watch the first regeneration under GPT-6 Luna.** (#345, #352) Under Haiku, the
      first regeneration of the `v4` list (2026-10-08) needed a revision on 7 of 18
      readings for a survey figure stated without its margin, and 3 fell to Gemini for
      quoting a non-housing measure. Luna heads the list since #352 and was benchmarked
      on 15 answers, its weakest criterion completeness; the next full pass is its first
      on live packets. Read its revisions and fallthroughs, and decide then whether the
      prompt should name margins.

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

- [ ] **Accessibility checks the audit script cannot make.** (M43, #309) True 200%
      text and 400% zoom, print in Safari and Firefox, and axe's remaining needs-review
      results. The handoff (`m43-accessibility-audit.md`) lists each.
- [ ] **The home page's illustration loops with no pause control.** (M43, #309) Removed
      at the owner's request on 2026-10-05; WCAG 2.2.2 asks for one on anything that
      moves for more than five seconds. Reduced motion stops it. The New Jersey header
      artwork added 2026-10-06 (#311) loops the same way, as do the home page's atlas outlines and
      travelling line (#364).
- [ ] **A compare page shared by its link.** (owner, 2026-10-09, from an outside
      review) `/compare?places=194,330,112`: a few towns side by side, the choice held in
      the address so it can be bookmarked or sent, and nothing stored in the browser.
      Milestone 46's side-by-side comparison is the likely base. Also Milestone 17's
      second user path (a place you are moving to against where you live now). The API's
      `/compare` is in the publish manifest's `unpublishable` list, since an arbitrary
      set of ids is combinatorial, so the page reads each place's published files in the
      browser, as `/guide` does.
- [ ] **Search results name no state.** (#362) Counties, towns and ZIPs read "County",
      "Township in Mercer County": unambiguous while New Jersey is the only state, not
      once a second one shares a county name (Mercer is in NJ and PA). Add the state's
      code to each `detail` in `searchEntries` when the second state lands.
- [ ] **The budget explorer's comparison scope is not in its address.** (PR #86, Codex
      handoff `local-page-layout.md`) A page's link opens `/afford` with its place and
      county; switching to another county or all New Jersey changes local state only,
      so a shared or reloaded link returns to the original scope.
- [ ] **`/?mode=afford` bookmarks open the national entry.** (PR #88, #94, #305) Old
      `/states/new-jersey?mode=afford` links now forward to `/afford`, but the root
      address cannot, since `/` is a real page; a county page's `?mode=afford` shows
      the profile.

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
      but no page tells a reader, so the check counts those two of its 20 questions as
      neither answered nor declined (2026-10-09). A short statement on the site would
      move them to declined.
- [ ] **Report a problem is on a region's two full metric tables only.** (M27, #221)
      The cost cards, the verdict sentence, the New Jersey rankings and `/afford` quote
      figures without it. ROADMAP's row asked for every figure.
- [ ] **A figure's own history of values is not shown.** (M27, #224) `/changes`
      summarises each refresh; a region page neither marks a revised figure nor shows its
      earlier values, which `fact_revision` holds.

### Map performance — open leads (no release gate since #349)

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
- [ ] **The site's status link cannot say when a check last succeeded.** (PR #45, #251)
      It names the Friday schedule and the build date; a quiet Friday that found nothing
      leaves the build date where it was, and nothing published records the run itself.
      Publishing the last successful check apart from the snapshot would let it say so.
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

- [ ] **Reply as housing@ and privacy@ from Gmail.** (#357, owner 2026-10-09) Both
      addresses are Cloudflare Email Routing forwards, which only receive, so a reply
      today shows the owner's personal address. Chosen: keep the forwards and add an
      outgoing mail service (e.g. SMTP2GO or Resend, free tiers), then Gmail's *Send mail
      as* for each address with that service's SMTP login. Add the service's SPF and DKIM
      records to jasonli.app (SPF joins Cloudflare's `include` in the one TXT record), and
      a DMARC record, which the domain has none of, starting at `p=none` with reports,
      so mail sent as the domain is harder to spoof. Test a reply from each address to
      an outside account before relying on it.
- [ ] **`hip check-config` exits 1 on a clean checkout** because three source API keys
      are unset. (M0) Correct behaviour, but it means `check-config` cannot be wired into
      `make lint` or CI until the keys exist.
- [ ] **Starlette's `TestClient` emits a deprecation warning asking for `httpx2`.** (M0)
      Suppressed in `pyproject.toml` for the test suite rather than fixed, because
      swapping the HTTP client was not Milestone 0 work — but every `hip` command prints
      it too (checked 2026-09-27), so it fills the scheduled runs' logs. Revisit before
      it becomes an error.

### Open decisions — not scheduled, not decided

- [ ] **Adopt TIGER 2026 — not yet (owner, 2026-10-09).** (#360) Census published
      TIGER2026; the refresh reports it as waiting and keeps 2025. Compared for New Jersey's
      569 county subdivisions on 2026-10-09: **one code changed** — South Orange Village
      township (3401369274) is now South Orange village (3401369270); Eatontown gained about
      36 acres from Oceanport; 440 land areas moved by land/water reclassification and 11
      shapes were redrawn, none material. Every source joined by town code (ACS 2024, the
      ZIP and HUD crosswalks) still uses South Orange's old code, so adopting now would strip
      its page. **Adopt when ACS moves to the new code** (likely ACS 2026, late 2027), with
      an old-to-new mapping for South Orange as `DISTRICT_SUCCESSORS` does for school
      districts, then move `TigerAdapter.default_vintage` and rebuild.
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
      reports were last regenerated on 2026-10-08 (#128, #129), by hand; the weekly run
      leaves them alone (it packs without `--report`, #227), so they drift between
      such passes. Either regenerate and commit them whenever the data moves, or
      stop tracking them and link the published reports. **Not decided.**
- [ ] **`place` versus `cousub` outside the strong-MCD states.** Not yet a live
      decision — the Northeast states of Milestone 14 are all strong-MCD, Milestone 15
      stops at county level, and both are unscheduled. It becomes blocking the first time municipality-level data is wanted
      in a state where county subdivisions are statistical divisions.
      `config/geography.yml` already warns the identifier system is expensive to change
      once fact rows reference it.

- [ ] **The Markdown report does not carry each figure's kind or licence.** (M31) The
      report page and the CSV do, and the downloadable Markdown closes with the terms and
      notices and leaves display-only figures out (`render_report`). The kind and licence
      per row are left out on purpose: `render_markdown` is also the payload a reading's
      model is given, and a change to it is a change to every reading's input, which
      wants its own side-by-side.

## Parked / needs user input

- [ ] **Measure load speed — parked by the owner 2026-10-09.** From the launch
      checklist: the site's load speed has never been measured. When un-parked, run
      Lighthouse on one page of each kind (home, county, town, ZIP, `/afford`, `/guide`)
      and fix only what it flags. No photos to compress; the maps and the region JSON are
      the likely weight.

### Data additions — parked by the owner 2026-10-09

Each deepens the site without answering a new reader question, so none is built until
the owner un-parks it. Of the four, Zillow's other cuts (buyer-relevant, cheap) and
tracts (most new insight, about 2,000 more pages) were the strongest cases.

- [ ] **Milestone 34's ACS depth stops at ZCTA; tracts have none of it.** (M34) The
      warehouse holds 2,181 tracts and the ACS publishes every M34 table for them, but
      no tract page shows Census figures yet. Left out by decision on 2026-10-01; the
      adapter would take a `tract` level beside `county` and `cousub`.

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

- [ ] **NJDEP radon tiers: waiting on NJDEP's new map.** (M49, #331) The guide shows
      test-every-home advice and links, not a tier. The owner asked NJDEP on 2026-10-07;
      Charles Renaud, NJDEP Radon Supervisor, replied on 2026-10-08: the 2015 tier map is
      the most recent, NJDEP is building an updated one — interactive, with information
      down to the municipality — and he will find out whether its data table can be
      downloaded and let the owner know. So the advice stays alone: the published tiers
      are 2015's, and a replacement is coming. Next: on his follow-up, or once the new map
      is published, check for a downloadable table and its terms (nj.gov legal statement,
      Section F, answered for the current pages). If there is one, the earlier
      recommendation stands — match its entries to towns by name, type and county and
      show the tier beside the test advice — still the owner's decision.

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

      **Checked by the owner 2026-10-08:** no export. The right-click menu offers *Show as
      a table* and copies cells one at a time (Cmd-click; neither Shift nor Cmd+A selects
      a range). The Evictions tab's tables are by *postal city name* ("Blackwood",
      "Avenel", "Unknown"), filtered by ZIP and year (2022–2025) — no county or town
      filter — and County Highlights carries rents, sale prices, ownership and the
      homeless count, not evictions. So no geography the platform publishes can be read
      off it without a lossy postal-name match. Statewide totals are readable: filings
      90,093 / 97,907 / 109,313 / 115,063 and warrants of removal 19,413 / 39,546 /
      39,161 / 37,323 for 2022–2025. Recommended: ask DCA for the underlying table by ZIP
      and year as a file; failing that, statewide only or park the milestone.
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
