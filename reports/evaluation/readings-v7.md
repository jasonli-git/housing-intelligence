# Readings side by side — readings-v7

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ, Hudson County, NJ, Sussex County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What stands out here?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 1 | 139 | 2 | $0.0219 | 24.4 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_163 words · 429 tokens out · 22.9s · $0.0085 · flex_

_Answer 1 refused and sent back for revision:_ jargon: 'median' in "…al property tax bill reflects median levies across one- …"

**What stands out here?** _(2 figures)_

Bergen County stands out for its high home prices, where the typical owner-occupied home value of $623,000, give or take $4,306, ranks highest among New Jersey's 21 counties alongside an annual property tax bill of $12,038 for a typical home. For buyers and renters, these figures show that acquiring a home involves some of the highest ownership and ongoing tax expenses in the state. One limitation is that five-year survey estimates overlap across years, which can understate how quickly values and local conditions are truly changing over time.

**What should I check before moving?** _(0 figures)_

The typical property tax bill reflects levies across one- to four-family homes before any individual relief, but actual taxes depend on each individual municipality's local assessment rather than a single countywide rate on market value. Additionally, rent measures that rely on smaller sets of listings rest on a thinner base of properties and may not reflect what is asked across different neighborhoods or home types.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_128 words · 154 tokens out · 44.4s · $0.0027 · flex_

**What stands out here?** _(2 figures)_

Residential units permitted in Mercer County surged from 830 to 1,611, placing the county among the highest in New Jersey for residential building authorizations. For buyers and renters, this sharp expansion in home construction directly increases the supply of available housing units across the area. A notable limitation is that permit figures track approvals for future construction rather than completed homes ready for occupancy.

**What should I check before moving?** _(0 figures)_

The typical property tax bill reflects assessment records across one- to four-family homes before any relief credits and depends on local municipal assessments rather than a single countywide rate on market value. Additionally, rent figures cover broad geographic areas, while individual rental listings and local lease prices vary substantially across specific towns and neighborhoods.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_140 words · 180 tokens out · 4.9s · $0.0027 · flex_

**What stands out here?** _(2 figures)_

Cumberland County has the lowest typical home value among New Jersey's 21 counties at $279,277, alongside the lowest annual property tax bill for a typical home at $4,563. This keeps the typical overall cost of owning a home lower than in any other county across the state. However, the available rent data rests on a much smaller base of tracked properties than the home pricing data, leaving rental patterns less completely represented.

**What should I check before moving?** _(0 figures)_

A specific address's property tax bill will depend on the town's local assessment rather than an overall county rate, and it reflects the amount billed before any individual state tax relief is applied. In addition, broader rent figures for the wider area do not reflect local street-by-street pricing variations or whether a landlord bills utilities separately from rent.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_149 words · 193 tokens out · 37.5s · $0.0028 · flex_

**What stands out here?** _(2 figures)_

Hudson County's typical gross rent rose from $1,391 a month, give or take $12, to $1,894 a month, give or take $17, placing its current rent near the top of New Jersey's 21 counties. This shift reflects steep increases in rental costs for incoming and current tenants. However, the survey periods overlap by four years, meaning these measurements are not fully independent and understated the separation between the two points in time.

**What should I check before moving?** _(0 figures)_

The typical property tax bill reflects the amount billed before any relief paid to individual households, so the net cost for a specific address will vary. In addition, actual tax bills follow each municipality's local assessments rather than a single rate applied to market values. Finally, countywide figures cannot show specific neighborhood rents, especially because rent measures here rest on fewer local observations than home values do.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_113 words · 150 tokens out · 12.2s · $0.0052 · standard_

**What stands out here?** _(1 figure)_

Sussex County has a homeownership rate of 83.7%, give or take 1%, which is the second highest among New Jersey's 21 counties. This high rate reflects an area dominated by owner-occupied housing rather than rental properties. However, this count comes from rolling five-year survey estimates that overlap across consecutive years, which understates shifts over shorter periods.

**What should I check before moving?** _(1 figure)_

A typical property tax bill of $7,867 reflects local municipal assessments rather than a uniform market rate, so bills can vary widely from one town or property to another. Furthermore, that amount represents the initial charge before applying any state property tax relief programs for individual households.
