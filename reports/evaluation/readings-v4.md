# Readings side by side — readings-v4

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ, Hudson County, NJ, Sussex County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What's changing?*; *What stands out here?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 4 | 158 | 3 | $0.0356 | 29.5 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_154 words · 429 tokens out · 40.9s · $0.0110 · standard_

_Answer 1 refused and sent back for revision:_ two measures of the same thing: 'Typical sale price, recent transactions' and 'Home value index, single-family'; keep the one the reading quotes first

**What's changing?** _(2 figures)_

The typical single-family home value rose to $787,000, while typical rent reached $2,899 a month. The share of empty homes dropped over the period.

**What stands out here?** _(2 figures)_

Bergen County has a typical single-family home value of $787,000 that sits among the highest in the state, paired with an annual property tax bill for a typical home of $12,038 that also ranks among the highest. Buyers face some of the highest ownership costs in the region, while renters also encounter typical rents that rank near the highest. The figures reflect countywide patterns rather than local variations, because municipal assessment rules differ across towns.

**What should I check before moving?** _(0 figures)_

The typical property tax bill shown is measured before individual relief, so the bill for an address is the one its municipality levies. Rent measures cover far fewer properties than home value measures do, so local listings describe a specific street more accurately.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_170 words · 469 tokens out · 33.6s · $0.0085 · standard_

_Answer 1 refused and sent back for revision:_ jargon: 'income limit' in "…ages. Figures based on county income limits cannot be broken do…"

**What's changing?** _(3 figures)_

Residential units permitted rose by 94% to 1,611 over five years. At the same time, the vacancy rate dropped to 4.6%, give or take 1%.

**What stands out here?** _(2 figures)_

Mercer County sits near the middle of New Jersey's 21 counties for typical home value, at $445,078, while its homeownership rate ranks seventeenth at 62.2%, give or take 1.1 points. That combination reflects a housing market where buying remains less common than across most of the state despite mid-tier property prices. However, these survey estimates carry broad ranges that make precise comparisons with other counties difficult.

**What should I check before moving?** _(0 figures)_

The property tax bill shown is a typical countywide figure before household relief, so the bill for a specific address is the one its own town levies. Rents here draw on fewer homes than home values do, so local listings describe a particular street better than county averages. County qualifying standards cannot be broken down to the town level, so local guidelines are set by each municipality.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_146 words · 416 tokens out · 28.3s · $0.0081 · standard_

_Answer 1 refused and sent back for revision:_ 4 figures under 'What's changing?', where at most 3 are allowed

**What's changing?** _(2 figures)_

The typical single-family home value rose to $279,277 over five years. Meanwhile, residential units permitted grew by 38%.

**What stands out here?** _(2 figures)_

Cumberland County pairs New Jersey's lowest typical single-family home value of $279,277 with its lowest annual property tax bill for a typical home at $4,563. For someone buying here, purchase prices and tax bills sit at the lowest levels among the state's counties. However, rent figures here rest on a much smaller base than home values do, making local rental market estimates less complete.

**What should I check before moving?** _(0 figures)_

The property tax bill shown is a typical one before individual relief, so the bill for an address is the one its town levies based on local assessments. Because income standards are calculated for the whole county, they cannot be broken down to show the specific income levels of a single town.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_160 words · 205 tokens out · 7.0s · $0.0027 · flex_

**What's changing?** _(2 figures)_

Residential units permitted dropped by 52% over five years. At the same time, the typical gross rent climbed by 36%, give or take 2%.

**What stands out here?** _(2 figures)_

Hudson County pairs the lowest homeownership rate in the state at about 31%, give or take 1%, with the highest share of residential properties that are apartments at 4%. This leaves most residents renting in multifamily buildings rather than owning single-family homes. However, consecutive five-year survey estimates share four years of data, which narrows the visible differences between them over time.

**What should I check before moving?** _(0 figures)_

The property tax bill reflects a typical one to four family home before relief programs, while the exact bill is set by each municipality's assessments. Standard income thresholds cover the entire county, so local town guidelines show what applies to a specific community. Rents draw on a smaller base of properties than home values, meaning neighborhood listings reveal more about an individual street.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_160 words · 418 tokens out · 37.5s · $0.0054 · flex_

_Answer 1 refused and sent back for revision:_ jargon: 'parcel' in "…1 counties with a residential parcel share of apartments…"; 'What stands out here?' quotes 'Total population', which is not a housing measure

**What's changing?** _(2 figures)_

The typical single-family home value rose to $449,637, for which no margin is available. At the same time, the number of residential units permitted fell to 181, which also has no sampling error.

**What stands out here?** _(0 figures)_

Sussex County pairs a homeownership rate that ranks among the highest across New Jersey's 21 counties with an apartment share of residential properties that sits toward the bottom. That pattern reflects a housing market oriented heavily toward owned single homes rather than multifamily rentals. However, earlier survey estimates overlap across five-year spans, so comparisons over shorter windows understate the real separation over time.

**What should I check before moving?** _(0 figures)_

The property tax bill is a typical figure calculated before relief payments, so the exact amount for an address is the one set by its specific municipality. Rents for the region rest on fewer properties than home values do, so local listings provide a clearer look at pricing on a given street.
