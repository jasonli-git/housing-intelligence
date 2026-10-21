# Readings side by side — readings-v10

Generated 2026-10-21 by `hip eval readings`. Each model was given the prompt, packet (1.7, with margins and rank ranges), service tier and gates `hip explain` would give it, for 4 counties: Gloucester County, NJ, Burlington County, NJ, Camden County, NJ, Salem County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What stands out here?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 4 of 4 | 4 of 4 | 0 of 0 | 1 | 61 | 0 | $0.0051 | 31.2 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Gloucester County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_68 words · 1,680 tokens out · 22.6s · $0.0011 · flex_

**What stands out here?** _(0 figures)_

Gloucester County stands out for home values and annual rent both ranking among the lowest relative to household income in New Jersey. For renters and buyers, that means both rent and home values are relatively low compared with household income, compared with many counties. The main limitation is that these comparisons are calculated from separate published cost and income figures, rather than measured directly.

## Burlington County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_62 words · 1,220 tokens out · 16.3s · $0.0010 · flex_

**What stands out here?** _(0 figures)_

Typical gross rent is toward the top among New Jersey counties, while home value compared with household income is among the lowest and homeownership is toward the top. For renters, rents are relatively high; for buyers, home values compared with household income are relatively low. Margins of error leave these survey-based rankings as ranges rather than exact positions.

## Camden County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_66 words · 2,902 tokens out · 51.0s · $0.0021 · flex_

_Answer 1 refused and sent back for revision:_ ranking words "among New Jersey’s highest" do not fit the data's ranks: 'Median owner-occupied home value' 19–19 of 21, 'Typical sale price, recent transactions' 19–19 of 21, 'Home value index, single-family' 19–19 of 21 (1 = highest value); jargon: 'index' in "…is less firm because the rent index covers fewer places…"

**What stands out here?** _(0 figures)_

Camden County’s typical home values are among the lowest in New Jersey, while rents are near the bottom compared with other counties. For buyers, home values are lower than in many counties; for renters, rents are lower than in many counties. The rent comparison is less firm because it covers fewer counties and rests on a thinner base than the home-value comparison.

## Salem County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_48 words · 1,312 tokens out · 34.7s · $0.0010 · flex_

**What stands out here?** _(0 figures)_

Salem County’s sale prices are among the lowest in New Jersey, and rents are near the bottom of county rankings. Buying prices and rents are both low compared with other counties. One limitation is that sale prices describe homes that sold, not every home.
