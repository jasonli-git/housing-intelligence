# Readings side by side — readings-v3

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ, Hudson County, NJ, Sussex County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What's changing?*; *What stands out here?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 3 | 150 | 2 | $0.0455 | 30.1 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_166 words · 232 tokens out · 21.5s · $0.0053 · standard_

**What's changing?** _(2 figures)_

The typical owner-occupied home value rose to $623,000, give or take $4,306. At the same time, the typical gross rent climbed to $1,914 a month, give or take $21 a month.

**What stands out here?** _(0 figures)_

Bergen County has the highest typical owner-occupied home value in the state, while its typical gross rent ranks near the top among New Jersey's 21 counties. For anyone looking to live here, securing a home requires navigating some of the steepest ownership costs and rental rates in the region. However, older five-year survey windows overlap substantially, which can understate how quickly local housing figures are truly separating from earlier baselines.

**What should I check before moving?** _(0 figures)_

Before moving, check the local tax assessments and specific municipal fees for the exact home, as countywide figures reflect overall bill levels before individual household relief. You should also look closely at the specific neighborhood and street, because county-level housing and income standards do not capture block-by-block price variations or localized rent differences.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_162 words · 447 tokens out · 20.1s · $0.0082 · flex_

_Answer 1 refused and sent back for revision:_ 4 figures under 'What's changing?', where at most 3 are allowed

**What's changing?** _(2 figures)_

Residential units permitted grew by 94% over five years. At the same time, typical single-family home values rose by 34%.

**What stands out here?** _(2 figures)_

Mercer County's typical home value sits at $445,000, placing it near the middle of New Jersey's 21 counties, alongside an annual property tax bill of $7,791 for a typical home. For someone buying or renting here, property costs and local taxes align closely with typical levels found across the state. A key limitation is that these property tax bills reflect municipal tax assessments rather than a uniform market rate and exclude state tax relief credits.

**What should I check before moving?** _(0 figures)_

Check the specific municipal assessment and local tax rate for the individual property you are considering, as overall county figures do not capture local assessment differences or household tax relief programs. You should also look at neighborhood-level rent prices, since broader regional rental standards span wide areas and do not reflect specific streets or towns.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_141 words · 188 tokens out · 5.6s · $0.0026 · flex_

**What's changing?** _(2 figures)_

The typical single-family home value rose 35% over five years. At the same time, new residential units permitted increased by 38%.

**What stands out here?** _(1 figure)_

Cumberland County has the lowest typical single-family home value in New Jersey at $279,277, alongside the state's lowest annual property tax bill for a typical home. Buyers and renters encounter lower entry costs and property carrying taxes here than anywhere else across the state's counties. However, home values rest on a single countywide measure that cannot reflect how prices vary across different towns.

**What should I check before moving?** _(0 figures)_

Check the exact municipal property tax assessments and relief programs for a specific address, since actual bills depend on local valuations rather than countywide totals. You should also look closely at neighborhood-level rent and sales listings, because broad regional figures mask conditions on individual blocks.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_144 words · 3,281 tokens out · 35.5s · $0.0217 · standard_

_Answer 1 refused and sent back for revision:_ a survey figure stated without its margin in "…le, the share of empty homes dropped to 6.6%, give or take less than a per…"

**What's changing?** _(2 figures)_

Typical gross rent rose 36% over five years, give or take 2%. Over the same period, residential building permits fell by 52%.

**What stands out here?** _(1 figure)_

Hudson County pairs a homeownership rate of 30.7%, give or take 0.6 points, with typical gross rent that ranks near the top statewide. This means residents find relatively few owner-occupied homes and face some of the highest gross rents in the state. However, these county-level figures cannot show how housing options and rent levels vary across individual neighborhoods.

**What should I check before moving?** _(1 figure)_

You should check tax assessments and relief eligibility for a specific property, since the typical annual property tax bill of $9,174 reflects local assessments before individual state relief is applied. You should also check street-level prices and building conditions, because countywide measures cannot show variations across individual towns or smaller postal areas.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_138 words · 377 tokens out · 67.7s · $0.0077 · flex_

_Answer 1 refused and sent back for revision:_ 4 figures under 'What's changing?', where at most 3 are allowed

**What's changing?** _(2 figures)_

The typical single-family home value rose 34% over roughly five years. Over that same period, residential units permitted dropped 20%.

**What stands out here?** _(2 figures)_

Sussex County pairs an 84% homeownership rate, give or take 1%, with an apartment share of residential properties of just 0.3%. For anyone looking to live here, this means the local housing supply consists almost entirely of owned homes rather than rental buildings. A key limitation is that these countywide figures do not show how available rentals or home prices differ across individual towns.

**What should I check before moving?** _(0 figures)_

You should check local tax rates, because the typical annual property tax bill reflects town-level assessments before any individual state relief programs are applied. You will also want to investigate prices on specific blocks, as these countywide figures smooth out neighborhood differences.
