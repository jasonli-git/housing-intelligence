# Stories register

<!-- Generated from web/lib/storyRegister.ts by `cd web && npm run stories:register`. Edit that file, not this one. -->

Every visual story, where it appears and how its sources stood when last reviewed.
Decisions about how the stories are built are in [ARCHITECTURE.md](ARCHITECTURE.md);
open work is in [TODO.md](TODO.md), and ideas here are not decided.

## All stories (42)

| Story | Where it appears | Share image | Status | Reviewed |
|---|---|---|---|---|
| [Health in context](../web/app/stories/health-in-context/page.tsx) | place pages | none (no chart until a place is picked) | not yet reviewed | — |
| [Sites and cleanup](../web/app/stories/sites-and-cleanup/page.tsx) | place pages | none (no chart until a place is picked) | not yet reviewed | — |
| [When the power goes out](../web/app/stories/when-the-power-goes-out/page.tsx) | place pages | none (no chart until a place is picked) | not yet reviewed | — |
| [Where internet reaches](../web/app/stories/where-internet-reaches/page.tsx) | place pages | none (no chart until a place is picked) | not yet reviewed | — |
| [Where students go](../web/app/stories/where-students-go/page.tsx) | place pages | none (no chart until a place is picked) | not yet reviewed | — |
| [Who feels housing costs most?](../web/app/stories/who-feels-housing-costs/page.tsx) | place pages | yes | not yet reviewed | — |
| [What goes with pricier towns](../web/app/stories/pricier-towns/page.tsx) | editor's pick, What your money buys | yes | live | 2026-11-06 |
| [The price ladder](../web/app/stories/price-ladder/page.tsx) | place pages | yes | not yet reviewed | — |
| [Priciest and cheapest in each county](../web/app/stories/priciest-and-cheapest/page.tsx) | place pages | yes | not yet reviewed | — |
| [Income against home value](../web/app/stories/income-and-home-value/page.tsx) | place pages | yes | not yet reviewed | — |
| [Who’s moving in](../web/app/stories/who-moves-in/page.tsx) | place pages | yes | not yet reviewed | — |
| [Where the workday goes](../web/app/stories/where-the-workday-goes/page.tsx) | place pages | yes | not yet reviewed | — |
| [Is New Jersey building?](../web/app/stories/is-new-jersey-building/page.tsx) | place pages | yes | not yet reviewed | — |
| [What the housing is](../web/app/stories/what-the-housing-is/page.tsx) | place pages | yes | not yet reviewed | — |
| [The true monthly cost](../web/app/stories/the-true-monthly-cost/page.tsx) | place pages | yes | not yet reviewed | — |
| [Same house, different tax bill](../web/app/stories/same-house-different-tax-bill/page.tsx) | place pages | yes | not yet reviewed | — |
| [The mortgage market](../web/app/stories/the-mortgage-market/page.tsx) | place pages | yes | not yet reviewed | — |
| [Water you can check](../web/app/stories/water-you-can-check/page.tsx) | place pages | yes | not yet reviewed | — |
| [Is today unusual here?](../web/app/stories/is-today-unusual/page.tsx) | place pages | yes | not yet reviewed | — |
| [What’s in a name?](../web/app/stories/whats-in-a-name/page.tsx) | Only in New Jersey | yes | not yet reviewed | — |
| [The long commute premium](../web/app/stories/the-long-commute-premium/page.tsx) | What your money buys | yes | not yet reviewed | — |
| [What a house buys in land](../web/app/stories/what-a-house-buys-in-land/page.tsx) | place pages | yes | not yet reviewed | — |
| [Your town's time machine](../web/app/stories/your-towns-time-machine/page.tsx) | place pages | yes | not yet reviewed | — |
| [The winter-empty Shore](../web/app/stories/the-winter-empty-shore/page.tsx) | place pages | yes | not yet reviewed | — |
| [The Wawa line](../web/app/stories/the-wawa-line/page.tsx) | featured, Only in New Jersey | yes | live | 2026-11-03 |
| [The Starbucks index](../web/app/stories/the-starbucks-index/page.tsx) | Only in New Jersey | yes | live | 2026-11-03 |
| [Diner capital](../web/app/stories/diner-capital/page.tsx) | Only in New Jersey | yes | not yet reviewed | — |
| [The leafy premium](../web/app/stories/the-leafy-premium/page.tsx) | The feel of a place | yes | not yet reviewed | — |
| [Court, Circle, Lane](../web/app/stories/court-circle-lane/page.tsx) | Only in New Jersey | yes | not yet reviewed | — |
| [Living higher](../web/app/stories/living-higher/page.tsx) | The feel of a place | yes | not yet reviewed | — |
| [What quiet costs](../web/app/stories/what-quiet-costs/page.tsx) | The feel of a place | yes | not yet reviewed | — |
| [Where you can see the stars](../web/app/stories/where-you-can-see-the-stars/page.tsx) | editor's pick, The feel of a place | yes | live | 2026-11-06 |
| [How data gets rewritten](../web/app/stories/how-data-gets-rewritten/page.tsx) | place pages | yes | not yet reviewed | — |
| [Boroughitis](../web/app/stories/boroughitis/page.tsx) | editor's pick, Only in New Jersey | yes | live | 2026-11-06 |
| [The flood claims calendar](../web/app/stories/the-flood-claims-calendar/page.tsx) | editor's pick, The feel of a place | yes | live | 2026-11-06 |
| [How long homes sit](../web/app/stories/how-long-homes-sit/page.tsx) | place pages | yes | not yet reviewed | — |
| [When the town was built](../web/app/stories/when-the-town-was-built/page.tsx) | editor's pick, The feel of a place | yes | live | 2026-11-06 |
| [How big the houses really are](../web/app/stories/how-big-the-houses-are/page.tsx) | The feel of a place | yes | not yet reviewed | — |
| [Pavement or lawn](../web/app/stories/pavement-or-lawn/page.tsx) | The feel of a place | yes | not yet reviewed | — |
| [The hottest counties](../web/app/stories/the-hottest-counties/page.tsx) | place pages | yes | not yet reviewed | — |
| [The pizza–bagel line](../web/app/stories/the-pizza-bagel-line/page.tsx) | Only in New Jersey | yes | live | 2026-11-03 |
| [Hometown famous](../web/app/stories/hometown-famous/page.tsx) | Only in New Jersey | yes | live | 2026-11-03 |

## Reviews

### What goes with pricier towns

Reviewed 2026-11-06 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `zillow_zhvi` | typical home value, each town against towns in its county | through September 2026 | 388 of 564 towns have a value |
| `census_acs` | work from home, owners, detached, long commutes, old housing, transit, renter strain, big buildings | 2020–2024 ACS | — |
| `census_lodes` | share of residents' jobs in New York City | 2023 | — |
| `bts_ntm` | homes within reach of a rail station | current stops | — |
| `nj_tax_rates` | the Director's Ratio (assessments overdue) | 2025, published 2026-03-11 | — |
| `fema_nfhl` | share of homes in a flood zone | fetched 2026-10-03 | 369 of the 388 towns |
| `epa_sdwis` | homes on a water system with a health-based violation since 2015 | fetched 2026-10-03 | — |
| `njdep_kcsl` | open contaminated sites | fetched 2026-10-30 | — |

**Issues**

- No uncertainty is shown, and three traits rest on small groups: near a train 24 towns (+15%), transit commuters 30 (−5%), big apartment buildings 37 (−17%). The Wawa line shows a 95% range for the same reason (ARCHITECTURE #472).
- "Contaminated sites" counts sites, not sites per home, so it partly measures a town's size; its priciest examples are Franklin Lakes, Summit and Colts Neck.
- "Many work from home" (+47%) largely stands in for income and occupation; the note's "goes with, does not make" covers it, but it leads the chart.

**Ideas** (not decided)

- Show each premium's range, or drop traits under about 50 towns; count contaminated sites per 1,000 homes.

### The Wawa line

Reviewed 2026-11-03 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `overture_places` | Wawa and QuickChek stores by town (from 2026-11-03) | release 2026-10-21.0, fetched 2026-11-03 | Wawa 292 of about 298 (~98%); QuickChek 112 of about 145 (~77%, stores only All the Places lists left out) |
| `zillow_zhvi` | typical home value, each town against its county | through September 2026 | — |

**Issues**

- The price comparison rests on 23 Wawa-only and 26 QuickChek-only towns: a −4.8% gap with a 95% range of −22% to +16%, so the takeaway calls them alike (ARCHITECTURE #472).

**Ideas** (not decided)

- Before 2026-11-03 it read OpenStreetMap: 261 Wawas (~88%) and 118 QuickCheks (~81%), a −2% gap across 10 counties.

### The Starbucks index

Reviewed 2026-11-03 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `overture_places` | 13 chains and kinds of place by town (Milestone 60; list widened 2026-11-03) | release 2026-10-21.0, fetched 2026-11-03 | Starbucks 294 of about 345 (~85%); Dunkin' 810 of about 860 (~94%); Wawa 292 of about 298; QuickChek 112 of about 145 (~77%, stores only All the Places lists left out); Wegmans 11 of 11. Against Census County Business Patterns 2023 by county (checked 2026-11-03): laundromats 924 to 586 coin laundries, counties correlating 0.97; golf courses 316 to 199 golf courses and country clubs, 0.76; yoga studios 655 to 1,495 fitness centres of every kind, 0.91. The Census counts only businesses with paid staff and leaves out public courses, so Overture's higher counts are expected. Tennis courts and pawn shops have no matching Census industry and are unchecked |
| `zillow_zhvi` | typical home value, each town against its county | through September 2026 | — |

**Issues**

- A category is Overture's own: a public park's tennis courts count as tennis courts, and a pawn shop includes gold buyers (sampled 2026-11-03).

**Ideas** (not decided)

- Before 2026-11-03 the bubbles were 8 chains with groups as small as 13 towns; the list now holds 13 kinds of place, each in 25 to two in three of the towns (ARCHITECTURE #471).
- Before Milestone 60 it read OpenStreetMap (Starbucks ~69%, Dunkin' ~74%): more Starbucks than Dunkin' +25%, a Starbucks +5%, a Dunkin' −15%; on Overture +34%, +0% and −17%.

### Where you can see the stars

Reviewed 2026-11-06 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `eog_vnl` | night-time radiance over each town's homes | 2024 annual composite, fetched 2026-10-22 | about 460 m pixels, weighted by each census block's homes |
| `zillow_zhvi` | typical home value, each town against its county | through September 2026 | — |

**Issues**

- Radiance seen from orbit stands in for sky darkness, as the note says; the darkest towns are also the most rural, with bigger lots, so "+6% each time the glow halves" carries land and quiet with it.
- `eog_vnl` is not tracked for new releases (freshness status not_tracked); the 2025 composite will not be noticed.

### Boroughitis

Reviewed 2026-11-06 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `nj_civil_boundaries` | the year each town became its present kind of municipality | Bulletin 67 (1969), fetched 2026-11-06 | 536 of 564 towns; 244 of 252 boroughs |
| `wikidata` | inception, for a town the book does not date | queried 2026-10-23 | — |

**Issues**

- Towns the book does not date fall back to Wikidata, which can hold a settlement date: Princeton (consolidated 2013) is drawn at 1699 and Verona at 1701. Essex's towns that became townships after 1968 have no book entry under today's type.
- The scan's OCR misreads some headings and years; a misread year is left to Wikidata, not guessed.

**Ideas** (not decided)

- Fixed 2026-11-06 (ARCHITECTURE #476): on Wikidata alone, 9 boroughs were drawn before 1850 (Runnemede 1625, Chatham 1709) and the headline read 48 of 181 boroughs (27%) in the 1890s; with Snyder first it is 76 of 250 (30%), and 34 towns in 1894.

### The flood claims calendar

Reviewed 2026-11-06 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `fema_nfip_claims` | claims with anything paid, by day of loss, statewide | fetched 2026-10-03 | 169,093 claims, 1978 to 2026 |

**Issues**

- 2026 is a part year (83 claims) and claims arrive months after a loss, so the latest year reads darker than it will be.
- Fewer homes were insured before the 1990s, as the note says, so early years understate their floods.

### When the town was built

Reviewed 2026-11-06 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `nj_modiv` | one-to-four-family houses (class 2) by year built, counted by decade | 2024 tax list, published 2025-09-11 | — |

**Issues**

- Class 2 leaves out apartment buildings, so Hudson's and Essex's ridges count only their houses; the note says houses throughout.
- An assessor's year for an old house is often an estimate, and only standing houses are counted; the note says both.

### The pizza–bagel line

Reviewed 2026-11-03 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `overture_places` | pizzerias and bagel shops by town (Milestone 60) | release 2026-10-21.0, fetched 2026-11-03 | 2,696 pizzerias of about 2,700–2,900 (~95%); 737 bagel shops, in 319 towns |

**Issues**

- The southernmost band (Cape May) rests on 8 bagel shops, so its own ratio is noisy; the headline compares the three northern and three southern bands.

**Ideas** (not decided)

- Before Milestone 60 it read OpenStreetMap: 1,086 pizzerias (~40%) and 278 bagel shops in 177 towns, north 3.1 against south 7.5 pizzerias per bagel shop; on Overture, 3.1 against 6.0.

### Hometown famous

Reviewed 2026-11-03 · live

| Source | Used for | As of | Coverage |
|---|---|---|---|
| `wikidata` | people recorded as born in each municipality, and how widely known | queried 2026-10-23 | — |
| `census_acs` | today's population, the denominator | 2018–2022 ACS | — |

**Issues**

- Notability follows Wikidata's editors, who record athletes and performers more fully than others; a hospital town gathers births from its area.

**Ideas** (not decided)

- Pantheon (MIT) is curated but older, smaller and of unclear data licence; Wikidata stays the source, refreshed monthly.
