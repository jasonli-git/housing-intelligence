# Readings side by side — readings-v11

Generated 2026-10-22 by `hip eval readings`. Each model was given the prompt, packet (1.7, with margins and rank ranges), service tier and gates `hip explain` would give it, for 3 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What stands out here?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 2 of 3 | 2 of 3 | 0 of 0 | 0 | 54 | 0 | $0.0041 | 61.1 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_54 words · 1,004 tokens out · 34.8s · $0.0009 · flex_

**What stands out here?** _(0 figures)_

Bergen County’s typical owner-occupied home value ranks highest among the places compared, while typical gross rent is near the top. For someone buying or renting, housing costs stand out as high on both sides of the market. The main limitation is that survey margins make the exact rent ranking uncertain.

## Mercer County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_54 words · 1,371 tokens out · 42.0s · $0.0010 · flex_

**What stands out here?** _(0 figures)_

Mercer County’s annual rent compared with household income ranks among the highest in New Jersey, while home value compared with household income sits near the middle. That makes rent stand out more than home value in these comparisons of housing costs with income. Survey margins make both rank positions uncertain.

## Cumberland County, NJ

### Consumer reading

#### GPT-6 Luna — would be **refused**

_52 words · 3,471 tokens out · 106.3s · $0.0022 · flex_

_Answer 1 refused and sent back for revision:_ ranking words "the highest" do not fit the data's ranks: 'Median gross rent' 19–21 of 21, 'Median gross rent, one bedroom' 19–21 of 21, 'Median gross rent, two bedrooms' 20–21 of 21, 'Median gross rent, three bedrooms' 18–21 of 21, 'Observed rent index, all homes' 21–21 of 21 (1 = highest value)

> ranking words "among the highest" do not fit the data's ranks: 'Median gross rent' 19–21 of 21, 'Median gross rent, one bedroom' 19–21 of 21, 'Median gross rent, two bedrooms' 20–21 of 21, 'Median gross rent, three bedrooms' 18–21 of 21, 'Observed rent index, all homes' 21–21 of 21 (1 = highest value)

**What stands out here?** _(0 figures)_

Cumberland County’s typical gross rent is near the bottom among New Jersey counties, while monthly owner costs with a mortgage are among the highest. For renters, the rent measure is modest; for buyers, owning with a mortgage carries substantial monthly costs. Survey margins make these comparisons less precise.
