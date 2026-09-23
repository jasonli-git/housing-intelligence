# Director Notes

This file contains user-originated feedback, observations, and possible directions.

Notes are not automatically approved requirements. Ideas must receive explicit user approval before implementation. Promotion into `SPEC.md`, `ROADMAP.md`, `TODO.md`, or milestone work requires an explicit decision.

---

## README audit and documentation auto-maintenance

**Status:** Possible direction — not approved for implementation
**Recorded:** 2026-09-19

Reduce the README's hand-maintained surface and have most of it refresh
automatically on pushes to `main`.

### Per-section intent

| Section | Intent |
|---|---|
| Status (top) | Much shorter: a summary of what is already implemented/deployed, then a few sentences on the latest of the project. Updated automatically as often as possible. |
| Screenshots | Delete the current section for now. Open question: can screenshots be automated on every push to `main`? If that works, cover desktop and mobile views. |
| Features | Keep, but keep it current on every push to `main`. |
| Sample output | Undecided. Probably removable *if* automated screenshots work out. |
| Model evaluations | Much shorter, concise, automated. Should read as a story of progression over time across existing and new evals, with links out for readers who want the evals themselves. |
| Tech Stack | Content is fine. Keep it current on every push to `main`. |
| Setup / Publishing | Audit and update automatically. |
| Project Status | Fine at its current length, since the top status section becomes much shorter. |
| Resource Requirements, Storage Footprint | Suspend for now; mark stale or outdated. Interest in automating both per push to `main`, not yet explored. |

### Also raised

- Audit whether `TODO.md` is useful, and how to make it more relevant to the
  workflow.
- Explore automating a `SPEC.md` audit.

### Open question

How much of this can actually be generated or verified on each push to `main`,
and by what mechanism. Several items above are conditional on that answer.

Do not implement yet.

---


## Decision: documentation images follow the deployed site

**Status:** Approved direction
**Recorded:** 2026-09-19

Settles the screenshot half of the note above. The note itself is left as written.

README images will represent the **deployed site**, captured from the finished static
export at deploy time and never committed to the repository. A bot-opened PR carrying
regenerated images and a ruleset bypass for CI were both considered and rejected — see
ARCHITECTURE #175 for the rationale and `agent-handoffs/screenshot-automation.md` for
the costed investigation.

**Blocked on automated deployment**, which does not exist yet. Until it does the
Screenshots section stays empty and retakes are a manual `npm run screenshot:poc`.

**Still open from the note above:** whether the non-image sections regenerate, and which
of their figures are mechanically derivable at all. The Features list is prose and
cannot write itself; a staleness *check* against `ROADMAP.md` is tracked in `TODO.md`
instead.

---

## Accessible, comprehensive, and current housing data

**Status:** Exploratory — not approved for implementation
**Recorded:** 2026-09-19

The long-term ambition is to reduce dependence on expensive, fragmented, or
gate-walled institutions for housing data. The platform should make useful
housing information as inexpensive, accurate, precise, accessible, and
trustworthy as responsibly possible. In other words, this platform should aim
to be better than a Google search for housing questions: not merely returning a
convenient number, but providing a timely, sourced, comparable, and explainable
answer whose underlying evidence can be inspected.

The original specification approached completeness from the ground up: build a
large-scale analytics platform around the most complete feasible public
datasets. Explore adding a complementary top-down perspective:

- What information does an ordinary person actually want when trying to
  understand housing?
- Which additional data and functionality would help answer those questions?
- How can those answers remain grounded in traceable evidence rather than
  requiring users to trust a chatbot?

### Data-source exploration

Conduct a broader source and licensing audit that considers:

