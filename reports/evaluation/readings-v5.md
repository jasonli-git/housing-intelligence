# Readings side by side — readings-v5

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ, Hudson County, NJ, Sussex County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What's changing?*; *What stands out here?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 3 | 159 | 3 | $0.0328 | 28.0 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_154 words · 450 tokens out · 28.5s · $0.0110 · standard_

_Answer 1 refused and sent back for revision:_ jargon: 'income limit' in "…rams. In addition, countywide income limits and rent standards …"; two measures of the same thing: 'Median owner-occupied home value' and 'Home value index, single-family'; keep the one the reading quotes first

**What's changing?** _(3 figures)_

Typical owner-occupied home values rose 33%, give or take 1%, reaching about $623,000, give or take $4,306. Over the same span, the vacancy rate dropped to 3.9%, give or take 0.3 points.

**What stands out here?** _(2 figures)_

Bergen County combines typical owner-occupied home values of $623,000, give or take $4,306, the highest in the state, with an annual property tax bill on a typical home of $12,038. For buyers, purchasing a home pairs the state's highest entry prices with its second-highest local tax obligations. However, these survey estimates carry margins of error that make countywide comparisons less precise.

**What should I check before moving?** _(0 figures)_

A specific home's property tax bill depends on its town's local assessment rather than a single rate on market value, and it does not reflect household relief payments. In addition, countywide low-income thresholds and rent standards apply to the entire region and cannot be divided down to individual municipalities.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_150 words · 428 tokens out · 18.6s · $0.0082 · flex_

_Answer 1 refused and sent back for revision:_ jargon: 'income limit' in "… and cannot show the specific income limits of an individual to…"

**What's changing?** _(3 figures)_

Residential units permitted rose by 94.1% to 1,611 homes. At the same time, the vacancy rate fell to 4.6%, give or take 0.5 points.

**What stands out here?** _(2 figures)_

Mercer County pairs a typical single-family home value of $445,000 with typical rent of $2,513 a month, placing both near the middle of New Jersey's 21 counties. Those figures show housing costs running below the state's most expensive markets for both buyers and renters. Because rent figures rest on a thinner base than home values, the two numbers compare against different groups of peers.

**What should I check before moving?** _(0 figures)_

A specific property's annual tax bill depends on each municipality's local assessment rather than a single countywide rate on market value, and figures shown here omit individual household relief. Income standards apply across the whole county, so these countywide numbers cannot reveal the specific qualifying levels of an individual town.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_143 words · 424 tokens out · 39.3s · $0.0081 · standard_

_Answer 1 refused and sent back for revision:_ two measures of the same thing: 'Renters paying over 30% of income on housing' and 'Renters paying over 30% of income, HUD CHAS'; keep the one the reading quotes first

**What's changing?** _(3 figures)_

The typical home value grew by 35% to $279,277. Meanwhile, the vacancy rate dropped by about 40%, give or take 10%.

**What stands out here?** _(3 figures)_

Cumberland County has the lowest typical home value among New Jersey's 21 counties at $279,277, alongside the lowest typical annual property tax bill of $4,563. This keeps basic costs for buying a home at the bottom of the state ranking. However, a local estimate shows that about 56% of renters, give or take 4 percentage points, still spend over 30% of their income on housing.

**What should I check before moving?** _(0 figures)_

The typical annual property tax bill reflects local assessments rather than a single rate on market value, and it does not show property relief paid directly to individual households. In addition, countywide rent standards cannot show the specific rent amounts used in individual postal areas.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_190 words · 237 tokens out · 3.3s · $0.0028 · flex_

**What's changing?** _(2 figures)_

Typical gross rent rose to $1,894 a month, give or take $17, while residential units permitted dropped 52%. Vacancies also tightened over the period, leaving fewer empty homes across the market.

**What stands out here?** _(0 figures)_

Hudson County has the lowest homeownership rate in New Jersey alongside typical gross rent that ranks near the top of the state. For people looking to live here, this points to a heavily rental-dominated market where finding a home to purchase is comparatively rare and renting takes a substantial commitment. However, consecutive five-year survey estimates share four years of data, so these numbers understate how much the market separated across the period.

**What should I check before moving?** _(0 figures)_

A property tax bill for a specific address depends on each individual municipality's local assessment rather than a uniform tax rate on market value. Furthermore, the overall property tax figures reflect the total bill as originally levied, before any individual household relief programs are applied. Finally, countywide housing figures cannot capture neighborhood differences, as rent standards apply across broad regional areas while local rental voucher programs in some locations depend on specific postal codes instead.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_156 words · 208 tokens out · 50.5s · $0.0026 · flex_

**What's changing?** _(2 figures)_

Typical gross rent climbed to $1,585 a month, give or take $67 a month. Over the same period, the vacancy rate covering all empty homes dropped by 44%, give or take 8%.

**What stands out here?** _(2 figures)_

Sussex County pairs one of the highest homeownership rates among New Jersey's 21 counties, at 83.7% give or take 1%, with an apartment share of residential properties that ranks among the lowest at 0.3%. This leaves the local market heavily dominated by owner-occupied single properties rather than rental buildings. However, the survey estimate for homeownership cannot be separated with certainty from most other counties in the state.

**What should I check before moving?** _(0 figures)_

Property tax figures reflect local assessments within each municipality rather than a uniform rate on market value, so actual bills vary across towns. These numbers also show taxes as originally billed without accounting for state property tax relief programs that reduce costs for qualifying households.
