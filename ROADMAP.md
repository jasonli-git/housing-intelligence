# Housing Intelligence Platform — Roadmap

**Version 1 is complete — all ten milestones shipped.** The warehouse holds a NJ
geography spine, 335,927 observations across 23 metrics from 10 sources spanning
1971–2026, 19,531 computed changes, and 19,521 change plus 8,302 value rankings — served
over the API, displayed by the dashboard, and packaged as versioned analysis packets,
with 289 Python and 26 dashboard tests passing. All eight pipeline stages run.

**Version 2 is under way — Milestones 10, 11, 12, 19, 22, 20 and 21 have shipped,
between 2026-09-02 and 2026-09-11.** The platform is published: New Jersey is served from
a public domain with no database and no application server, and its interpretation is
written by hosted models behind a preference list that ends on this machine. What
remains is depth in New Jersey — citation binding, a re-benchmark, a design language, a
three-dimensional map and a consumer entry point; expansion past New Jersey was deferred
on 2026-09-07. Everything it runs on — the warehouse schema, the
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

**Milestones 10, 11, 12, 19, 22, 20 and 21 closed, between 2026-09-02 and 2026-09-11.**
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
| 13 | ⬜ planned | **Citation binding** — every figure in an interpretation resolved to the packet field, source release, period, and match method that licensed it, produced inside `hip explain`, with the same ground-truth index reused by the evaluation report |
| 14 | ⏸ deferred to Post-V2 | **Northeast expansion** — CT, MA, ME, NH, NY, PA, RI, VT loaded at all five levels, the first run of the pipeline at roughly seven times current volume, and a per-state coverage report showing what each source did and did not resolve |
| 15 | ⏸ deferred to Post-V2 | **National county coverage** — all 50 states, DC, and PR at `state` and `county` level only, on federal sources that key on exact FIPS, giving national coverage without a national municipality model |
| 16 | ⬜ planned | **Three-dimensional map, New Jersey** — 564 municipalities extruded by a magnitude metric and colored by a ratio metric, replacing the inline-SVG map as the landing view; selection shown by highlight-and-mute, where chosen regions keep full colour and gain a contrasting outline while every other region drops to a neutral it cannot be confused with; a legend that states what height and colour each encode, since a two-channel map does not explain itself |
| 17 | ⬜ planned | **Consumer entry point** — three views that answer a decision rather than report a figure: **"what can I afford here"**, taking an income and returning the places within reach, inverting `price_to_income` and `price_to_ami` into the question people actually ask; **a verdict sentence** on every region page, turning "$791,116, rank 17 of 21" into "more expensive than 16 of New Jersey's 21 counties, and rising more slowly than most", computed from rank and percentile with no model involved; and **the tradeoff named**, pairing a cheaper home value against the higher property taxes MOD-IV already records or the migration flows IRS already supplies, because every real housing decision is a trade and reporting one side of it is half an answer. Plus search disambiguated by county and legal type — ZIP is many-to-many and cannot label a result — over the `name_lsad` column loaded in 2026-09-05 |
| 18 | ⬜ planned | **Design system and identity** — a typeface pairing and a wordmark replacing the system font stack, the interaction and focus states the stylesheet currently declares none of, metric and window chosen by the reader rather than fixed as module constants, a named component layer replacing per-page inline grids, an inline glossary so `ZHVI` and `price_to_ami` are defined where they appear, and caveats placed beside the figure they qualify rather than collected at the foot of the report. Built before 16 and 17 |
| 19 | ✅ done | **Multi-model interpretation** — every county page carries all five benchmarked models' readings of the same packet, switchable by the reader and each attributed to the model and provider that wrote it. `region_explanations` gains `model_id` in its primary key and a `rank` column carrying preference-list position, because `API_MAY_IMPORT` forbids the API reading config to order them; `/regions/{id}/explanation` keeps its shape and a new `/regions/{id}/explanations` returns all five. Built out of numeric order, before 13-18, because the benchmark data is fresh and the content costs $0.86 to generate today. It is also the reachable subset of Post-Version 2's bring-your-own-model comparison, whose blockers were a missing server and a paid judge — neither of which a pre-generated artifact needs |
| 20 | ✅ done | **Reasoning effort as a measured variable** — `reasoning_effort` on `CandidateModel` (`default`, `disabled`, `low`), sent in each provider's own shape and recorded on every generation, so a configuration is a candidate rather than a hidden default; `default` sends nothing, leaving every `v2` request byte-identical. One id is one configuration: a resume under a changed setting is refused, two ids for one configuration fail `hip check-config`, and `hip explain` skips a model configured at an effort its benchmark did not measure. `deepseek-flash-nothink` and `gemini-3.7-flash-low` are configured for `v3`, and the evaluation report states the effort behind every figure. Planned as thinking-disabled variants of both; Gemini 3.7 Flash refuses its documented floor, `minimal`, and offers no off switch, so its variant is `low`. Measured on one county packet: thinking off cut DeepSeek V4.1 Flash from 5,693 output tokens to 512 for an answer of the same length, and `low` cut Gemini 3.7 Flash from 2,655 to 565. Runs no benchmark — the variants are measured in `v3` |
| 21 | ✅ done | **New Jersey depth: the sources still missing** — HUD Fair Market Rents and HUD CHAS as two new sources on the token already in `.env`, ACS tenure and vacancy (B25003, B25002), FHFA's all-transactions index, and Census Building Permits at place level: eight metrics and 13,638 observations. Every county carries a Fair Market Rent and `fmr_to_income` against it (21 counties, where the Zillow-based ratio reached 19); every county and municipality an ownership and a vacancy rate, the first the warehouse has held; 21 counties and 563 of 564 municipalities CHAS owner, renter and severe cost burden; every municipality a permits series, resolved by FIPS MCD code and summing to the county totals exactly. `NJSTHPI` came from FHFA's own master file, already fetched, rather than FRED; the ACS tables got their own layers because the raw cache keys on the layer, not the URL; and HUD's 60-a-minute limit made download pacing a shared adapter setting (ARCHITECTURE #106–#111). A county packet is about a third larger. |
| 22 | ✅ done | **DeepSeek migration and substitution detection** — DeepSeek retires models by *routing* them: `deepseek-v4-flash` already returns answers from `deepseek-flash` with HTTP 200, and `deepseek-v4-pro` follows at 04:00 UTC on 2026-09-14. A routed pin never fails, so SPEC's fall-through never fires and a regeneration would store the retired model's name against another model's prose. Every hosted response now has its served model checked against the requested ref, a mismatch is a recorded substitution, and `hip explain` probes hosted tiers so a withdrawn or routed pin genuinely falls through — which, it turned out, it never had. `deepseek-flash` joins as an unbenchmarked candidate; the benchmark itself waits for 21, 13 and 20. Scheduled ahead of 13 because of the vendor date |

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
rank of 17 of 21 means nothing until you know whether 1 is good. The three views in that
row are deliberately deterministic — every one is computed from rank, percentile, and
metrics the warehouse already holds, with no model and no new source — because the
interpretation people need most is the interpretation least safe to generate. A verdict
sentence that is wrong is worse than a table that is merely unhelpful, and a sentence
derived from a percentile cannot be wrong in the way generated prose can.

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
benchmark, then 18, 16, 17 — see below.

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
  decision listed under Post-Version 2, and `config/geography.yml` already warns that
  the identifier system is expensive to change once fact rows reference it.
