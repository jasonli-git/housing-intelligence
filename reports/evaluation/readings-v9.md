# Readings side by side — readings-v9

Generated 2026-10-08 by `hip eval readings`. Each model was given the prompt, packet (1.5, with margins and rank ranges), service tier and gates `hip explain` would give it, for 3 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What stands out here?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.8 Flash (low thinking) | 3 of 3 | 3 of 3 | 0 of 0 | 0 | 81 | 2 | $0.0297 | 369.9 |
| Gemini 3.1 Flash-Lite | 3 of 3 | 3 of 3 | 0 of 0 | 1 | 65 | 2 | $0.0079 | 8.6 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.8 Flash (low thinking) — would publish

_94 words · 124 tokens out · 10.6s · $0.0060 · flex_

**What stands out here?** _(2 figures)_

Bergen County stands out for high housing prices, where the typical sale price of $715,000 ranks highest among New Jersey's 21 counties, paired with an annual property tax bill for a typical home of $12,038. For anyone buying here, these figures point to substantial ongoing ownership expenses and purchase costs relative to the rest of the state. A key limitation is that sale prices describe only the one- to four-family homes that actually sold rather than the value of every home, meaning changes can reflect more expensive properties trading hands.

#### Gemini 3.1 Flash-Lite — would publish

_68 words · 86 tokens out · 1.0s · $0.0020 · flex_

**What stands out here?** _(1 figure)_

Bergen County has the highest typical owner-occupied home value and the highest monthly owner costs with a mortgage among New Jersey's 21 counties. These figures mean that buying a home here requires a larger financial commitment than in any other part of the state. The primary limitation affecting this pattern is that the typical home was built in 1960, give or take 1 year.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.8 Flash (low thinking) — would publish

_62 words · 86 tokens out · 997.3s · $0.0119 · standard_

**What stands out here?** _(2 figures)_

Mercer County saw its vacancy rate fall from 10.3% to 4.6%, give or take 1%, placing it near the middle of New Jersey's 21 counties. That drop in empty homes leaves fewer properties standing vacant for people looking to rent or buy. However, consecutive survey measurements overlap across years, which understates how quickly conditions actually separated over time.

#### Gemini 3.1 Flash-Lite — would publish

_70 words · 180 tokens out · 23.7s · $0.0040 · flex_

_Answer 1 refused and sent back for revision:_ a survey figure stated without its margin in "… 94.1% and its typical home value reach $377,700. This growth in new construct…"

**What stands out here?** _(2 figures)_

Mercer County has seen residential units permitted rise by 94.1% and its typical home value reach $377,700, give or take $6,110. This growth in new construction and home values shapes the options for those looking to buy or rent in the region. The primary limitation affecting this pattern is the reliance on survey estimates for many housing figures, which can lead to uncertainty in precise rankings.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.8 Flash (low thinking) — would publish

_86 words · 119 tokens out · 101.9s · $0.0118 · standard_

**What stands out here?** _(2 figures)_

Cumberland County has the lowest typical home value in the state at $221,400, give or take $4,674, while the typical gross rent sits near the bottom among New Jersey counties at $1,282 a month, give or take $38. For someone moving here, that means both buying a home and renting cost less than in most other parts of the state. However, these survey estimates describe five-year spans rather than single moments in time, meaning the data can mask more recent market shifts.

#### Gemini 3.1 Flash-Lite — would publish

_57 words · 69 tokens out · 1.0s · $0.0019 · flex_

**What stands out here?** _(0 figures)_

Cumberland County has the lowest typical home value and the lowest typical household income among New Jersey's 21 counties. These figures mean that both buying and renting are priced at the bottom of the state's range. The primary limitation is that these figures are based on survey estimates which carry margins of error.
