# Readings side by side — readings-v12

Generated 2026-10-22 by `hip eval readings`. Each model was given the prompt, packet (1.7, with margins and rank ranges), service tier and gates `hip explain` would give it, for 1 counties: Cumberland County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What stands out here?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 1 of 1 | 1 of 1 | 0 of 0 | 0 | 57 | 0 | $0.0009 | 31.8 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not priced. The local model is not billed per token. Seconds are wall-clock, network included.

## Cumberland County, NJ

### Consumer reading

#### GPT-6 Luna — would publish

_57 words · 933 tokens out · 31.8s · $0.0009 · flex_

**What stands out here?** _(0 figures)_

Cumberland County’s typical owner-occupied home value and typical gross rent are among the lowest compared with other New Jersey counties. For renters and buyers, both typical rents and typical home values are low relative to those in other counties. The main limitation is that survey margins leave the rent comparison’s exact rank uncertain.
