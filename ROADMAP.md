# Housing Intelligence Platform — Roadmap

**Version 1 is complete — all ten milestones shipped.** The warehouse holds a NJ
geography spine, 335,927 observations across 23 metrics from 10 sources spanning
1971–2026, 19,531 computed changes, and 19,521 change plus 8,302 value rankings — served
over the API, displayed by the dashboard, and packaged as versioned analysis packets,
with 289 Python and 26 dashboard tests passing. All eight pipeline stages run.

**Version 2 is complete — Milestones 10, 11, 12, 19, 22, 20, 21, 13, 18, 17, 23 and 16
have shipped, between 2026-09-02 and 2026-09-18; 14 and 15 stay unscheduled.
Versions 3 and 4 are below — scheduled on 2026-09-18 as three versions, and restructured
into two on 2026-09-23.** The
platform is published: New Jersey is served from a public domain with no database and no
application server, and its interpretation is written by hosted models behind a preference
list that ends on this machine. Since 18, 17 and 23 it has a design language of its own
and answers the questions people bring; since 16 it does so on a navigable globe of the
United States, where only New Jersey carries figures and the map says so. Expansion past
New Jersey was deferred on 2026-09-07. Everything it runs on — the warehouse schema, the
analytics layer, the packet contract — is what Version 1 built.

Two milestones ran out of numeric order. Milestone 9 was built before Milestone 5,
because it corrects numbers the dashboard displays and fixing them afterwards would have
meant re-checking every chart. Milestone 8 closed last, on 2026-08-14: eight local models
were evaluated against standardized scenarios built from real packets, Gemma 4 E4B was
selected on measured performance rather than reputation, and it now writes the
interpretation panel on every county page.

A milestone counts as done when its capability is reachable through the CLI, the API,
or the dashboard on a clean checkout; its tests pass; and
[ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md), and
[README.md](README.md) have been updated to match what actually exists.

## Version 1 Milestones (New Jersey)

| M | Status | Deliverable |
|---|--------|-------------|
| 0 | ✅ done | **Scaffolding** — repo layout, `uv` + `pyproject.toml`, config layer, Docker Compose Postgres/PostGIS, Alembic baseline, dbt project, Next.js app, `hip` CLI, `GET /health`, project docs |
| 1 | ✅ done | **NJ geography spine** — 3,365 regions (1 state, 21 counties, 564 municipalities, 2,181 tracts, 598 ZIPs) with PostGIS geometry, parent chains, and 1,902 area-weighted ZIP allocations; `/regions`, `/regions/{id}`, `/geo/{level}` serve real data |
| 2 | ✅ done | **Home values and rents** — Zillow ZHVI + ZORI through all six implemented stages; 309,350 observations across 21/21 counties, 403/564 municipalities, 548/598 ZIPs; `/metrics`, `/regions/{id}/metrics`, `/sources/unresolved`; dbt staging with 15 tests; a validation gate that blocks bad loads |
| 3 | ✅ done | **Economic and demographic context** — ACS (5 metrics, exact FIPS at county and municipal level), Building Permits, FHFA HPI, FRED, BLS, and IRS migration; 20,625 new observations, a `nation` level for national series, and municipal coverage raised to 564/564 |
| 4 | ✅ done | **Computed housing intelligence** — pct change and CAGR over 1y/3y/5y/10y/since-2019, price-to-income and rent-to-income as computed metrics, rank and percentile per metric and level; `/rankings`, `/compare`, `/regions/{id}/summary` with caveats attached |
| 5 | ✅ done | **Dashboard and maps** — county choropleth drawn as inline SVG from our own GeoJSON, ranking table, region detail with metric tiles, trend charts with crosshair tooltips, and a table view of every series with its source |
| 6 | ✅ done | **Analysis packets and reports** — packet `1.0` published as a generated JSON Schema, `hip pack` writing 21 county packets and their Markdown reports, `/regions/{id}/packet` and `/regions/{id}/report`, and a print-ready report page in the dashboard |
| 7 | ✅ done | **Parcel and MOD-IV layer** — 3.48M NJ parcels in Parquet/DuckDB, six municipality assessment aggregates promoted to the warehouse for 554 of 564 municipalities, value-based rankings and packet `1.1` levels so a snapshot metric is visible at all, 554 NJ municipal codes in `region_identifiers`, and the release-vintage provenance defect fixed |
| 8 | ✅ done | **Model evaluation and optional explanations** — 5 standardized scenarios over 3 real county packets put through 8 local models across 2 runtimes (120 generations, 105 usable), every stated figure checked against its packet, 105 rubric judgments from `claude-opus-5`, and a published report selecting **Gemma 4 E4B** on measured performance. `hip explain` wrote 21 county explanations, served by `/regions/{id}/explanation` and shown as interpretation in the dashboard |
| 9 | ✅ done | **HUD affordability inputs** — USPS crosswalk replacing area weights with residential-address ratios (2,456 of 2,491 rows), HUD area median income and 80% AMI limits, and `price_to_ami`. Built out of order, before Milestone 5 |

## Version 2 Milestones (public hosting and expansion)

**Milestones 10, 11, 12, 19, 22, 20, 21 and 13 closed, between 2026-09-02 and 2026-09-11.**
Version 2 changes four things and deliberately not a fifth: where the platform runs (a public
domain rather than `localhost`), how much geography it covers (Northeast, then national
at county level), what writes the interpretation (a hosted model rather than a local
one), and what the result looks and behaves like (a design language of its own, rather
than the system defaults the dashboard reaches for today). The warehouse schema, the
analytics layer, and the packet contract are not in scope — SPEC principle "each future
capability should reuse the same warehouse and analytics layer" holds, and a Version 2
that rewrites the fact table has gone wrong.