- **Parcel and MOD-IV coverage does not generalize.** There is no free national parcel
  dataset; every state publishes its own format under its own license. The 3.48M NJ
  parcels stay a single-state depth layer, and no Version 2 milestone extends them.
- **Zillow is licensed for non-commercial use with attribution.** Public hosting as a
  portfolio piece is within that; monetizing the result is not.
- **Cloudflare Pages caps files per deployment.** Milestone 11 must confirm the current
  limit before choosing between one rendered file per region and a queryable data layer
  for the long tail. At national municipality scale the per-region approach does not
  fit, which is a constraint on the artifact layout rather than on the schedule.

## Post-Version 2 (not scheduled)

Citation binding, evidence references in the evaluation report, Northeast expansion,
automated monthly reports, and the publicly hosted analytics API have moved into the
Version 2 table above. What remains unscheduled:

- **Geography model for non-MCD states** — whether `place` becomes a sixth level
  alongside `municipality`, whether the identifier system is chosen per state in
  `config/geography.yml`, or whether municipality-level analysis simply stops at the
  strong-MCD states. The schema change is small — a `region_level` enum value and a
  config key — and the migration is not, because `region_id` is referenced by every
  fact row. Needs deciding before any expansion past Milestone 14, not before.
- **State expansion past the Northeast**, in strong-MCD order — WI, MI, MN, ND, SD
  extend Milestone 14 with no geography change at all; everything else waits on the
  entry above.
- **Bring-your-own-model comparison** — let a visitor point the platform at a local
  model of their own and see it answer the same scenarios the hosted one does, scored
  the same way. Every piece already exists and none of it is currently public: the five
  standardized scenarios, the deterministic figure-checking that counts fabrication
  rather than grading it, the rubric, and the `ModelRunner` protocol that made eight
  candidates interchangeable in the first place. Milestone 12 adds a hosted
  implementation of that protocol; this exposes the harness behind it. Two things make
  it harder than it sounds and are the reason it is unscheduled rather than queued: the
  platform is published as static artifacts with no server to run anything
  (Milestone 11), so the model call has to happen in the visitor's own browser or against
  their own endpoint, and the rubric half needs a judge, which is a paid API call the
  visitor would have to supply a key for. The deterministic half needs neither and is
  the honest place to start — fabrication rate against a real packet is a complete
  answer on its own, and it is the number Milestone 8 treated as the eligibility gate.