- Untapped public datasets, open-data portals, and free APIs.
- The [New Jersey DCA Data Hub](https://datahub.dca.nj.gov/search?tags=housing).
- Providers identified through resources such as the
  [Ficstar real-estate data-provider overview](https://www.ficstar.com/best-real-estate-data-providers).
- Paid sources costing no more than approximately $10 per month, prioritized
  by their likely usefulness and impact.
- Free, legally reusable, and operationally sustainable web sources when no API
  or affordable provider exists.
- Alternatives to the Zillow Research data currently in use, particularly
  sources whose licensing would permit a feasible path toward a commercial
  product.
- Whether outreach to government agencies, universities, nonprofits, industry
  organizations, or other institutions could produce better access, bulk
  releases, partnerships, or otherwise unavailable data.

Licensing, commercial reuse, geographic coverage, update frequency,
reliability, and provenance should be evaluated alongside the contents of each
source.

### Existing-source freshness

Audit current sources to determine:

- Which datasets have newer releases available.
- Which acquisition processes need scheduled refreshes.
- Which metrics appear current but are actually tied to an older source
  release.
- Which datasets or metrics cannot be refreshed through their original source.

For metrics that cannot be refreshed, explore a repeatable and documented
alternative to manually searching for newer figures one at a time.

### Possible temporal modes

Explore whether the website could distinguish among different levels of
temporal certainty:

- **Firm data:** Observed metrics from the latest successfully acquired and
  validated source releases. Firm mode should also be capable of incorporating
  frequently refreshed, authoritative inputs when they are reliably available,
  such as current mortgage rates. For example, the website currently cites a
  6.67% mortgage rate, while a contemporaneous Google result reportedly
  displayed 6.95%. That discrepancy should be verified and used to examine
  whether the source, refresh cadence, or displayed “as of” date needs
  improvement; Google should not automatically be treated as the authoritative
  source.
- **Current — projected:** Clearly labeled estimates of current-month metrics
  and rankings derived from the latest firm data and other defensible signals.
- **Future — forecast:** Possible forward-looking estimates of where metrics
  may move. This mode is optional and should be omitted if it cannot be
  validated, explained, and presented responsibly.

Observed, projected, and forecast values must never appear interchangeable. Any
projected mode would need conspicuous labeling, an “as of” date, methodology,
validation evidence, uncertainty, and a clear path back to the underlying firm
observations.

AI may help users interpret evidence, but it should not be the foundation of
trust. Trust should come from transparent sources, reproducible calculations,
visible dates, explicit limitations, and an unambiguous separation between
measured and modeled values.

### Cost-breakdown comprehensiveness

Explore whether the platform’s housing cost breakdowns omit costs that could be
reliably sourced, estimated, or calculated.

Consider adding relevant costs such as taxes and other recurring or
transaction-related expenses when the necessary inputs and methodology are
dependable. The audit should cover both costs already modeled and plausible
missing costs.

Additional cost figures should only be included when the platform can explain:

- The source or calculation.
- The date and geographic scope of the underlying data.
- Whether the value is observed, calculated, estimated, or based on a
  user-supplied assumption.
- The limitations or uncertainty associated with the figure.

The goal is a more complete real-world cost picture without introducing false
precision.

### Open presentation questions

- The statewide house-price-index values, such as `442.7` and `967.6`, already
  have definitions but may not communicate their scale or baseline at a glance.
  Explore adding a compact baseline or interpretation cue beside each value
  rather than replacing the existing definition. No presentation change has
  been decided.
- The sentence “every figure ranked against New Jersey’s 21 counties” consumes
  an additional line, but removing it could make the comparison set unclear.
  Consider incorporating the context directly into each rank treatment—for
  example, **“Rank 4 of 21 NJ counties”**—or finding another compact
  presentation that preserves the meaning without requiring a separate line.

### Roadmap and release scope

Many of the directions in this note will probably need to be researched,
scoped, prioritized, scheduled, and integrated across multiple releases.
Consider them candidates for **v3 and beyond**, rather than commitments for the
current roadmap.

Before any item is scheduled, evaluate its:

- Usefulness to ordinary users.
- Data availability, licensing, and commercial-use constraints.
- Accuracy and validation requirements.
- Refresh and long-term maintenance burden.
- Implementation complexity and operating cost.
- Fit with the platform’s trust and provenance principles.

This Director Note should inform future roadmap planning, but it does not itself
add these features to the roadmap or approve them for implementation.

Do not implement yet.

---

## Decision: measured and modeled values are never interchangeable

**Status:** Approved direction
**Recorded:** 2026-09-19

Promotes one principle out of the note above, at the owner's explicit direction. The
note itself is left as written.

`SPEC.md` gains **principle 11** and moves to v1.2: every figure is observed,
calculated, estimated or forecast, and which one is always visible; a modeled figure
carries labeling, an "as of" date, methodology, validation evidence, uncertainty, and a
path back to the observed figures beneath it; and trust rests on provenance rather than
on the AI layer.

**What was not promoted.** The note's current-projected and future-forecast modes stay
exploratory. Principle 11 fixes the condition such modes would have to meet, not a
decision to build them — whether the platform offers modeled figures at all remains a
scoping question for v3 and beyond.

**Also still open from the note above:** the source and licensing audit, the
existing-source freshness audit, cost-breakdown completeness, the two presentation
questions, and the 6.67% versus 6.95% mortgage-rate discrepancy, which is a checkable
data-freshness question rather than a direction.

---

## Batch pricing for regeneration, not for benchmarks

**Status:** Possible direction — not approved for implementation
**Recorded:** 2026-09-19

Explore routing `hip explain` through each provider's batch API, while leaving the
evaluation harness on synchronous calls.

The reasoning is a split, not a preference:

- **Regeneration has no reader waiting.** `hip explain` runs as a background job before
  a publish, so a batch turnaround measured in hours costs nothing. It currently makes
  one synchronous request per (region, model) at list price — 105 of them for New
  Jersey's counties.
- **Benchmarks measure the wait.** `hip eval run` records `tokens_per_second` and TTFT
  per generation and reports them per model. A batch submission has neither, so batching
  would empty columns that model selection reads. `reports/evaluation/v3.md` already
  notes that a hosted `tok/s` is "a latency number wearing a throughput label"; under
  batch it would be a queue number wearing the same label.
- **Judging already batches**, through Anthropic's Batch API at a flat 50%, and should
  stay there.

Worth establishing before building:

- Whether each provider in the preference list offers a batch API at all, what discount,
  and what turnaround.
- What a partial batch failure means for a publish — whether a run completes with gaps
  or blocks.
- Whether the local tier (`gemma-4-e4b-q4`) stays synchronous, since it cannot batch,
  and what a mixed-mode run costs in complexity.
- Whether a batch path changes which model writes a given region, which would change
  published prose for reasons unrelated to the figures.

**Scale is what decides this.** At 21 counties and five models a run is under a dollar
and takes about 45 minutes, so the saving is noise. The Milestone 19 estimate for full
New Jersey municipal coverage is roughly $42 per refresh, where half is material.

Do not implement yet.

---

## Decision: current, complete housing data becomes Version 3

**Status:** Approved direction
**Recorded:** 2026-09-23

Promotes *Accessible, comprehensive, and current housing data* into the roadmap, at the
owner's explicit direction, after a research report from Codex on that note — sources,
freshness, costs, licensing and presentation — was checked against the code. The note
itself is left as written. ROADMAP.md, Versions 3 and 4, carries the milestones.

**What changed in the roadmap:**

- Version 3 absorbs Version 4 and the note's directions as Milestones 26–50; Version 5
  becomes Version 4; unbuilt milestones are renumbered in build order.
- Freshness and publication come first: release discovery and a weekly mortgage
  benchmark (26), a refresh that reaches the site with a public freshness page (27), and
  survey uncertainty with both presentation questions (28).
- Cost completeness is Milestone 33; new public sources arrive one family per milestone
  (35–46); decision guides assemble them (47).
- The paid-data and Zillow-alternative questions become a go / no-go study (32), not a
  purchase.
- *Current — projected* becomes selected, validated nowcasts and *future — forecast*
  stays the forecasting milestone, both in Version 4 and both bound by principle 11.
  There is no global mode switch.
- *Data complete* gets a measured definition: the completeness standing check.

**Also decided in the same review:**

- Interpretations are split by audience (30): one analyst reading per region from
  Gemini 3.7 Flash and its fallbacks, in place of several models side by side, and one
  consumer reading — a bottom line and fixed questions — from a model chosen after a
  three-county comparison.
- Batch pricing for every hosted model on the analyst list, promoted from *Batch pricing
  for regeneration, not for benchmarks*. The rest of that note stays open.
- Qwen 3.7 Plus leaves regeneration, its free quota spent; its readings disappear at the
  next regeneration (26).
- Bring-your-own-model comparison returns to unscheduled.
- Where the refresh runs and what it may do unattended are decided at the start of
  Milestone 27; whether HUD's Location Affordability Index is used, at the start of 43.

**Not promoted:** a paid subscription (32 decides), a Spanish edition and alerts (both
unscheduled), and the institutional outreach, which is the owner's to send.
*README audit and documentation auto-maintenance* stays open.