| M | Status | Deliverable |
|---|--------|-------------|
| 10 | ✅ done | **Build cost and data placement** — `hip footprint` reporting bytes per storage tier, per warehouse table, and per state, including the Postgres size that lives inside Docker where `du` cannot see it; seven per-stage scenarios added to the existing `mac-sitrep` profile rather than a second timing harness; `HIP_REPORTS_DIR` promoted from a path derived off the data root, `HIP_PGDATA` relocating Postgres opt-in, and `~` expanded in both; measured for New Jersey and published in the README |
| 11 | ✅ done | **Static publication** — `hip publish` rendering the *enumerable* API surface to files whose paths mirror the endpoints, by replaying the ASGI app so the bytes match what the API serves (#67); a manifest carrying a sha256 per artifact and naming what cannot be published; the dashboard built as a static export over the same regions; `make publish` assembling both; and New Jersey served from the custom domain with no database and no application server in production. Earlier wording promised "every API response" and content-addressed URLs — neither survived contact with the parameter space (`/compare` is combinatorial) or with the point of the exercise (a hashed URL stops mirroring its endpoint) |
| 12 | ✅ done | **Hosted inference** — a `HostedRunner` implementing `ModelRunner`, hosted candidates measured against Gemma 4 E4B on the Milestone 8 scenarios and rubric, an ordered preference list of benchmarked models resolved at generation time — DeepSeek, then Gemini, then Mistral, then local Gemma 4 E4B last, version-pinned model identifiers, per-candidate token rates recorded in config so the evaluation report can carry a quality-per-dollar column, staleness compared at display precision rather than on raw floats, and batch submission for the regeneration pass |
| 13 | ✅ done | **Citation binding** — every figure in an interpretation resolved to the packet field, source release, period and match method that licensed it, inside `hip explain`, with the same index counting fabrication in the evaluation (`hip.packets.citations`, ARCHITECTURE #112–#117). Prose stating a figure the packet does not carry is refused rather than stored: until then the figure check ran only in the benchmark, and none of the 105 published explanations had been checked one by one. Packet 1.2 names the release behind each change window's start, which no packet had listed; scenarios keep the packet they were rendered from, so a re-check can no longer grade a finished run against today's warehouse; and staleness is decided on a content hash, so a re-download that moves no figure re-binds stored prose instead of regenerating it. Measured on `v2`'s answers against their own packets: 976 of 977 figures bound — and `v2`'s one recorded fabrication turned out to be the checker reading "pre-2018" as a negative number. The dashboard marks every cited figure and lists its source |
| 14 | ⏸ unscheduled | **Northeast expansion** — CT, MA, ME, NH, NY, PA, RI, VT loaded at all five levels, the first run of the pipeline at roughly seven times current volume, and a per-state coverage report showing what each source did and did not resolve |
| 15 | ⏸ unscheduled | **National county coverage** — all 50 states, DC, and PR at `state` and `county` level only, on federal sources that key on exact FIPS, giving national coverage without a national municipality model |
| 16 | ✅ done | **Three-dimensional map, New Jersey** — built 2026-09-17 and 18 as 0.18.0, and **rescoped by the owner on the day it started**: a navigable globe of the whole United States, not a fixed frame around New Jersey. Every state is drawn — TIGER publishes its `state` layer nationally, so Milestone 1 had already downloaded all 56 — in `map_backdrop`, a table that carries geometry and nothing else, because Ohio has no observations and putting it in `regions` would put it in `/regions`, in search and in the counts the site quotes (ARCHITECTURE #164). Only New Jersey has figures, and the map says so. **The row's original promise of two channels did not survive the owner's review** (#166): reading a magnitude off a block's height while reading a ratio off its colour asks a reader to hold two encodings at once, and the blocks hid each other. Colour carries the measure, its ramp's hue set by the measure's group — blue for prices, the affordability tool's orange, green for incomes, violet for the housing stock, eight ramps generated in OKLCH and checked as sequential rather than categorical scales. Height survives as the probe: the one region under the crosshair rises with its own figure, so nothing can hide behind anything. **#39 stands** — this is hand-written SVG, not a map library (#163). MapLibre's stated disqualification in #39 no longer applied, but the reasons that do apply had grown: 300KB gzipped of JavaScript against the whole map's 197KB of data, drawn into a canvas a screen reader, a printer and a reader with no script all see nothing in. The projection is orthographic with no tilt, so the ground in the middle of the frame is undistorted and the earth's curve falls away evenly in every direction; it also removes the antimeridian, so Alaska's Aleutians need no special case. Detail follows the zoom, from states to New Jersey's 21 counties to its 564 municipalities, and the ranking beside the map follows it too, reading the same figures from the same file so the two are one view at every zoom (#165, #167). Selection is highlight-and-mute on a deliberate pick; whatever the crosshair holds is focused by a depth of field that eases in like a lens. `/afford` draws the same globe, held at municipal level and painted in three states rather than by quantile, which is the carry #144 deferred here (#168). Everything moves with motion — the rise, the drag's coast, and every camera control, whose scale is interpolated on a log so each frame changes it by the same ratio. Five owner reviews between the two days, each answered before the next |
| 17 | ✅ done | **Consumer entry point** — views that answer a decision rather than report a figure: **"what can I afford here"**, taking an income and returning the places within reach — decided 2026-09-13 as housing at most 30% of gross income, owning at the national rate with the reader's down payment and the typical tax bill, renting at the observed rent, in place of the first sketch's inverting `price_to_income` and `price_to_ami`, which ignores rates and taxes; **a verdict sentence** on every region page, turning "$793,874, rank 16 of 21" into "the second most expensive of New Jersey's 21 counties, and rising more slowly than most" (Bergen's single-family home value: 2nd of 21 by price, 16th by five-year change), computed from rank and percentile with no model involved; **ranks that say what they rank** — the ranks on region pages are by change over the window, not by price or count, and rank 1 is the largest rise or the better end where a measure has one, so Mercer's "$450,985, rank 9 of 21" reads as the ninth most expensive county when it is the ninth largest rise (Mercer is 14th by price); every rank names its basis and direction where it is shown, and the verdict sentence says which rank it is quoting; **the "Since 2019" window explained where it is offered** — the New Jersey page's window control offers five years, ten years and "Since 2019", and nothing says why the third starts where it does: it is fixed at the last full year before the pandemic rather than sliding forward, so it answers "how much has changed since before COVID", and a plain-language note beside the control says so, along with what follows from it — for Census-survey measures it matches the five-year window until the 2020–2024 edition loads (both compare the 2019 and 2023 editions), and for Fair Market Rents it spans HUD's move from the 50th to the 40th percentile around fiscal 2020. Mercer shows why it matters: over five years its unemployment rate reads as a 27% fall, because that window starts at the 2020 spike, and measured from 2019 it is a 41% rise (`fact_metric_change`, 2026-09-12); **the tradeoff named**, pairing a cheaper home value against higher property taxes or the migration flows IRS already supplies, because every real housing decision is a trade and reporting one side of it is half an answer; and **the cost to own, month by month** (added 2026-09-13), three questions on one new metric — *what is the property tax bill here*, the typical residential bill per municipality from MOD-IV's `LAST_YR_TX`, landed with every parcel since Milestone 7 and not yet a metric, which the tradeoff above needs too; *what would it cost me per month to own here*, the typical home value at the 30-year mortgage rate FRED already supplies, with the down payment the reader's to set and every assumption printed beside the result, plus a twelfth of that tax bill — arithmetic, not a forecast; and *is it cheaper to rent or to own here, month to month*, that cost beside the observed rent for the same place, framed as a comparison of monthly costs rather than a recommendation and naming what it leaves out: maintenance, insurance, and whether the price rises. Three smaller answers from figures already held: **since the year I moved here**, then against now for home value, rent and income from any start year the series reach, which generalises the "Since 2019" window and reads the same monthly and annual series the trend charts draw; **whether paychecks are keeping up**, one sentence setting the change in home value and rent beside the change in household income over the same window ("home values rose 36% while household income rose 19%"), the headline [SPEC.md](SPEC.md)'s example packet is built around and a natural second clause for the verdict sentence; and **what the housing here is like**, a short profile from the MOD-IV metrics already published — median year built, lot size, apartment share — with homeownership and permits. What these views will not answer is recorded below the table. Plus search disambiguated by county and legal type — ZIP is many-to-many and cannot label a result — over the `name_lsad` column loaded in 2026-09-05. Built 2026-09-13 in three slices, each reviewed by the owner — reading the figures, the cost to own with a new tax-bill metric and the county explanations regenerated, and the new views — as 0.15.0 (ARCHITECTURE #138–#146) |
| 18 | ✅ done | **Design system and identity** — Public Sans for display and text and JetBrains Mono for labels, self-hosted at build in place of the system font stack (ARCHITECTURE #121), under a bar shared with jasonli.app whose values are hand-copied until that repository's token package exists (#122); hover, focus and active states on every control, with motion only for readers who have not asked for less; the New Jersey page's measure and window chosen by the reader over every published county ranking, and the state's own page folded into it (#126, #127); a named component layer in place of per-page inline grids; an inline glossary of the sources' vocabulary (#130); caveats set beside the figures they qualify, scoped by the API without changing a packet (#123); shares as percentages and multiples with × (#124); and the footer grouped by institution, with the non-commercial terms at the top of every page (#128). No packet changed, so nothing was regenerated. Built before 16 and 17 |
| 19 | ✅ done | **Multi-model interpretation** — every county page carries all five benchmarked models' readings of the same packet, switchable by the reader and each attributed to the model and provider that wrote it. `region_explanations` gains `model_id` in its primary key and a `rank` column carrying preference-list position, because `API_MAY_IMPORT` forbids the API reading config to order them; `/regions/{id}/explanation` keeps its shape and a new `/regions/{id}/explanations` returns all five. Built out of numeric order, before 13-18, because the benchmark data is fresh and the content costs $0.86 to generate today. It is also the reachable subset of Post-Version 2's bring-your-own-model comparison, whose blockers were a missing server and a paid judge — neither of which a pre-generated artifact needs |
| 20 | ✅ done | **Reasoning effort as a measured variable** — `reasoning_effort` on `CandidateModel` (`default`, `disabled`, `low`), sent in each provider's own shape and recorded on every generation, so a configuration is a candidate rather than a hidden default; `default` sends nothing, leaving every `v2` request byte-identical. One id is one configuration: a resume under a changed setting is refused, two ids for one configuration fail `hip check-config`, and `hip explain` skips a model configured at an effort its benchmark did not measure. `deepseek-flash-nothink` and `gemini-3.7-flash-low` are configured for `v3`, and the evaluation report states the effort behind every figure. Planned as thinking-disabled variants of both; Gemini 3.7 Flash refuses its documented floor, `minimal`, and offers no off switch, so its variant is `low`. Measured on one county packet: thinking off cut DeepSeek V4.1 Flash from 5,693 output tokens to 512 for an answer of the same length, and `low` cut Gemini 3.7 Flash from 2,655 to 565. Runs no benchmark — the variants are measured in `v3` |
| 21 | ✅ done | **New Jersey depth: the sources still missing** — HUD Fair Market Rents and HUD CHAS as two new sources on the token already in `.env`, ACS tenure and vacancy (B25003, B25002), FHFA's all-transactions index, and Census Building Permits at place level: eight metrics and 13,638 observations. Every county carries a Fair Market Rent and `fmr_to_income` against it (21 counties, where the Zillow-based ratio reached 19); every county and municipality an ownership and a vacancy rate, the first the warehouse has held; 21 counties and 563 of 564 municipalities CHAS owner, renter and severe cost burden; every municipality a permits series, resolved by FIPS MCD code and summing to the county totals exactly. `NJSTHPI` came from FHFA's own master file, already fetched, rather than FRED; the ACS tables got their own layers because the raw cache keys on the layer, not the URL; and HUD's 60-a-minute limit made download pacing a shared adapter setting (ARCHITECTURE #106–#111). A county packet is about a third larger. |
| 22 | ✅ done | **DeepSeek migration and substitution detection** — DeepSeek retires models by *routing* them: `deepseek-v4-flash` already returns answers from `deepseek-flash` with HTTP 200, and `deepseek-v4-pro` follows at 04:00 UTC on 2026-09-14. A routed pin never fails, so SPEC's fall-through never fires and a regeneration would store the retired model's name against another model's prose. Every hosted response now has its served model checked against the requested ref, a mismatch is a recorded substitution, and `hip explain` probes hosted tiers so a withdrawn or routed pin genuinely falls through — which, it turned out, it never had. `deepseek-flash` joins as an unbenchmarked candidate; the benchmark itself waits for 21, 13 and 20. Scheduled ahead of 13 because of the vendor date |
| 23 | ✅ done | **Presentation pass** — the owner's three-part review of 0.15.x on 2026-09-14, built in three slices each reviewed before the next and closed 2026-09-16 as 0.16.0. **Every page:** a plain definition and a why-it-matters line for all 32 metrics (ARCHITECTURE #149), footnote marks that jump to their notes, search in the shared bar with the iOS AutoFill fix (#150), a GitHub link, and each page type a little distinct — a kind label, an accent rule, a breadcrumb of pills, and the report as a sheet of paper (#151, #160). **New Jersey page:** the measure explained in a card holding its controls and the "Since 2019" note, the ranking in a card of its own, a larger map at the same width (#152), and "What can I afford?" as a card with an income box that opens `/afford` filled in, where "can I afford this place?" answers one place owned and rented (#153); "beyond reach" in grey (#154). **Region pages, layout B** (#156): the verdict under a computed-not-AI label, short answers to "Did paychecks keep up?", two cost cards splitting the payment into money gone and money kept with rent set against money gone (#157), stand-outs by change and by value (#158), the housing as cards placed among their peers (#159), then one remembered expander holding every table, the trends and the whole interpretation; the report prints the cost cards at 20%. Also fixed: a monthly series' December reading named as a year (#155). No packet changed, so nothing was regenerated. Built after 17 and before 16 |

The done criterion from Version 1 is unchanged: a milestone counts as done when its
capability is reachable through the CLI, the API, or the dashboard on a clean checkout;
its tests pass; and [ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md),
and [README.md](README.md) have been updated to match what actually exists. Milestone 11
adds one condition to that list, because it is the first milestone whose output is not
on this machine: the published artifact must be reachable at its public URL.

### Why this order

**Cost before scale.** Milestones 10 through 13 are all at New Jersey's current size —
3,365 regions, 335,927 observations. Each removes a cost that would otherwise be
multiplied by every state added afterwards. Publishing is proven at 21 counties before
it is attempted at 3,144; inference is moved off the local runtime before the
region count grows sevenfold. Expanding first and optimizing afterwards means paying
the unoptimized bill on the larger dataset and rebuilding the pipeline under a live
site.

**Milestone 10 comes first for the measurement, not for the disk.** Nobody currently
knows how long a full pipeline run takes for one state or how many bytes a state costs,
because only RAM was ever recorded. Planning Milestone 14 without those numbers means
guessing whether the Northeast run is two hours or twenty. Measuring one state is cheap;
measuring it after committing to eight is too late for the number to inform anything.

Data placement rides along because it is cheap now and a migration later. An earlier
version of this section justified the milestone on disk pressure, and that was
overstated: `data/` is 2.9GB against 32GB free, and the two largest items in it —
1.1GB of NJ MOD-IV and the 529MB national ZCTA layer — do not grow when states are
added. The Northeast adds roughly 3 to 6GB counting Postgres, and Milestone 15 stops at
county level, which is where large national geometry would have been. **No Version 2
milestone as scoped requires an external volume.** What does justify the work is a
defect: `Settings.reports_dir` derives from `data_dir.parent`
([src/hip/config.py:140](src/hip/config.py:140)), so relocating the data root silently
relocates `reports/` with it — and `reports/regions/5y/*.md` are tracked in git and
linked from the README. It is dormant until someone moves the data root, and a trap
when they do.

**Milestone 12 precedes 14 because of wall-clock, not price.** Gemma 4 E4B took
9,140ms per generation in the Milestone 8 measurements. Twenty-one counties is three
minutes. Every Northeast county is about thirty; every US county is about eight hours,
serially, on a machine that cannot hold two models at once. Hosted inference is
concurrent, which is the property that matters. The token bill is the smaller argument:
at the measured prompt size a full county-level regeneration is single-digit dollars,
and it is the only recurring cost in the Version 2 architecture that is not rounding
error — which is why display-precision staleness gating is in the same milestone rather
than deferred as an optimization.

**The premise behind that gating was wrong, and the real cause is now fixed.** This
section previously argued that Zillow's retroactive monthly revisions marked nearly
every region stale on every run. Every one of the 21 explanations was indeed always
stale, but the review on 2026-09-06 found the cause elsewhere: `hip analyze` stamped a
new `hip_derived` release with the wall clock on every run, and window selection was
not deterministic, so the packet hash moved whether or not a number did (ARCHITECTURE
#73 and #77). Both are fixed, and a rebuild over an unchanged warehouse now produces a
byte-identical set of packets. Display-precision hashing stays on the milestone because
Zillow's revisions are real and will move raw floats — but it is now an optimisation
with a measurable baseline rather than a workaround for a defect, and Milestone 12
should measure how many regions a real monthly refresh actually marks stale before
deciding how much precision to discard.

**The preference list in Milestone 12 is a durability mechanism, not a tuning knob.**
Pinning generation to one hosted model reintroduces, as a vendor dependency, exactly
the single point of failure that running locally never had. The list resolves at
generation time to the first available candidate and ends at the local runtime, so no
vendor decision can stop `hip explain` from running. Two rules keep it from becoming a
back door around Milestone 8's discipline: only benchmarked models are eligible for the
list, and hosted identifiers are pinned to explicit versions rather than to moving
aliases — a withdrawn pin fails loudly and falls through, where a repointed alias would
change published prose with nothing in the output to show it had happened.

**Three hosted tiers before the local one, chosen for jurisdiction rather than for
capability.** DeepSeek, Gemini, and Mistral sit in three regulatory regimes — China, the
United States, the European Union — so no single policy action can remove two tiers at
once. That is the correlated failure worth designing against; simultaneous technical
outage across independent providers is not, and a network failure at this end is covered
only by the local runtime, which no number of hosted candidates improves. Capability is
deliberately not the ordering criterion, because Milestone 8 measured that it does not
predict quality on this task: Gemma 4 E4B scored 3.21 against Gemma 4 12B's 2.10, the
smaller model beating the larger one from its own family, with grounding and caveat
handling separating them rather than raw capability. Candidates are therefore chosen on
price and availability and ranked by the benchmark, never the reverse. Qwen joined the
`v3` slate on 2026-09-11 as a second contender for the China tier — for its pinned
snapshots, which DeepSeek does not offer, not as a fourth regime (ARCHITECTURE #105).
Run `v3` changed the list on 2026-09-11: Mistral Small 4 scored below the local model, so
the EU tier left, and Qwen's pinned snapshot joined DeepSeek as a second China tier — two
regimes and the machine, rather than three (ARCHITECTURE #118).

A router such as OpenRouter would supply this breadth through one integration and is
rejected for a specific reason: `region_explanations` records the model that wrote every
row and the dashboard shows it, so a service that silently selects a different backend
breaks the provenance the panel exists to provide, and would put prose from an
unbenchmarked model on a public page.

**What was borrowed from looking at comparable work, and what was not.** Reviewed
`edu.inframap.org` on 2026-09-05. Taken: a plain-language answer sentence at the top of
a region page, an inline glossary, caveats sitting beside the chart they qualify rather
than collected at the end, and disambiguating search results rather than listing bare
names. Rejected after argument, and recorded so it is not proposed again: **search as a
gate**, where nothing renders until the visitor searches. That is friction for both real
entry paths — a resident checking where they live, and someone evaluating a place they
are moving to — because both already know the place name and neither browses to find
one. Search belongs *on* the map as an always-available affordance, never in front of
it. A guided onboarding trail was rejected for the same reason: a choropleth of housing
costs is a familiar object in a way that a map of transmission lines is not, and a four-
step tutorial over it would be condescending. What survives from that idea is only that
Milestone 16's map must explain its own two-channel encoding in its legend.

**Selection is encoded by outline, not by colour, and unselected regions are muted rather
than hidden** (Milestone 16). Colour is already carrying the metric, so a selected region
that merely keeps its fill is indistinguishable from its neighbours at the pale end of the
sequential ramp; selection therefore needs a channel the data is not already using. The
mute must also be a neutral that cannot be read as the ramp's lowest step, which
`--seq-100` at `#cde2fb` very nearly is. Unselected regions stay visible on purpose:
this platform's product is rank and percentile, so removing the comparison set would
delete the context that makes a single figure mean anything.

**Milestone 17 is where the platform stops reporting and starts answering.** Everything
before it produces figures that are correct and that a reader still has to interpret: a
rank of 17 of 21 means nothing until you know whether 1 is good, or what is being
ranked. Region pages rank change over the window, not level, and this milestone's own
verdict example once read a change rank as a price rank — "$791,116, rank 17 of 21" as
"more expensive than 16 of New Jersey's 21 counties", when at $791,116 a county is among
the three most expensive in the state. A visitor makes the same misreading, which is
why every rank has to name its basis (corrected 2026-09-12). The views in that row are
deliberately deterministic — every one is computed from rank, percentile, and data the
warehouse already holds, with no model and no new source — because the interpretation
people need most is the interpretation least safe to generate. A verdict sentence that is
wrong is worse than a table that is merely unhelpful, and a sentence derived from a
percentile cannot be wrong in the way generated prose can.

**What the consumer views will not answer, decided 2026-09-13.** Three questions a
visitor will ask stay out of Milestone 17, recorded so they are not re-proposed as small
additions to it:

- *Will prices go up?* A forecast, which the next paragraph keeps out of Version 2. The
  historical persistence facts, now Milestone 50, are the descriptive answer.
- *Is it a good investment, or should I buy?* Advice. The platform publishes the figures
  a decision is made from, not the decision — which is why rent against own is a
  comparison of monthly costs with its omissions named, and why "whether the price
  rises" is one of them.
- *Schools, commutes and crime.* Each needs a new source family with its own licence,
  geography and cadence, and none of them is housing data; each would be a milestone,
  not an answer inside one. All three, with flood risk, are now Milestones 39, 43 and
  45 — from licensed sources, as components rather than a composite score.

**Affordability forecasting stays out of Version 2, and cost is not the reason.**
Extrapolating a CAGR is arithmetic; it would be nearly free. The objection is that it
would be the only number the platform publishes that traces to an assumption rather than
to a source release, on a site whose entire claim is that every figure names its origin.
It is also the one output where being wrong changes somebody's decision. If it is ever
built it needs its own accuracy evaluation — backtested against held-out history with
published error bars — in the way the interpretation layer got one, which makes it a
milestone rather than a feature. The honest cheap version already ships: a five-year
change and an annualised rate are forward-looking without claiming to know the future.

**Milestone 18 is scheduled before 16 and 17, out of numeric order.** Version 1 set the
precedent and the reasoning is the same: Milestone 9 was built before Milestone 5
because it corrected numbers the dashboard displayed, and fixing them afterwards would
have meant re-checking every chart. Establishing a design language after building the
three-dimensional map and the consumer entry point would mean rebuilding both of them
in it.

The problem is specific rather than cosmetic, and three findings define it.
`web/app/globals.css` declares no `:hover`, `:focus`, `:focus-visible`, `:active`, or
`transition` rule anywhere, so nothing on the page responds to being pointed at and
keyboard focus falls back to whatever the browser supplies. The landing page's metric
and window are module constants — `const METRIC = "zhvi_sfr"` in
[web/app/page.tsx](web/app/page.tsx) — so a reader cannot ask it a different question,
and a dashboard nothing can be asked of reads as a screenshot of one. And the type is
the system stack, which is the single largest reason a competent page still looks like
every other data page.

**What Milestone 18 must not discard matters as much as what it changes.** The palette
is a validated instrument rather than a default: warm neutrals instead of slate, three
categorical slots cleared against CVD and normal-vision contrast floors in both themes,
a documented relief rule for the aqua that measures 2.74:1, and dark steps selected for
the dark surface rather than inverted into it. `font-variant-numeric: tabular-nums` is
load-bearing on every table and tile. The print stylesheet is a first-class output, not
an afterthought. The interpretation panel's dashed border and indentation are how a SPEC
requirement is kept on screen rather than merely asserted. A revamp that restyles those
away is a regression wearing a new typeface.

**Milestone 13 follows 12 rather than preceding it.** Citation binding is deterministic
and model-independent, so either order works mechanically. It is scheduled second
because Milestone 12 measures the hosted candidates' fabrication rate against the
0.0% Gemma 4 E4B achieved, and that number is the argument for how strict the binding
has to be. It is scheduled before any expansion because it is the guardrail on prose
published under a personal domain, and because the retention it needs already exists —
the work is the index, not the schema.

**Both expansion milestones were deferred on 2026-09-07, and the order was rebuilt
around depth in one state.** The decision is to make New Jersey excellent before making
anything broader. The order set that day was 13, 20, 21, 18, 16, 17, with 14 and 15
moved to Post-Version 2; it was revised on 2026-09-10 to 22, 20, 21, 13, a fresh
benchmark, then 18, 16, 17, and on 2026-09-11 to end 18, 17, 16 — see below.

The storage argument for deferring them turned out to be half wrong, and the half that
was wrong is worth stating so it is not repeated. **Milestone 15 adds almost no
storage.** Zillow's county files, TIGER's county layer, FHFA, IRS migration and Census
permits are already national downloads that the pipeline takes in full and filters to New
Jersey at load time — the bytes are on disk today. Going national at county level is a
load-filter change plus roughly 1.2GB of Postgres, measured from 739 observations per
county across 3,196 regions. It is deferred because it does not serve the immediate goal,
not because it is expensive.

**Milestone 14 is the genuinely costly one**, and not chiefly in bytes. It is eight times
the pipeline volume at all five levels, and MOD-IV has no national equivalent: every state
publishes parcels in its own format under its own licence, so the depth layer that makes
New Jersey interesting does not travel. That is the milestone to be wary of.

**Milestone 16 is rescoped from a national county map to a New Jersey municipal one.** As
written it extruded 3,144 counties and therefore depended on 15, which is now deferred —
so the original could not be built in this order at all. The replacement is better on its
own terms: 564 municipalities carry far more visual information than 21 counties, the
geometry and the metrics are already loaded, and it removes the dependency entirely. A
national version stays available for whenever breadth returns.

**Milestone 21 is scheduled before 18, 16 and 17 on purpose.** Building a design system,
a map and a set of consumer views against an incomplete metric set means retrofitting all
three when tenure, vacancy and a rent benchmark arrive. The data is cheap — under 10MB
for all five sources — so the only cost of doing it first is a short delay, against the
certainty of rework if it goes last.

**Milestone 22 jumped the queue on 2026-09-10 for a vendor date, and the next benchmark
was deliberately held back.** DeepSeek began retiring models by routing their names to a
successor, which the platform had no way to detect; 22 made it detectable without
spending anything on a benchmark. The re-benchmark waits until 20, 21 and 13 have all
landed, so one fresh run measures the final packet shape, citation binding and the
reasoning-effort variants together — rather than three partial runs, each invalidated by
the next milestone. It has to be a new run, not an extension of `v2`: Milestone 21 changes
every packet, and `v2`'s scenarios are frozen from the old ones.

**The order among them was settled on 2026-09-10: 20, then 21, then 13, then the
benchmark.** 20 goes first because it has no data dependency and edits the same
per-provider request code and `CandidateModel` that 22 had just changed. 21 goes before 13
so citation binding is built and tested against the packet shape it will actually bind,
since 21 adds metrics to every packet. That is rework-avoidance rather than a hard
dependency — a binding generic over packet fields would mostly survive going first. The
case for 13 first was reducing risk on the live site sooner, but 21 marks every published
explanation stale, so nothing new reaches the site until the regeneration after the
benchmark either way. After the benchmark the preference list is reordered from the
result, the retired model's rows are removed, every explanation is regenerated, and the
site is redeployed; then 18, 16 and 17. The working checklist is at the top of
[TODO.md](TODO.md), under "Resume here".

**Milestone 17 moved ahead of 16 on 2026-09-11, so the order after the benchmark is 18,
17, 16.** Nothing was recorded for 16 before 17 when 18 moved ahead of both; they simply
kept their numbers. Three reasons for 17 first:

- 17 is where the platform starts answering rather than reporting (above), and Milestone
  21 has just loaded what its views need: Fair Market Rents, CHAS cost burden, tenure.
- 16 carries the most risk of the three — it reverses the no-map-library decision and
  brings in a WebGL renderer — and nothing else waits on it, so it is the one that can
  slip without holding anything up.
- They barely depend on each other. 17 lives mostly on region pages and in a new
  affordability view; its one use of a map, marking the places within reach, works on
  the current one, and 16 then designs its selection encoding against a real selection
  rather than a hypothetical one. Search, which belongs on the map, goes onto today's and
  moves with it.

The cost is that 17's affordability view is drawn on the two-dimensional map first and
moved onto the extruded one by 16.

**Milestone 23 goes between 17 and 16, decided 2026-09-14, so the order is now 18, 17, 23,
16.** It is the owner's review of what 18 and 17 shipped, and three reasons put it before
the map:

- It works on the pages 16 will not replace. The county pages, the reports and every
  metric's definition are most of it, and none of that waits on a new map.
- The New Jersey page's changes — the measure card, the ranking card, the call to action,
  a larger map — settle what the page around a map should look like, so 16 designs its
  extruded map into a finished page rather than a changing one.
- 16 is still the riskiest milestone left and nothing waits on it (above); putting the
  lower-risk pass first keeps the site improving while that risk is taken later.

The cost is that the New Jersey page's map is enlarged and restyled in 23 and replaced in
16, so some of 23's map work is short-lived; the card, controls and table around it carry
over. 23 shipped on 2026-09-16, so 16 is next.

**A redesign outside the sequence, "Quiet utility", was merged on 2026-09-17**
(ARCHITECTURE #162). It changed the site's surface — its palette, type and spacing — and
no figure, packet or page structure, so it moves no milestone.

### Decisions this version needs from the user

- **Hosted inference — settled 2026-09-01, [SPEC.md](SPEC.md) amended to v1.1.**
  Hosted by default, local runtime retained as a working fallback. An earlier version
  of this section said Milestone 12 contradicted the specification; that was wrong.
  Principle 8 already required the AI layer to be replaceable and named Gemini and
  DeepSeek among the providers the platform must not depend on, so the amendment was
  narrow rather than a change of philosophy: the evaluation obligation was widened from
  local models to every candidate, the diagrams were relabelled, and the loss of
  reproducible generation was written down as an accepted trade. Every other constraint
  is unchanged — packets only, explanation not chat, model choice from measurement, and
  the API still never runs a model ([ARCHITECTURE.md](ARCHITECTURE.md) #6).
- **Milestone 16 reverses the no-map-library decision.** The current choropleth is
  inline SVG rendered from our own GeoJSON, chosen deliberately. An extruded map means
  a WebGL renderer and a vector-tile format for anything below county level. It is a
  real reversal and gets its own Decisions Log row superseding the original, not a
  quiet dependency addition.

### Known constraints carried into Version 2

Written down now because each one shapes a milestone and none is a bug to be fixed
later.

- **`cousub` is the municipality layer**
  ([src/hip/sources/tiger.py:37](src/hip/sources/tiger.py:37), and
  `municipality_id_system: census_mcd`). New Jersey is a strong-MCD state where county
  subdivisions are real incorporated municipalities, and so is every state in
  Milestone 14. Much of the South and West is not: county subdivisions there are
  statistical divisions with no government, and Zillow's city-level data keys to Census
  *places* rather than to MCDs. Milestone 15 avoids the problem by stopping at county
  level. Anything below county level outside the strong-MCD states needs the geography
  decision that stays unscheduled with expansion, and `config/geography.yml` already warns that
  the identifier system is expensive to change once fact rows reference it.
- **Parcel and MOD-IV coverage does not generalize.** There is no free national parcel
  dataset; every state publishes its own format under its own license. The 3.48M NJ
  parcels stay a single-state depth layer, and no Version 2 milestone extends them.
- **Zillow is licensed for non-commercial use with attribution.** Public hosting as a
  portfolio piece is within that; monetizing the result is not.
- **Cloudflare Pages caps files per site.** Written before Milestone 11 as a question for
  it to answer; measured on 2026-09-18 and answered under "The file cap, measured" below,
  where it belongs — it constrains expansion and nothing in Versions 3 or 4.

## Version 3 Milestones (current, complete, and checkable)

**Scheduled 2026-09-18 from the owner's draft; restructured 2026-09-23.** Version 2
finished the *reach* of the platform — where it runs, what writes its prose, what it looks
like. Version 3 was scheduled to finish its *depth*, on data already held. On 2026-09-23
the owner folded Version 4 into it and turned the Director Note *Accessible, comprehensive,
and current housing data* into milestones, after a research report on that note — its
sources, freshness, costs, licensing and presentation — was checked against the code.
Version 3 is now the version that makes the platform current, as complete as public data
allows, and honest about both. That is a larger promise than the original one: Milestones
38–46 add sources, some of them needing a key or the publisher's permission.

**Why this order.** Milestone 24 went first because it moved every ACS window, and
building on a figure about to change is rework. Milestone 29 was brought forward on
2026-09-20, after the site was public: Zillow had republished while the warehouse held a
copy ten days old, and nothing could notice. The rest follows the same logic:

- **Reliability first (26–28).** Nothing new is worth adding to a site that cannot say how
  fresh its figures are or get a refresh onto the page, and every later milestone adds
  more surface that decays.
- **Then the readings, the licence pass and the commercial decision (30–32), before any
  new source**, so every source after them lands with its licence class and record type
  from the start, and the commercial answer can shape which sources are chosen.
- **Then the housing decision itself (33–37)**: cost, household-sized answers and what
  the sales and tax records already held can say.
- **Then context (38–46)**, one new source family per milestone, each naming its row in
  the [source register](#source-register).
- **Then the pages that assemble it (47)**, which need everything before them.
- **Last, the old Version 4 (48–50)**: facts that are still computed and sourced, which
  the interpretation layer can narrate and a forecast would be asked to beat.

**Shipped: 24, 25, 29. Next: 26.**

| M | Status | Deliverable |
|---|--------|-------------|
| 24 | ✅ done | **Fresher figures** — ACS moved to the 2020–2024 vintage behind `ACS_END_YEAR` in `src/hip/sources/registry.py`, beside `BLS_END_YEAR`, so the vintage list stops being hard-coded as it had been since Milestone 3; and the Census Population Estimates Program as `census_pep`, two keyless files, for headline population at state, county and municipal level. ACS remains the denominator of every computed ratio, pinned by a test. Measured on Mercer County: 383,286 on the old ACS vintage, 385,864 on the new one, 399,289 from PEP Vintage 2025. 3,516 PEP observations loaded across 1 state, 21 counties and 564 municipalities. The county explanations are stale pending a regeneration the owner deferred |
| 25 | ✅ done | **MOD-IV transactions and market value** — New Jersey's own transaction prices and its own effective tax rate, closing the **effective tax rate against market value** that ARCHITECTURE #141 wanted and rejected for lack of "sale prices or equalization ratios the warehouse does not hold". Neither turned out to be a MOD-IV column. The transaction half is the **SR1A Sales File** — 1.4M deeds across seven archives, carrying the state's own usable/non-usable determination — because MOD-IV's `SALES_CODE` records how a sale was *investigated*, not whether it is usable, and the usability field is absent from every field of NJ's ArcGIS publication at any token level (#179). The tax half is the state's published **General and Effective Tax Rates**, ingested rather than derived and validated against the **Director's Ratio** (#180). `sr1a_median_sale_price` is a rolling three-year median of verified prices on usable class-2 sales, per municipality, county and state; the three tax metrics are municipal. 48,975 new observations. The milestone also completed the CD-code crosswalk with ten verified aliases and gave MOD-IV the same one, so each of its municipal metrics gained ten municipalities (#184) |
| 26 | ⬜ planned | **Current releases** — every adapter discovers its newest release instead of requesting a hard-coded year: BLS through 2026 (`BLS_END_YEAR` is 2025), the 2025 annual Building Permits file (`default_vintage` is 2024), IRS migration for 2022–23 with a note on its changed matching method (`default_vintage` is `2122`), and HUD income limits for FY2026 (`IL_YEARS` ends at 2024). A release carries its **publication date and its effective date separately**, so a FY2027 standard never becomes operative before it takes effect. **The mortgage rate:** Freddie Mac's weekly 30-year benchmark for today's cost card, the monthly average kept for history, and an incomplete month labelled provisional rather than dated as if observed — the 6.67% against 6.95% question the Director Note raised, since `MORTGAGE30US` is fetched at `frequency=m`. FHFA's county and ZIP indexes are retested rather than taken as unreachable; MOD-IV's assessment year, SR1A's deed, recording and publication dates, and each NJ tax-rate product are audited separately. **Every source gets a recorded fallback** — another publisher, another route, a request to the agency, or its last figure kept and labelled historical — and a written procedure for the day a source stops answering, the case MOD-IV's token wall (#191) was handled without. **In its own section, with its own acceptance line: the models.** Qwen 3.7 Plus leaves the preference list (its free quota is spent), and readings from any model no longer on the list are retired at the next regeneration, pinned by a test. Gemma 4 E4B gets one copy that LM Studio and the project can share, `import_gguf.sh` enters the repo with its template fixed, and the MLX build is retested on a current `mlx-lm` — 0.31.3 could not load it at all. Peak memory falls by at least 1GB, cheapest first: the 12,288-token context to 8,192, which no generation needs more than; a quantized KV cache; and a smaller quantization only if the free figure check on the standard scenarios shows no loss |
| 27 | ⬜ planned | **Refresh reaches the reader** — `hip refresh` continues past `analyze` through `pack`, `publish`, `deploy` and `check-live`, inside boundaries decided as the milestone's **first task**: where it runs (this Mac under launchd, or a cloud runner — only the second unblocks the automated screenshots ARCHITECTURE #175 waits on), and what may run without asking (regenerating readings is billed; a deploy is public). A **public freshness page** per source: the period observed, when the publisher released it, when it was acquired, when it was last checked, the site version carrying it, the next expected release, and a status — current, delayed, unreachable, superseded, discontinued or historical — because *checked today* must never read as *measured today*. A **what changed since the last release** page, from the `fact_revision` rows Milestone 29 records and does not yet present. `check-live` pins one region per page shape instead of sampling the common path. A **report a problem with this figure** link on every figure, opening a GitHub issue pre-filled with its source and release. And the first run of [the completeness standing check](#the-completeness-standing-check) |
| 28 | ⬜ planned | **Figures that read right at a glance** — margins of error for every ACS figure, requested beside each estimate and carried to the page, and ranks that stop implying differences the error cannot support: a region whose interval overlaps its neighbours' reads *near the middle*, not a precise place. The renter cost-burden denominator stops counting households whose burden the Census could not compute (`B25070_011E`), or is labelled as the custom denominator it is. Every rank names its real cohort — *6 / 21 NJ counties*, *42 / 551 municipalities with data* — so the standalone *every figure ranked against New Jersey's 21 counties* line can go; and an index value leads with a common-period change and carries its baseline beneath it (*442.7 — about 4.4× its 1991 Q1 level*). Both presentation questions in the Director Note of 2026-09-19 |
| 29 | ✅ done | **Scheduled refresh** — the platform stops decaying silently. A pinned vintage is answered from disk; a `current` or year-to-date ref is revalidated with `If-Modified-Since`/`If-None-Match` and a 304 is a cache hit (#188); a publisher offering no validator falls back to a bounded age (#189). A failed ref is reported and the run continues, and the report separates *asked and told unchanged* from *never asked* — the distinction the old "172 cached" hid (#190). `hip refresh` exits 0, 3 or 1 and stops before the pipeline when nothing moved (#192); `hip prune-raw` keeps every release a fact cites and removes the rest (#193); `fact_revision` records a figure that changes (#194). **Brought forward ahead of 26–28 on 2026-09-20**, measured with 0.20.1 already live: Zillow had republished on 2026-09-16 while the warehouse held 2026-09-06. The first full run under it refreshed 28 stale refs — among them `MORTGAGE30US`, which sits on the cost card — found `nj_modiv` behind a token and carried on past it (#191), and recorded **313,536 revisions**, 294,469 of them Zillow restating its own published history at a median 1.06% |
| 30 | ⬜ planned | **Readings for every reader** — **one analyst reading per region**, the interpretation as it is today, written by Gemini 3.7 Flash with the existing fallback list behind it, in place of four models' readings side by side; and **one consumer reading**, a single generation giving a bottom line and short answers to fixed questions — *is it getting harder to afford here, rent or buy, what's changing, what should I check before moving* — with at most a couple of figures each, no source names and no jargon, under the same citation binding. The consumer model is chosen by generating both formats with DeepSeek, Gemini and Flash-Lite on three counties and reading them, not by guess, and has its own fallback list ending on this machine. **Batch pricing for every hosted model on the analyst list**, starting from the open questions in the batch-pricing Director Note: which providers offer a batch API and at what discount, what a partly failed batch means for a publish, and how failover works when failures return hours later. A provider without one runs synchronously and says so in the run report, which also states what the run cost. Two generations per region instead of four, before any discount. Milestone 47 reuses the fixed-question answers |
| 31 | ⬜ planned | **Licence and provenance pass** — principle 11 on every figure: whether it is an administrative observation, a calculation, a survey estimate, a modelled index or a scenario, visible where it is read. A record-type line and a **licence class** per source in `config/sources.yml` and the `sources` table, and the licence **propagates**: a figure derived from a restricted source inherits the restriction, and so does any download of it. A **download this page's data** option with the licence and a citation line attached, wherever the licence allows. A per-page print footer carrying the non-commercial terms, so a single page cut from a saved PDF still carries them. Every source's terms re-read — FRED's series carry their originators' rights, Freddie Mac syndicates its survey under its own policy, and Realtor.com's research terms have never been read. A written scraping policy: bulk downloads, then documented APIs, then services meant for reuse, then permission-based extraction; never listing portals, and never a bypassed control. And the model-comparison dashboard, whose data has sat in `data/eval/v1` since Milestone 8. *(Old 28, extended.)* |
| 32 | ⬜ planned | **Commercial viability study** — ends in a **go or no-go**, like Milestone 52. A licence table for every source — display, download, derived figures, commercial use — built on Milestone 31's pass; which headline figures survive with every restricted source removed; where the owner's request to Zillow for a written determination stands; and what paid data would actually cost, per vendor rather than by category, with RentCast tested on its free allowance under a hard request budget and no subscription. **Go** means a change to `SPEC.md`, which is the owner's decision, and a milestone to build a commercially cleared variant of the site. **No-go** is recorded in ARCHITECTURE.md with what would have to change for a later go. `SPEC.md` says nothing about commercial use today; principle 4 says only that public data comes first |
| 33 | ⬜ planned | **The full cost of owning** — four views instead of one total: monthly cash, upfront cash, the cost of owning excluding principal, and long-horizon scenarios. Homeowners and flood insurance, mortgage insurance below 20% down, HOA fees, a maintenance reserve, utilities (never counted twice where a rent already includes them), closing costs, moving and first repairs, and selling costs only where a holding period is set. The reader can enter a purchase price with the published figure prefilled, a tax bill, an insurance quote, a rate and a rent; what a reader enters changes their scenario, never the town's published figures or its rankings. A total missing a component says *partial estimate* beside the number. Renting's own costs beside owning's, tax relief and assistance as links with a review date and never an automatic subtraction, and no individual tax bill from price × effective rate (#187) |
| 34 | ⬜ planned | **ACS depth and direct ZIP coverage** — rent by bedroom count and its distribution, owner costs with and without a mortgage, severe cost burden, units in structure (`B25024`), year built (`B25034`), bedrooms and crowding, plumbing and kitchen completeness, vacancy by reason, heating fuel, vehicles available, commute mode and time, household composition and disability — each with its margin of error from the start. ZCTA data fetched directly, filtered to New Jersey's, and labelled ZCTA, never ZIP: since 2020 the ACS no longer nests ZCTAs within states, which is why Milestone 3 skipped them |
| 35 | ⬜ planned | **Household-sized answers** — HUD income limits for the reader's household size (only the four-person 80% limit is stored today, so this begins by checking what the landed file carries), saying where an income sits against HUD's line and never who qualifies for a programme, which is eligibility advice. And a rent evidence panel by bedroom count — Zillow's ZORI, ACS gross rent, HUD Fair Market Rents, HUD Small Area Fair Market Rents by ZIP, and the reader's own rent — each labelled for what it measures: listing movement, what occupants pay, or an administrative benchmark. *(Old 26's income half; its transport half is 43.)* |
| 36 | ⬜ planned | **How homes change hands** — more out of SR1A and MOD-IV, both already held: sale counts, price quartiles and sample sizes, fresher windows where a sample allows, the age mix of what sold, sale-to-assessment ratios, price per square foot only where living area is filled in, revaluation context, and a reconciliation of the municipal identifiers still unmatched. Guardrails, each pinned by a test: property classes stay separate, a parcel is not a dwelling unit, a county median is never a median of town medians, and a rising median is labelled as possibly a change in *which* homes sold |
| 37 | ⬜ planned | **Property tax: what you'd actually pay** — a reader looks up a block and lot, or an address, and sees that property's assessed value and last tax from MOD-IV, the town's revaluation history and whether one is due, and how its assessment compares with the town's — data already held, answering a question a search engine cannot. Owner names are never landed or shown, the boundary SR1A already keeps (#183). Served as per-municipality files from object storage and never as pages: 3.48M parcels as pages would be 174 times the free file cap |
| 38 | ⬜ planned | **Approved vs built** — NJ's Construction Reporter: certificates of occupancy, demolitions and net additions by building type and size, beside the permits already held, with proposed, approved, permitted and completed kept as separate stages. Recent state records are checked for coverage and revision before they are trusted. Answers *is this area adding housing, or only approving it* |
| 39 | ⬜ planned | **Flood and environmental exposure** — FEMA's National Flood Hazard Layer with NJDEP's climate-adjusted flood layers, contaminated sites and drinking-water context, kept as separate components. Never *safe from flooding* outside a mapped zone, and a municipality's flooded share of land is not a household's risk. Links into Milestone 33's conditional flood-insurance line. *(Old 32's flood row.)* |
| 40 | ⬜ planned | **Affordable housing and assistance** — three questions kept apart: what towns are obligated to provide (DCA's fourth-round figures), what has been completed (municipal reporting on units and trust funds), and where someone can apply today (housing authorities and programme administrators, with application and waiting-list links). HUD LIHTC properties and HUD's assisted-housing inventories, with bedroom and accessibility fields where supplied and restrictions nearing expiry. The National Housing Preservation Database only under its licence |
| 41 | ⬜ planned | **Accessibility audit** — the site against WCAG 2.2 AA, with fixes and a check that keeps it there. The carousels, the map, the floating definitions and the mode switch have only ever been checked in part. A Spanish edition is a separate go / no-go, unscheduled |
| 42 | ⬜ planned | **Evictions** — eviction filings and warrants of removal by ZIP from DCA's Municipal Housing Profile, with *a filing is not an eviction*, *a warrant is not an executed removal* and repeat filings stated where they are read. **Gated on DCA** supplying the underlying tables, a data dictionary, an update calendar and reuse terms — the owner's request, not a scrape of the rendered dashboard. If the gate is not met the milestone parks, and does not hold up the ones after it |
| 43 | ⬜ planned | **Getting around** — **first task: whether HUD's Location Affordability Index is used at all.** Confirm the data years its current version rests on, then drop it, keep it with those years stated, or propose a current transport-cost estimate as Version 4 work. Then Census LODES for where residents work, ACS commute mode and time (Milestone 34), and NJ TRANSIT service; EPA's Smart Location Database only with its vintage stated. Aggregated to municipality — see the file cap trap below. *(Old 26's transport half and old 32's EPA row.)* |
| 44 | ⬜ planned | **Somewhere like here, but cheaper** — the places nearest a region on a small, named set of measures with a lower home value. Deterministic. The page names the measures it matched on, because "like here" is a choice the platform makes on the reader's behalf and an unnamed one is not checkable. Now with side-by-side comparison on comparable measures, and a commute limit once Milestone 43 exists. *(Old 27.)* |
| 45 | ⬜ planned | **Schools and community context** — NJ DOE performance with district boundaries (a district is not an assignment to a school), FCC broadband availability (availability is not measured speed, and its location Fabric carries separate licensing), NJ State Police crime data with its reporting coverage audited (no report is not zero crime), CDC PLACES for health and environment, and DOE's LEAD tool for energy burden. **Components, cited — never a composite score.** A single "7.8/10 neighbourhood grade" is exactly the output whose provenance cannot be traced, on a site whose whole claim is that every figure names its release. *(Old 32's remaining rows.)* |
| 46 | ⬜ planned | **Mortgage lending** — HMDA: origination volumes, loan types and terms, reported rates and costs, denial patterns, and borrower-income and loan-size distributions. *What financing has actually been used here*, never *what rate you would qualify for*; its privacy modifications and reporting exclusions stated where it is read |
| 47 | ⬜ planned | **Decision guides** — pages that take a question and assemble the answer from Milestones 33–46: *can I afford to buy here, should I rent or buy, what should I check before an offer*. Every answer shows its source, period, geography, calculation and limitation, and links to the official next step. Reuses Milestone 30's fixed-question answers. This is the Director Note's *better than a Google search*, and it comes late because it assembles everything before it |
| 48 | ⬜ planned | **Migration-driven demand** — IRS county-to-county flows, already loaded, read as demand pressure rather than as a standalone count. *(Old 33.)* |
| 49 | ⬜ planned | **Relationship facts** — a section of the packet drawn from a closed set of relation types ("values rose 30% while incomes rose 12%, so price-to-income moved from 3.1 to 3.8"), which Milestone 13's citation binding extends to, so a model can narrate only a relationship that exists as a fact. With it, a check in the evaluation for causal wording — "because", "driven by", "due to" — not backed by a relationship fact. **Not** four chained model calls, one per interpretive function: that multiplies cost and latency, and an unsupported claim from one step becomes evidence for the next, where the evaluation can no longer see where it came from. *(Old 30.)* |
| 50 | ⬜ planned | **Historical persistence facts** — the descriptive answer to "is this pressure temporary or persistent?", which is the question a forecast would be asked. How far a region's price-to-income sits above its own long-run range, and how long past episodes that far above it lasted. Constrained by history: FHFA reaches back decades, the income side does not, and a range is only as long as its shorter series — which the fact has to say. *(Old 31.)* |
| MAP | ⬜ planned | **The map's standing check**, plus the debt V2 hands it — the recurring gate defined in [The map's standing check](#the-maps-standing-check). Not a feature, and not a new number: it is the same check every version. V3's run additionally has to clear the three budgets that were red when the gate was written, and **the 504ms input is the named first task**: a single event took half a second to answer with no long task anywhere, which is a defect of a different shape from a slow frame and has never been looked at |
| COMPLETE | ⬜ planned | **The completeness standing check** — the second recurring gate, defined in [The completeness standing check](#the-completeness-standing-check): first run in Milestone 27, re-run at every milestone's close, reported in its completion report |

### Decisions Version 3 needs from the owner

- **Milestone 27:** where the refresh runs — this Mac or a cloud runner — and what it may
  do without asking.
- **Milestone 30:** the consumer reading's model, after the three-county side-by-side.
- **Milestone 32:** go or no-go on a commercial path, and whether a go changes `SPEC.md`.
- **Milestone 43:** whether HUD's Location Affordability Index is used.

**Outreach only the owner can send, worth starting now** because replies take weeks:
DCA's data team (gates 42; helps 38 and 40), Zillow for a written licence determination
(32), NJ's Division of Taxation and Office of GIS for stable bulk endpoints and revision
notices (26, 36, 37), NJHMFA and housing authorities for affordable-housing inventories and
application links (40), and Rutgers CUPR for a methodology review (Version 4).

### Renumbered 2026-09-23

Milestones not yet built were renumbered in build order when Version 3 absorbed Version 4
and Version 5 became Version 4. `CHANGELOG.md`, `ARCHITECTURE.md` decision rows and
`DIRECTOR_NOTES.md` entries written before that date use the old numbers and are left as
written; this table resolves them.

| Old | Now |
|---|---|
| 26 — Where an income really stands here | 35 (income limits) and 43 (transport) |
| 27 — Somewhere like here, but cheaper | 44 |
| 28 — Provenance pass | 31 |
| 30 — Relationship facts | 49 |
| 31 — Historical persistence facts | 50 |
| 32 — Neighbourhood context | 39 (flood), 43 (EPA), 45 (the rest) |
| 33 — Migration-driven demand | 48 |
| 34 — Affordability forecasting | 53 |
| 35 — Bring-your-own-model comparison | unscheduled |

14 and 15 keep their numbers; see [Still unscheduled](#still-unscheduled).

## Version 4 Milestones (what the platform is willing to claim)

Was Version 5 until 2026-09-23. Every milestone here would publish a figure that is
modelled rather than measured, so each has to meet principle 11 — labelled, dated, with
its method, its validation, its uncertainty and a path back to the observations beneath
it — and each may end with nothing published. There is no global *current* or *future*
mode switch: a figure says what kind it is where it is read. The open model harness that
sat here went to unscheduled on 2026-09-23, and expansion sat here until 2026-09-18, when
the owner returned Milestones 14 and 15 to unscheduled.

| M | Status | Deliverable |
|---|--------|-------------|
| 51 | ⬜ planned | **Selected nowcasts** — estimates of the current, incompletely observed period for a small number of delayed metrics, each validated against what was later published, labelled *nowcast* with its as-of date and uncertainty, and withheld where the evidence is weak. Never a uniform inflation of old figures, which erases real differences between places behind convincing decimals, and **no projected rankings**: ranking uncertain estimates manufactures precision |
| 52 | ⬜ planned | **Local price model study** — ends in a **go or no-go**. Whether SR1A can support a home-value index of the platform's own, repeat-sales or hedonic: the first answer to *what homes here are worth*, rather than *what sold*, that does not depend on Zillow. Needs stable property matching, enough repeat sales, a treatment of renovations, and out-of-sample testing. A no is a complete answer |
| 53 | ⬜ planned | **Affordability forecasting**, behind the four conditions already recorded: it beats a no-change and a straight-line baseline on held-out history or it does not publish; its confidence is an interval whose coverage the backtest measured, never a label, because a model reading "confidence: high" will say it more strongly than it should; it states the lag it inherits, since ACS 5-year estimates overlap by four years and a projection compounds that; and "temporary or persistent" is computed by the module, never concluded by a model. It produces evidence — direction, magnitude, horizon, interval, assumptions — for the interpretation layer to read beside Milestone 50's history. **Needs its own accuracy evaluation**, the way the interpretation layer got one. Backtests run on the figures as they stood at each forecast date, not as since revised — which `fact_revision` (Milestone 29) makes possible — broken down by geography and horizon, with a rule for withholding a forecast where the evidence is weak, and scenarios (*what if rates rise a point?*) before predictions. *(Old 34.)* |
| MAP | ⬜ planned | **The map's standing check** — the recurring gate defined in [The map's standing check](#the-maps-standing-check). Not a feature, and not a new number: it is the same check every version, run before that version closes |

## The map's standing check

**A gate, not a milestone, and deliberately so.** A milestone is a slice of capability
that ships once; this is a condition a version has to meet before it closes, and it is
the *same* condition every time. Giving it a number each version would imply a different
piece of work each time, and would leave the procedure to be rewritten — and to drift —
with every version. It sits in each version's table as `MAP` so that it carries a status
and cannot be quietly skipped, and it is written out once, here.

**Why it recurs.** The map's cost scales with what is on screen, not with the size of the
codebase, and almost every planned version puts more on screen: Milestone 25 added
measures to colour by and Milestones 34–46 add more, Milestones 39, 43 and 45 add whole
layers of context, and the two unscheduled expansions would multiply the outlines by
twenty. Work that was
comfortable at 564 municipalities and four measure groups is not automatically
comfortable after any of those. None of this is caught by the test suite, because none of
it is a wrong answer — it is a right answer delivered too late.

### Run it on the owner's machine, on the built site

Not in development, and not from an automated browser. Both of those lie, and the record
of how they lied is in ARCHITECTURE #169 through #172: a development build renders every
component twice and minifies nothing, and the automated browser this project uses cannot
be trusted for frame timing — four rounds of map optimisation in September 2026 were
aimed at the wrong half of the problem because of it. The defect that finally mattered,
a zoom running at full cost for a second at a time, was found by the owner's own reading
and by nothing else.

```
make publish && make deploy      # or a local production build
open "<the site>/afford?perf"
```

`?perf` shows `components/FrameMeter.tsx`, which separates frames where a hand was on
something from everything else. **That component is part of this contract and is not to
be removed as dead code.**

### The three scenarios, fixed so readings compare

| | What to do | Which numbers it exercises |
|---|---|---|
| **Drag** | Ten seconds of dragging on `/afford`, at the framing the page opens at | `HAND-ON` — the slide, the commits, the crosshair |
| **Zoom** | Five steps in and five out, crossing county into municipalities | `HAND-ON` and `idle` — flights, and the level switch |
| **Cold** | Load `/afford` fresh with an empty cache | `idle` — the first render of 564 outlines |

### The budgets

| Reading | Budget | 2026-09-18 |
|---|---|---|
| `HAND-ON` median | ≤ 20ms | 17.0ms ✅ |
| `HAND-ON` p95 | ≤ 50ms | 71.0ms ❌ |
| `idle` p95 | ≤ 80ms | 110.0ms ❌ |
| slowest input | ≤ 200ms | 504.0ms ❌ |
| long tasks | 0 | 0 ✅ |

**Three of those five are red today, and that is the point of writing them down.** The map
is usable and the owner has said so; it is not within the budget this project wants to
hold it to, and an unexplained half-second input is a defect nobody has looked at yet.
A version closing red is a decision to be taken in the open, not a number to be moved.

### Debt a version carries in

A run that misses a budget does not stop a version closing — that is the owner's call —
but the miss is carried forward by name, into the next version's row, until it is cleared
or consciously written off. A budget quietly dropped between versions is the failure mode
this whole section exists to prevent.

**Carried into V3, from the run of 2026-09-18:** `HAND-ON` p95 at 71ms against 50ms,
`idle` p95 at 110ms against 80ms, and the **504ms slowest input**. The last is the one to
start with. It is not a slow frame — no task blocked the main thread at all — so it is a
different defect, and the likeliest candidates are a click that forces a large re-render
and relayout (the town table's "Show all" is 585 rows), or the first interaction landing
while the map is still doing its one-time work. `FrameMeter` now records which event it
was, so the investigation starts with a name rather than a number.

### Within a version, not only at the end

Any milestone that adds a **layer**, a **level**, or a **measure group** to the map runs
the drag scenario before it is called done — the check at the version boundary is a
backstop, not the only time anyone looks. On present plans that is every one of
Milestones 34–46 that puts a measure or a layer on the map, and either expansion if it
is ever scheduled.

### The record

Append one row per run. Never rewrite a row: a budget that was missed and then met is two
rows, and the pair is the useful thing.

| Date | Version | Drag p95 | Idle p95 | Slowest input | Verdict |
|---|---|---|---|---|---|
| 2026-09-18 | V2, after the map's performance work | 71.0ms | 110.0ms | 504.0ms | ❌ three budgets missed; carried into V3 |

## The completeness standing check

**Why this exists.** A platform can look more complete by filling cells — a neighbouring
geography's figure, an old observation, a model shown as a measurement — and become less
truthful doing it. Completeness needs a definition that does not reward that, measured
the same way every time. Decided 2026-09-23 with Version 3's restructure. Like the map's
check it is a gate rather than a milestone, carried in each version's table as
`COMPLETE`.

**Six dimensions, per source and per metric:**

| Dimension | What is measured |
|---|---|
| Geographic | the share of municipalities, ZIPs and population a metric covers |
| Temporal | the newest release available, acquired and published — three dates, not one |
| Subject | whether price, rent, financing, taxes, stock, supply, assistance, hazards and access are each held |
| Statistical quality | sample counts, margins of error, suppression and match quality |
| Usability | which of a fixed list of reader questions the site answers, and which it says it cannot |
| Reuse rights | whether the licence allows display, download, derived figures and commercial use |

**When.** First in Milestone 27, then at every milestone's close, with the change reported
in its completion report. **A blank that stays blank is not a regression; a blank filled
by a proxy the page does not name is.**

### The record

Append one row per run, never rewriting one. The first is Milestone 27's.

| Date | After | Summary |
|---|---|---|

## Source register

**Why this exists.** The owner asked on 2026-09-18 whether the platform is leaving free,
licence-clean data on the table, and what the next paid source would be if it is not.
That is not a milestone — it is a question worth asking every time a milestone proposes
a new metric. This table is the standing answer, and the rule that goes with it:

> **A milestone proposing a new metric names the register row it comes from, or adds
> one.** A row is *in use*, *scheduled* (naming the milestone), *rejected* (naming the
> reason), or *unscheduled* (naming the trigger that would schedule it).

The rejected rows matter as much as the rest: they stop a source being re-proposed every
few months, and three of them below were re-proposed at least once already.

**In use — 16 sources.** Census TIGER, ACS, Population Estimates, Building Permits;
Zillow ZHVI and ZORI; FHFA HPI; FRED; BLS; HUD (crosswalk, income limits), HUD FMR, HUD
CHAS; IRS migration; NJ MOD-IV, the SR1A Sales File and NJ's published tax rates. Terms
are in `config/sources.yml` and rendered in the site footer. *(Corrected 2026-09-23: this
line still said 13 after Milestones 24 and 25 had added three.)*

**Free, not yet held.** Every row is public domain or an open state record unless the row
says otherwise. Rows scheduled on 2026-09-23 come from the research behind Version 3's
restructure, and each milestone's first task confirms its source against the publisher.

| Source | What it adds | Where |
|---|---|---|
| FHFA county and ZIP HPI | Local price trends that do not depend on Zillow — once judged unreachable, to be retested | M26 |
| Freddie Mac PMMS, weekly | Today's mortgage benchmark: FRED's `MORTGAGE30US` at its native weekly frequency | M26 |
| HUD Small Area Fair Market Rents | ZIP-level rent benchmarks by bedroom | M35 |
| NJ Table of Equalized Valuations | Equalized valuation per municipality — the weights a county tax rate needs | M37 |
| NJ Construction Reporter | Certificates of occupancy, demolitions, net additions | M38 |
| FEMA National Flood Hazard Layer | Flood risk — *the highest consumer value on this list* | M39 |
| NJDEP flood and climate layers, contaminated sites, drinking water | The future flood picture FEMA's maps do not capture, and environmental context | M39 |
| NJ DCA affordable-housing reporting | Obligations, completed units and trust funds | M40 |
| HUD LIHTC and assisted-housing inventories, incl. Picture of Subsidized Households | Where subsidised housing is | M40 |
| NJ DCA Municipal Housing Profile | Eviction filings and warrants by ZIP — **reuse terms to be confirmed with DCA** | M42, gated |
| Census LEHD / LODES | Where people work against where they live | M43 |
| NJ TRANSIT GTFS | Transit service — **developer terms to be read** | M43 |
| EPA Smart Location Database | Walkability, transit access, density — **vintage to be stated** | M43 |
| HUD Location Affordability Index | Housing **plus transport** cost — **data years to be confirmed; may be dropped** | M43 decides |
| NCES Common Core / EDGE + NJ DOE | School districts and performance | M45 |
| NJ State Police UCR | Municipal crime, the licence-clean route | M45 |
| CDC PLACES | Health and environment by tract | M45 |
| FCC Broadband Data Collection | Broadband availability — **its location Fabric is licensed separately** | M45 |
| DOE LEAD | Household energy burden | M45 |
| HMDA (CFPB) | Mortgage originations, loan types, rates and denials | M46 |
| BEA regional income | Per-capita income beside the ACS | Unscheduled |
| USDA Food Access Atlas, CDC/ATSDR SVI, Census CBP | Context measures | Unscheduled |
| Zillow's other cuts | Bottom- and top-tier ZHVI, new construction | Unscheduled; sized in TODO, storage is the constraint |
| Zoning and redevelopment plans, rental registration and inspection aggregates, parks, healthcare access, utility tariffs, sewer and septic service, accessible housing | Candidates that need jurisdiction-by-jurisdiction access and coverage checks | Unscheduled; not integration-ready |

**Permission-dependent — usable only on the publisher's written terms.**

| Source | Standing |
|---|---|
| **Realtor.com research data** | Free county and ZIP market data, inventory included. Its terms could not be read on 2026-09-18 — the browser used then refused the domain. **Unverified, not rejected**; Milestone 31 reads them |
| **Zillow, commercial use** | Research data is licensed for non-commercial use with attribution. A written determination for this platform's actual uses is the owner's request, and Milestone 32 waits on it |
| **National Housing Preservation Database** | Free access, but interactive property-level reuse needs a licence. Milestone 40 uses it only under one |
| **RentCast** | A paid API whose terms reportedly allow storage and some display and redistribution, subject to restrictions — not yet read here. Milestone 32 tests it on its free allowance only |

**Rejected, with the reason.**

| Source | Why not |
|---|---|
| **Niche** | No public API and terms that forbid scraping. A score built on it would be the first figure on the site that cannot name a licensable source, on a page whose footer names every publisher and its terms. Raised 2026-09-18, answered by the old M32, now Milestone 45 |
| **Redfin Data Center** | Checked 2026-09-18: the Data Center pages state no redistribution grant, and Redfin's Terms of Use §2.3.3 forbid reproducing, redistributing and creating derivative works, §2.3.4 grants no right to reproduce, and §2.9.4 forbids displaying or distributing information from the Services, naming "data mining" and re-organising expressly. Attractive because it publishes real sale prices; not usable on a public site |
| **Zillow ZTRAX** | The old free research route to deed-level transactions. Discontinued 2023 |
| **FBI Crime Data Explorer** | Public domain, but reported per *agency* rather than per geography, with patchy participation. Mapping agencies to municipalities would invent precision the source does not have. NJ State Police UCR is the honest route for this state |
| **Single-family rent (Zillow)** | Published by metro only (checked 2026-09-14). Needs a `metro` level — a `region_level` change touching a table every fact row references — to cover part of one state, and fits worst across northern New Jersey, where most people live and where single-family and all rents differ by 1%. **Trigger: Zillow publishes it by county or town, or a metro level arrives for another reason.** Milestone 23 keeps the all-rental figure and says plainly that houses usually rent for more |

**The paid tier, reconsidered 2026-09-23.** This paragraph used to say that every paid
property-data vendor forbids redistribution, citing a comparison of the five cheapest in
TODO.md. That comparison left TODO.md when it was restructured on 2026-09-19 — recover it
with `git show b7ccd98^:TODO.md` — and the claim was broader than its evidence. What still
holds is the constraint behind it: the platform publishes static artifacts, so a source
whose terms forbid redistribution can only be consulted, never published, and a
server-side proxy changes where a request is made without granting any right the terms
withhold. Whether any vendor clears that bar is Milestone 32's question, answered per
vendor with a free-allowance test and a hard budget. Live MLS listings stay blocked by
display rules rather than by cost.

## Still unscheduled

**Expansion past New Jersey**, returned here by the owner on 2026-09-18 after briefly
sitting in Version 5. It was deferred on 2026-09-07 for reasons that have not changed,
and the three entries below are one chain: nothing after the first can start before it.

- **Milestone 14 — Northeast expansion.** CT, MA, ME, NH, NY, PA, RI and VT at all five
  levels: the first run of the pipeline at roughly seven times current volume, and a
  per-state coverage report saying what each source did and did not resolve. Kept as
  Milestone 14 rather than renumbered, because the row in the Version 2 table above is
  the record of what was planned and when.
- **Milestone 15 — national county coverage.** All 50 states, DC and PR at `state` and
  `county` level only, on federal sources that key on exact FIPS — national coverage
  without a national municipality model, which is what makes it far cheaper than 14
  despite covering more ground.
- **The geography model for non-MCD states**, which follows expansion rather than
  leading it: whether `place` becomes a sixth level beside `municipality`, whether the
  identifier system is chosen per state in `config/geography.yml`, or whether municipal
  analysis simply stops at the strong-MCD states. The schema change is small — an enum
  value and a config key — and the migration is not, because `region_id` is referenced by
  every fact row. **Trigger: any expansion below county level outside the strong-MCD
  states.** Milestone 15 avoids it by stopping at county; the strong-MCD states (WI, MI,
  MN, ND, SD) extend Milestone 14 with no geography change at all.

**Returned or raised on 2026-09-23, with the reason each waits:**

- **Bring-your-own-model comparison** (the old Milestone 35) — a visitor points the
  platform at a model of their own and sees it answer the same scenarios, scored the same
  way. The scenarios, the figure-checking, the rubric and the `ModelRunner` protocol all
  exist; what is missing is a place to run it, since the site is static, and a judge,
  which is a paid call the visitor would supply a key for. The deterministic half needs
  neither and is the honest place to start. **Trigger: the owner schedules it.**
- **A Spanish edition** — a go / no-go study first: every definition, label and generated
  reading would need a translation kept in step with the English, so it is a standing
  cost rather than a one-off. **Trigger: the owner schedules the study.**
- **Alerts** — *tell me when this changes*. The site is static, so it needs a server and
  a mailing list the platform does not have. **Trigger: the platform gains a server for
  another reason.**

**Documentation images wait on automated deployment**, decided 2026-09-19
(ARCHITECTURE #175). README screenshots are to be captured from the finished static
export at deploy time rather than committed to the repository, which cannot be built
until deployment itself runs without a laptop open. Milestone 27 decides where the refresh
runs, and only a runner off this machine unblocks this — the same prerequisite Milestone 29
carries for scheduled refresh. Until then the Screenshots section stays empty and
retakes are a manual `npm run screenshot:poc`. The investigation behind the decision,
including the costed alternatives, is `agent-handoffs/screenshot-automation.md`.

**Parcel and MOD-IV coverage does not generalize**, recorded when these were deferred:
there is no free national parcel layer, and each state publishes assessments in its own
format under its own licence. The second constraint, the file cap, is measured below.

### The file cap, measured

Counted on 2026-09-18 against Cloudflare's published limits and this repository's own
`dist/`. It bites on expansion and **on nothing in Versions 3 or 4**, neither of which
adds a region — so long as the two traps below are avoided.

- **Free plan: 20,000 files per site. Paid plans: 100,000**, and the higher limit is not
  automatic — it needs `PAGES_WRANGLER_MAJOR_VERSION=4` set in the Pages project.
- **A region costs 10 files**: a page and a report, each with its HTML and the RSC
  payloads a static export writes beside it. Shared chunks are another 2,318.
- **Today: 13,658 files for 1,134 regions — 68% of the free cap**, with room for about
  630 more regions before it is reached.

| | Regions | Files | Free (20k) | Paid (100k) |
|---|---|---|---|---|
| New Jersey today | 1,134 | 13,658 | 68% | 14% |
| Milestone 15, national county | ~3,200 | ~34,000 | over | fits comfortably |
| Milestone 14, Northeast | ~8,000 | ~82,000 | over | ~82%, nothing spare |
| National municipality | ~30,000+ | ~300,000 | over | over |

**So a subscription buys Milestone 15 outright and Milestone 14 only just.** 14 lands at
about 82% of the paid cap with no room for growth, and 14 *plus* 15 exceeds it. National
municipality coverage is out of reach at any price, which is what this constraint was
always about.

**The fix is the artifact layout, and Milestone 16 already proved it here.** `map.json`
is one fetched-on-use file serving 564 municipalities where the per-region approach would
have pre-rendered 564. Applied to the long tail of region pages — a data layer with
client rendering, keeping pre-rendered HTML only for the regions people actually arrive
on — it decouples file count from region count, and the cap stops being a ceiling on
geography. That is the decision Milestone 11 deferred, and it is now the cheaper of the
two options rather than the more speculative one.

Two things hold whichever plan is in use: the published **artifacts go to R2, which has
no file cap**, so only the site half counts; and upload time scales with file count —
13,658 files take about 37 seconds, and 82,000 would take five to seven minutes per
deploy.

**Two traps worth naming in Version 3.** Milestones 43 and 45 read sources published per
census tract and block group — CDC PLACES, EPA's Smart Location Database, LODES — and New
Jersey has 2,181 tracts. Giving tracts their own pages would add 21,810 files and breach
the free cap **without expanding a single state**. Aggregate them to municipality; the
warehouse already holds tracts as regions without publishing pages for them. Milestone
37 is the same trap far larger: 3,481,240 parcels as pages would be 174 times the free
cap, so its lookup is served as per-municipality files from R2, which has none.

- **Parcel-level API endpoints and a parcel map layer**, which need the parcel geometry
  Milestone 7 deliberately did not download.
- **A `metro` level**, which several rejected and deferred items would use if one ever
  arrives — single-family rent above all.
