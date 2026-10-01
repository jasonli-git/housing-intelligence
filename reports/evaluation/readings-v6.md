# Readings side by side — readings-v6

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ, Hudson County, NJ, Sussex County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What's changing?*; *What stands out here?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 0 | 163 | 3 | $0.0163 | 10.4 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_176 words · 249 tokens out · 5.6s · $0.0028 · flex_

**What's changing?** _(2 figures)_

The typical rent rose to $1,914 a month, give or take $21. At the same time, the vacancy rate, which counts every empty home, fell by 22%, give or take 7%.

**What stands out here?** _(2 figures)_

Bergen County has the highest typical owner-occupied home value among New Jersey's 21 counties at about $623,000, give or take $4,306, while carrying the second-highest typical annual property tax bill at $12,038. For buyers, acquiring a home means facing the state's highest home values along with its near-highest local tax bills. However, the countywide property tax figure captures what was billed rather than what remains after state relief programs reduce payments.

**What should I check before moving?** _(0 figures)_

The overall property tax figure cannot show what an individual address owes because tax bills follow each municipality's local assessments rather than a single market rate, and they do not reflect household relief programs. In addition, countywide rent figures cannot pinpoint costs for a specific street or town because local rental listings depend on a smaller pool of homes across differing neighborhoods.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_171 words · 251 tokens out · 6.6s · $0.0028 · flex_

**What's changing?** _(3 figures)_

Residential units permitted grew by 94% over the five-year window, reaching 1,611 homes. At the same time, the vacancy rate dropped significantly to 4.6%, give or take 0.5%.

**What stands out here?** _(2 figures)_

Mercer County sits seventeenth among New Jersey's 21 counties for its homeownership rate of 62.2%, give or take 1.1 points, while 50.1% of its renters spend over 30% of their income on housing, give or take 2.3 points. This shows that residents face a relatively high rental burden alongside homeownership levels that rank among the lowest in the state. However, because these survey estimates come from five-year samples that overlap across time, the measured trends understate the true year-to-year changes.

**What should I check before moving?** _(0 figures)_

The typical annual property tax bill reflects municipal tax levies before individual relief programs are applied, and bills depend on each town's specific assessments rather than a uniform rate across the county. In addition, standard rental figures represent broad area averages rather than the neighborhood-level voucher limits used across certain communities.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_172 words · 237 tokens out · 28.8s · $0.0054 · standard_

**What's changing?** _(2 figures)_

Typical rent rose to about $1,282 a month, give or take $38, while the typical owner-occupied home value increased to about $221,400, give or take $4,674. Both costs have grown substantially over the five-year period.

**What stands out here?** _(1 figure)_

Cumberland County has the lowest typical owner-occupied home value among New Jersey's 21 counties, alongside an annual property tax bill for a typical home that is also the lowest at $4,563. For anyone looking to live here, buying a home involves lower prices and property taxes than anywhere else in the state. However, the countywide property tax figure reflects overall patterns rather than individual town rates.

**What should I check before moving?** _(0 figures)_

A property tax bill for a specific home depends on each town's local assessment rather than a single countywide rate, and it does not account for state relief programs that individual households might receive. In addition, rent measures for the county draw from a smaller pool of local listings, which can obscure what apartments actually cost across different neighborhoods.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_147 words · 207 tokens out · 4.3s · $0.0027 · flex_

**What's changing?** _(3 figures)_

Residential units permitted dropped by 52.0% over five years. At the same time, typical gross rent rose by 36%—give or take 2%—to $1,894 a month, with a margin of $17.

**What stands out here?** _(1 figure)_

Hudson County has the lowest homeownership rate among New Jersey's 21 counties at 30.7%, give or take 1%, alongside rents that rank among the highest. For residents, this means housing is overwhelmingly renter-dominated while monthly housing payments take up a particularly large share of household budgets. However, rent measures only capture what existing tenants pay rather than what open rentals currently demand across all neighborhoods.

**What should I check before moving?** _(0 figures)_

Property tax figures cannot show what a specific home will cost because bills follow each municipality's separate local assessments and exclude individual household relief programs. County-level housing prices and rents also mask wide differences across individual neighborhoods and building types.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_147 words · 205 tokens out · 6.5s · $0.0026 · flex_

**What's changing?** _(2 figures)_

The typical single-family home value rose to $450,000. Over the same general period, residential units permitted fell to 181.

**What stands out here?** _(2 figures)_

Sussex County has a homeownership rate of about 84%, give or take 1%, which is among the highest in New Jersey, while its typical home value is $450,000. These figures describe an ownership-dominated market where most households own rather than rent and where housing costs sit near the middle of the state's range. However, this pattern leaves out differences across towns, and the rent measures rest on a much smaller base than the home-value figures.

**What should I check before moving?** _(0 figures)_

A typical property tax bill reflects municipal tax assessments rather than a uniform market rate, and it excludes individual state relief credits. Actual rents and single-family prices also vary widely because regional numbers cannot capture neighborhood-specific stock or municipal assessment variations.
