# Readings side by side — readings-v8

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Hudson County, NJ, Bergen County, NJ, Mercer County, NJ, Sussex County, NJ, Cumberland County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What stands out here?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 0 | 130 | 2 | $0.0393 | 27.6 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_130 words · 2,189 tokens out · 40.4s · $0.0168 · standard_

**What stands out here?** _(2 figures)_

Hudson County has the lowest homeownership rate in the state at 31%, give or take 1%, alongside typical monthly rents of $3,056 that rank as the highest among New Jersey counties. This means most households rent their homes rather than own them, while facing the highest rental pricing across the state. However, the measure for these rental amounts covers fewer locations than home valuations do, drawing on a smaller comparison pool.

**What should I check before moving?** _(0 figures)_

Property tax figures follow each municipality's individual assessments rather than a standard rate on market value, and they leave out tax relief paid directly to homeowners. Countywide rental measurements also cannot reveal local neighborhood price variations or whether a specific rental unit includes utility bills in the stated price.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_124 words · 168 tokens out · 52.2s · $0.0090 · standard_

**What stands out here?** _(2 figures)_

Bergen County has the highest typical home value among New Jersey's 21 counties at about $623,000, give or take $4,306. For someone buying here, this elevated level aligns with monthly owner costs for households with a mortgage that also reach the highest position statewide at about $3,547 a month, give or take $32. Because these five-year survey estimates overlap across consecutive periods, they understate how sharply housing conditions have separated over time.

**What should I check before moving?** _(0 figures)_

The typical annual property tax bill reflects the amount billed before individual household relief credits are applied. In addition, actual tax bills vary across individual municipalities because they follow each town's local property assessments rather than a uniform percentage of market value.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_124 words · 149 tokens out · 6.6s · $0.0045 · flex_

**What stands out here?** _(2 figures)_

Residential units permitted grew from 830 to 1,611, putting Mercer County among the highest for authorized new home construction. That sharp rise means buyers and renters are seeing far more newly authorized housing supply added than in most peer counties. These permit figures only reflect authorisations to build, however, rather than completed homes ready for occupancy.

**What should I check before moving?** _(0 figures)_

The typical property tax bill reflects assessment records as billed before any household relief, and actual amounts depend on each town's local assessment rather than a simple rate on market value. Broad rental measures also cannot pinpoint costs for a specific home because market rent figures rest on a narrower pool of local listings than home values do.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_131 words · 171 tokens out · 16.4s · $0.0045 · flex_

**What stands out here?** _(2 figures)_

Sussex County ranks highest in New Jersey for its share of single-family detached homes at 78.0%, give or take 1%, and second for homeownership at 83.7%, give or take 1%. This reflects an environment centered heavily on owned single-family houses rather than rental or multi-unit living options. However, these figures come from five-year survey averages where consecutive measurement periods overlap significantly, muting shorter-term shifts.

**What should I check before moving?** _(0 figures)_

The typical annual property tax bill reflects assessment records as billed before relief programs and depends on how individual municipalities value properties rather than a standard rate applied across actual market values. Additionally, overall rent figures reflect a much narrower set of local property listings than home values do, making local rental prices harder to compare evenly.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_141 words · 182 tokens out · 22.5s · $0.0045 · flex_

**What stands out here?** _(2 figures)_

Cumberland County has the lowest annual property tax bill for a typical home in New Jersey at $4,563, alongside the lowest typical single-family home value at $279,277. These lower costs mean buyers encounter the state's most affordable purchase prices and entry-level carrying expenses. However, the typical home value rests on a five-year window of survey estimates that overlap across consecutive measurement periods. What shout I check before moving?

**What should I check before moving?** _(0 figures)_

A specific home's actual tax bill will reflect its town's local assessment rather than a single countywide rate on market value, and it leaves out state relief credits paid directly to individual households. Broad rent measures can also obscure what is available on a specific street because rental market tracking draws on a much thinner base of local properties than home sales data.