- **Climate and flood-risk overlays** — the highest consumer value of anything on this
  list, and FEMA's National Flood Hazard Layer is free. Held back only because it adds
  a source family with different geometry semantics than any current source.
- **Model-comparison dashboard driven by the Milestone 8 evaluation results** — the
  data already exists in `data/eval/v1`, so this is a presentation milestone whose cost
  is close to zero. A natural companion to Milestone 16 rather than a milestone of its
  own.
- **Scheduled refresh with retry and alerting, replacing manual `make pipeline`** —
  becomes necessary rather than convenient once a published site is expected to reflect
  a monthly cadence. Deferred because a manual run is honest at one state and
  misleading only at scale. (Earlier versions of this list said `hip refresh`; no such
  command exists — the eight stages are invoked individually or through
  `make pipeline`.) Its prose step already reports what alerting needs: `hip explain`
  exits 0, 3 or 1 for all, some or none of the requested prose current, and the numbers
  should deploy whichever it is (ARCHITECTURE #102).
- **Parcel-level API endpoints and a parcel map layer**, which need the parcel geometry
  Milestone 7 deliberately did not download
- **MOD-IV equalization ratios** so assessed values approximate market values
- **Migration-driven demand analysis**
- **Interpretation that relates metrics rather than listing them** — from a brainstorm
  on 2026-09-11 that split interpretation into four functions: say what each metric
  means, relate metrics to one another, name the tradeoffs, and synthesise. The framing
  is right, but here most of it should not be a model's job. What a metric means is
  Milestone 17's verdict sentence, computed from rank and percentile. Tradeoffs are
  Milestone 17's "tradeoff named", and only mean something against a decision, so they
  stay in the consumer views. Relationships are the hard part, and the answer is to
  compute them: a section of relationship facts in the packet, drawn from a closed set of
  relation types — "values rose 30% while incomes rose 12%, so price-to-income moved from
  3.1 to 3.8" — which Milestone 13's citation binding extends to, so a model can narrate
  only a relationship that exists as a fact. Synthesis stays one generation with fixed
  sections in its output: completeness and caveat handling are the weakest rubric
  criteria for every model measured so far, and a structure is something the harness can
  test. The system prompt already forbids causes the packet does not support, and
  nothing measures it; a check for causal wording ("because", "driven by", "due to") not
  backed by a relationship fact belongs in the evaluation before any of this ships. Not
  as four chained model calls, one per function: that multiplies cost and latency, and an
  unsupported claim from the relating step becomes evidence for the synthesis step,
  where the evaluation can no longer see where it came from. Needs Milestone 13 first.
- **Historical persistence facts** — the descriptive answer to "is this affordability
  pressure temporary or persistent?", which is the question a forecast would be asked to
  answer. How far a region's price-to-income sits above its own long-run range, and how
  long past episodes that far above it lasted: "the highest since 2006; the last time it
  was this high, it took N years to return to the median". Computed, sourced to the
  releases behind every point, and forward-looking without claiming to know the future —
  the argument that already makes a five-year change and an annualised rate the honest
  cheap version. Most of a forecast's consumer value at none of its provenance cost. The
  constraint is history: the FHFA index Milestone 21 adds reaches back decades, the
  income side of the ratio does not, and a range is only as long as its shorter series —
  which the fact has to state.
- **Affordability forecasting** — listed in SPEC's long-term direction and deliberately
  left unscheduled. Every other output the platform publishes is measured and traceable
  to a source release; a forecast would be the only one that is neither, on a site whose
  entire claim is provenance. If it is built, it needs its own accuracy evaluation in
  the same way the interpretation layer got one, and that is a milestone rather than a
  feature. The shape from the 2026-09-11 brainstorm is the right one: a separate module
  that produces evidence — direction, magnitude, horizon, interval, assumptions — for the
  interpretation layer to read beside history, and never something a model does. Four
  conditions come with it. It beats naive baselines — no change, and a straight-line
  trend — on held-out history, or it does not publish. Its confidence is an interval
  whose coverage the backtest measured, never a label, because a model reading
  "confidence: high" will say it more strongly than it should. It states the lag it
  inherits: the income side of price-to-income is ACS 5-year estimates, which overlap by
  four years and trail their release, so today's ratio already pairs current prices with
  incomes from years earlier, and a projection compounds that. And "temporary or
  persistent" is computed by the module, not concluded by a model. It comes after the
  persistence facts above, which answer the same question without predicting.
