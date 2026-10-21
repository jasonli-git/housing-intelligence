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

**Reviewed on 2026-10-20**, with the owner: seven entries closed — the three map-performance leads (about `GlobeMap`, which the atlas rebuild #171 removed), the kept illustration loops (owner's decision, #393's PR), the standing Zillow download arrangement (README documents it), `check-config`'s correct exit and the courtesy CostQuest reply — and the figure-history entry narrowed to marking revisions. They are in `git show 5ba83cc:TODO.md`.

**Triaged again on 2026-10-19**, with the owner: `Now` rewritten for the interface cleanup,
and the FCC entry, whose town and ZIP counts shipped in #163, cut to the courtesy reply
still outstanding and moved to Housekeeping.

## Now — the hosting decision, then the rest of a second state's groundwork (2026-10-21)

The three implementation steps the owner ordered on 2026-10-20 are done: publication
capacity measured and 1,768 redirect files cut (#201, #203, ARCHITECTURE #400), county
series, geometry and `api.geo` taken from scope (#205, #401), and scale safety (#208,
#402, #403). Config alone cannot fit a second New Jersey-sized state on Pages Free
(#210); the accessibility check found on the way now runs on every deploy (#211, #404).

1. **Hosting: decided by the owner 2026-10-21 — Workers static assets on Workers Paid**
   (100,000 files), with the numeric-link redirects moved to a Worker; later, pages in R2
   behind a Worker past about seven states, and on-request rendering only for national
   coverage. **On hold by the owner 2026-10-21** until TODO and most open Director
   Notes are cleared; then the owner subscribes to Workers Paid and a brief moves the
   site from Pages, tried on a preview address before production (under Frontend and
   presentation, "A second state will not fit Pages' limits").
2. **The remaining New Jersey assumptions** — done (2026-10-21, ARCHITECTURE #406,
   #407): sources declare their states, `hip acquire` works on a new database, labels
   and cost rules are per state, and the site reads one list of covered states. What a
   chosen second state still needs is under API and scale limits.
3. **Tests that guard data** — done (2026-10-21, #214): every validation-gate rule, the
   real Zillow unpivots, and FRED, BLS, FHFA and Zillow against recorded responses. The
   four silent-loss gaps they found are fixed (ARCHITECTURE #405).

Kept out of that scope: publisher-dependent gaps (Correctness and data integrity) and the
owner's decisions (Open decisions; HUD income-limit dating). The readings are stale after
the 2026-10-19 Zillow refresh and #382; regenerating them is held by the owner. Rotating
the six keys still listed under Parked is the owner's.

## Open

Every open item, wherever the work originated. The tag in parentheses is where it was
first raised, not where it must be done.

### Calendar — dated and recurring chores

Not open work: each comes round on a date. The steps live where the row says.

| When | Chore | Steps |
|---|---|---|
| Each January | Re-read the publishers' release calendars (BLS's ends 2026-12-30, Zillow's 2026-12-17; FHFA, PEP and HUD's run to 2027); add the ACS edition's date when announced (#298) | `config/sources.yml` `release_calendar` |
| Each autumn, from 2027 | NJDEP's newest service-line inventory submissions are not online: request them from NJDEP's Office of Record Access under OPRA (as 407131 was, answered in 7 business days), drop the workbook into `data/manual/njdep_lead_lines_opra/`, review its sheets and header, then add the request to `LeadLinesOpraAdapter` (#409) | `config/sources.yml` `njdep_lead_lines_opra` |
| 2027-01-01 | Gemini 3.6–3.8 Flash's introductory price ends: $1.50 / $7.50 per million tokens (Flex half); update `config/evaluation.yml` the same day | — |
| Each quarter | Look at DCA's Construction Reporter, stopped at January 2026 while DCA overhauls it; discovery picks up the yearly summary (usually July) on its own, and a changed layout is refused (#300) | `config/sources.yml` `nj_construction` |
| Each June and December | FCC's broadband files are downloaded by hand, so no refresh notices a new filing (#360, #372). Look for an as-of date or revision newer than the one held | County and place summaries into `data/manual/fcc_bdc/`, then `hip acquire --source fcc_bdc --vintage <as-of>_<revision>`; the two New Jersey location files (served/unserved and fiber) from the National Broadband Map into `data/manual/fcc_bdc_locations/` through a browser, since scripts get a 403 |
| Each January | DOE's LEAD energy burden (`doe_lead`) is pinned to its 2022 data, and a newer edition would be a new OpenEI submission at a new address (#360). Look for one | If there is one, review its county file against `EnergyBurdenAdapter` before moving the URL |
| Each October | Review the 22 place photos (#368): each Commons page still exists under the same licence, and each scene is still current | `web/lib/photos.json`; a changed file already stops `make publish` |
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

- [ ] **What a reading says in words is now checked for rankings only.** (#275; narrowed
      2026-10-21, ARCHITECTURE #412) A ranking in words ("among the highest", "near the
      bottom") must match the packet's ranks, and one naming no ranked measure is refused.
      Still unchecked: a measure mislabelled in words (Cumberland's reading called Zillow's
      home value a five-year survey estimate, `reports/evaluation/readings-v8.md`) and a
      causal claim between measures named only in words (#337's blind spot). Four
      published readings (Gloucester, Burlington, Camden, Salem) call a low home value to
      income ratio high and would be refused today; they stay live until the next
      regeneration, which the owner holds.

### Test coverage

- [ ] **Some integration tests still write to the served warehouse.** (narrowed
      2026-10-20, #208) The analytics rebuild tests now run in a disposable
      `hip_test_<uuid>` schema (`tests/warehouse_scratch.py`), checked by
      `scripts/verify_analytics_isolation.py`. Still on the real database:
      `test_api_revisions.py`, `test_revisions.py` and `test_correctness_pass.py` mutate
      real rows and roll back (row locks, advanced sequences); `test_api_explanations.py`
      and `test_freshness.py` commit fixtures and clean up after; `test_publish.py`'s
      licence guard updates and rolls back. None rebuilds analytics. Move them to the
      scratch schema when next touched.

### API and scale limits

- [ ] **A ranking over 1,000 regions stops the publish.** (pre-M12 review; narrowed
      2026-10-20, #208, ARCHITECTURE #402) `/rankings` and `/regions/{id}/metrics` now
      return `total` beside their rows, and `hip publish` and `make check-dist` refuse
      any list shorter than its total, so nothing is published clipped. `/rankings` still
      caps a request at 1,000, below the 3,144 counties national coverage would add
      (Milestone 15, unscheduled): such a ranking would now fail the build. Fix then:
      page through a consistent snapshot. The largest per-place series is 1,152 of
      5,000 (Hudson County).
- [ ] **What a second state still needs from code, after the structural pass.** (pre-M12
      review; narrowed 2026-10-20, #205, #401, and 2026-10-21, #406, #407) Sources now
      declare their states, labels and cost rules are per state, and pages read one list of
      covered states. Left, each a design or a source review for the state chosen: a
      state page template (the New Jersey page is `app/states/new-jersey` with its own
      `.nj-page` styles); a home map for several states (one pointer today,
      `PRIMARY_STATE`); the 32 New Jersey-only sources reviewed or replaced per state;
      that state's cost rules in `STATE_RULES`; and the "Region not found" page's
      link to New Jersey. Blocks the Northeast expansion (Milestone 14, unscheduled).
### Frontend and presentation

- [ ] **Accessibility checks the audit script cannot make.** (M43, #309) True 200%
      text and 400% zoom, and axe's remaining needs-review results. (Print in Safari and
      Firefox checked 2026-10-20, #397.) The handoff (`m43-accessibility-audit.md`) lists each.
- [ ] **Read HUD User's API terms for where its notice must appear.** (#386) The terms
      page returned nothing to an automated reader on 2026-10-19; the notice is on
      `/sources` and treated like the Census Bureau's. If HUD asks for it on each page or
      in the footer, add `hud` to `FOOTER_NOTICE_SOURCES` (`web/lib/notices.ts`).
- [ ] **Bring the remaining one-off colours behind tokens.** (owner, 2026-10-10; #383,
      #384) Kinds are tokens and a test now stops new hard-coded colours. 1,129 remain in
      33 files (2026-10-20), frozen in `web/lib/colourBaseline.json`; the largest are
      `horizon-theme.css` (187), the atlas (86 + 67) and `state-exhibits.css` (83). Take
      them file by file when a file is touched for other work, lowering the baseline.
- [ ] **A second state will not fit Pages' limits as built.** (#367; measured in #201,
      ARCHITECTURE #400) 14,947 exported files of 20,000 and 1,772 redirect rules of
      2,000 for New Jersey alone; 598 ZIP-report aliases remain after 1,768 shadowed
      ones were removed. A synthetic manifest with a second New Jersey-sized state is
      28,551 files with all compatibility moved out of Pages, so redirects alone do not
      make it fit, and a paid plan's 100,000 files do not raise the 2,000-rule cap. The
      owner decides how files are held (a higher-capacity plan, other asset delivery,
      a tested rendering or export strategy, or whether every ZIP page and report is
      published); none is approved. Configuration will not do it (2026-10-20, #210): the
      installed Next.js 16.3.5 has no supported switch that stops its per-route
      navigation payloads, and the one documented lever, a larger prefetch-inlining
      budget, takes each place from 12 files to 10 and the projection to 23,805, still
      over the cap, while saving almost no bytes and raising transfer on some
      navigations; the defaults stay. The measurements are in
      `git show f1feee2:agent-handoffs/export-payloads.md`, and
      `web/scripts/check-export-navigation.mjs` tests client navigation for a future
      attempt. Options left: a paid plan with a higher file cap (Workers static assets,
      or Pages on a paid plan), ZIP pages rendered in the browser from R2 as the tax
      lookup does, or one Pages project per state behind a router. For the numeric links, three candidates sit inactive
      in the ignored `web/.publication/` (Bulk Redirects CSV, a route Worker, a Pages
      Function), regenerated by each build; `agent-handoffs/publication-capacity.md`
      has the measurements and tests. Before activating one: update `routes:refresh`,
      which still caps and emits the Pages-rule strategy; check the Worker's origin
      routing on a real route preview; validate the preview and production hostnames;
      deploy the replacement first, verify every target, then remove aliases and rules,
      keeping a rollback build and one compatibility authority. Account quotas,
      including Bulk Redirect entries already in use, were not inspected.
- [ ] **A place newly gaining data stops the Friday build.** (#367) Its page has no pinned
      address, so the build refuses rather than publish one that could change; the
      scheduled run then reports a failed build. Fix: `cd web && npm run routes:refresh`,
      review and commit. Rare: every place with any observation already has an address.

### Publication

### Documentation upkeep

- [ ] **Which README figures are mechanically derivable has never been settled.** The
      status counts (places and sources), the Tech Stack and the evaluation list have a
      queryable or file-based source; the status narrative, the Features descriptions and
      the setup prose do not. Deciding the boundary is what makes any "regenerate on
      deploy" work scopeable, and ARCHITECTURE #175 settles only the images half. The
      README was cut from 1,095 lines to about 250 on 2026-10-21: the milestone-by-
      milestone features, sample output and status commentary went (CHANGELOG and ROADMAP
      hold them), and so did the stale mac-sitrep resource table and the storage table
      (`uv run hip footprint` measures storage on demand), so `src/hip/footprint.py`'s
      docstring and a future sitrep run no longer have a README section to write into.

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

- [ ] **Zillow's other datasets: look into whether and how to integrate them.** (owner,
      2026-10-19; moved out of the parked data additions) Survey everything on Zillow
      Research's data page — bottom- and top-tier and SFR-only ZHVI, sale prices, new
      construction, days to pending, price cuts,
      inventory, market heat — and for each note the geographies offered (most stop at
      metro, which the site has no pages for), what reader question it answers, and how
      many more files the monthly hand download would add (each is downloaded by hand,
      #272). Same CSV host and adapter as ZHVI and ZORI.

## Parked / needs user input

- [ ] **Measure load speed — parked by the owner 2026-10-09.** From the launch
      checklist: the site's load speed has never been measured. When un-parked, run
      Lighthouse on one page of each kind (home, county, town, ZIP, `/afford`, `/guide`)
      and fix only what it flags. No photos to compress; the maps and the region JSON are
      the likely weight.

### Data additions — parked by the owner 2026-10-09

Each deepens the site without answering a new reader question, so none is built until
the owner un-parks it. Tracts (most new insight, about 2,000 more pages) were the
strongest case; Zillow's other datasets moved to Open on 2026-10-19.

- [ ] **Milestone 34's ACS depth stops at ZCTA; tracts have none of it.** (M34) The
      warehouse holds 2,181 tracts and the ACS publishes every M34 table for them, but
      no tract page shows Census figures yet. Left out by decision on 2026-10-01; the
      adapter would take a `tract` level beside `county` and `cousub`.

- [ ] **FRED housing series** — `NJSTHPI` landed in Milestone 21 from FHFA's master file
      rather than FRED (ARCHITECTURE #109); **the three national series remain**: `HOUST`
      (housing starts), `RRVRUSQ156N` (rental vacancy), `MSPUS` (national median sale
      price). Each is a `sources.yml` line plus a `metric_id`.
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

- [ ] **Rotate the keys that were pasted into chat.** The cache half is finished (see
      below); this is the part that matters and the part only you can do.

      **Rotate (yours; these cannot be done here).** Each in its own provider console:
      (The two removed providers' keys are done: Qwen/DashScope's, pasted 2026-09-11,
      and Mistral's, pasted 2026-09-06, were revoked by the owner on 2026-10-20, and
      `DASHSCOPE_API_KEY` and `MISTRAL_API_KEY` removed from `.env`.) **DeepSeek** and
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
