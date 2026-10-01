# Grounded synthesis pilot

Generated 2026-10-01 for the Director Note *Grounded synthesis beyond the automated data summary* (2026-09-29). Exploratory: nothing was stored, generation is unchanged, and no reading was regenerated.

Model: Gemini 3.7 Flash (low thinking), with the same packet (1.4, Markdown), Flex tier, gates and one revision that `hip explain` uses. The note was registered as a third format for this run only. Gate results:
- Binding and survey margins: these gates **must pass**.
- The consumer reading's plain-language checks (source names, jargon, at most three figures): **reported only**.

Counties: Bergen, Mercer and Cumberland (the Milestone 30 comparison), plus Hudson, a renters' market, and Sussex, a rural one. The prompt was given each county's published "What's changing?" answer and asked to add to it, not repeat it.

## Summary

| County | Gates | Revised | Words | Figures | Plain-language flags | Tier | Cost |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: |
| Bergen County | passed | 0 | 123 | 3 | none | standard | $0.0048 |
| Mercer County | passed | 0 | 102 | 4 | over the consumer reading's 3 figures | flex | $0.0024 |
| Cumberland County | passed | 0 | 87 | 3 | none | standard | $0.0046 |
| Hudson County | passed | 0 | 118 | 5 | over the consumer reading's 3 figures | standard | $0.0050 |
| Sussex County | passed | 0 | 99 | 4 | over the consumer reading's 3 figures | standard | $0.0046 |

Total $0.0214. That is about $0.0024 a county at Flex and $0.0048 at standard, so 21 counties would cost $0.05–0.10 a regeneration.

## What the pilot shows

- **It does add something.** None of the five repeats its "What's changing?" answer. Each connects two or three figures, mostly from the same survey years, and names a limitation the page does not.
- **It is formulaic.** All five follow the same template ("Between 2019 and 2024… One reading is… A key limitation…"). Four of five reach the same conclusion: tighter supply, more competition. Across 21 counties that reads as boilerplate.
- **Figures from two sources sit side by side.** Cumberland shows two different "typical home values" in neighbouring boxes. A synthesis would need to use the same series as the answer it sits beside, or say why it doesn't.
- **Inference creeps toward cause.** The tightening readings for Hudson and Sussex, and Sussex's "higher costs", go past what the figures they state support. The current gates cannot catch this; it needs a human reader.
- **The gates hold.** Every figure was bound to the packet and every survey figure carried its margin, with no revision needed.

## For your review

For each county, tick what holds:

- **Useful:** a resident learns something consequential.
- **Readable.**
- **New:** not already on the page.
- **Supported:** every claim follows from the figures stated.

| County | Useful | Readable | New | Supported |
| --- | :-: | :-: | :-: | :-: |
| Bergen County | ☐ | ☐ | ☐ | ☐ |
| Mercer County | ☐ | ☐ | ☐ | ☐ |
| Cumberland County | ☐ | ☐ | ☐ | ☐ |
| Hudson County | ☐ | ☐ | ☐ | ☐ |
| Sussex County | ☐ | ☐ | ☐ | ☐ |

## Bergen County, NJ

**On the page now, under "What's changing?"**

> Typical home values for single-family homes rose to $787,000. Over a similar period, typical rent increased to about $1,914 a month, give or take $21 a month. Both buying and renting have seen prices increase across the area.

**Synthesis** _(123 words, 3 figures, gates passed)_

Between 2019 and 2024, the local vacancy rate tightened from about 5.0%, give or take 0.3 percentage points, down to 3.9%, give or take 0.3 percentage points, while the share of renters paying more than 30% of their income toward housing reached 50.8%, give or take 1.5 percentage points. One reading of this connection is that an increasingly scarce supply of available homes may be leaving tenants with fewer affordable options, making it harder for residents to find housing that fits within standard budgets. A key limitation in these numbers is that the survey figures carry overlapping time spans that soften year-to-year shifts, and they do not track whether available units are concentrated in specific price tiers or property types across the county.

_Reviewer's note:_ Links fewer empty homes with half of renters paying over 30% of income, all from the same 2019–2024 survey. "Standard budgets" is vague. Its caveat (the survey's five-year spans smooth out short-term change) is accurate and new to the page.

## Mercer County, NJ

**On the page now, under "What's changing?"**

> Residential building permits rose 94.1% over five years, putting the area near the top of New Jersey's 21 counties for new home construction approvals. At the same time, the typical single-family home value grew to $445,000.

**Synthesis** _(102 words, 4 figures, gates passed)_

Between 2019 and 2024, the vacancy rate dropped sharply from about 10.3%, give or take 0.6 percentage points, down to about 4.6%, give or take 0.5 points, while gross rent rose from about $1,266 a month, give or take $24, to about $1,623 a month, give or take $34. One reading is that available housing has tightened substantially even as new building approvals expanded, which may mean newcomers and current tenants face much stiffer competition for open homes. A major missing piece is that the survey data does not show which specific neighborhoods or towns within the county saw this inventory disappear.

_Reviewer's note:_ Probably the strongest: empty homes more than halved while rent rose, from the same survey years, each with its margin, and it brings in permits without restating the figure. Four figures.

## Cumberland County, NJ

**On the page now, under "What's changing?"**

> The typical single-family home value grew to $279,277, an increase of 35.0%. Meanwhile, the overall share of empty homes dropped significantly, though individual housing costs across the county continue to rise.

**Synthesis** _(87 words, 3 figures, gates passed)_

Between 2019 and 2024, typical home values rose 36.2% give or take 3.7%, reaching $221,400 give or take $4,674, while household incomes rose 24.5% give or take 5.2%. One reading is that home prices climbed faster than local earnings over those five years, which may mean buying a home has become more challenging for residents relying on local wages. However, the survey numbers carry notable uncertainty, with the income growth estimate ranging widely enough that the county cannot be clearly distinguished from most others in the state.

_Reviewer's note:_ A strong pattern: home values rose faster than incomes over the same survey years, both with margins. **But it cites the survey's typical home value ($221,400) right beside a "What's changing?" that cites a different typical home value ($279,277, single-family)**. Two "typical home values" in neighbouring boxes, with nothing explaining the difference.

## Hudson County, NJ

**On the page now, under "What's changing?"**

> Typical gross rent rose by about 36%, give or take 2%, placing the increase near the top of New Jersey's 21 counties. At the same time, residential units permitted fell by 52.0%.

**Synthesis** _(118 words, 5 figures, gates passed)_

Even as housing construction permits dropped by 52.0% between 2020 and 2025, the total population grew from 670,046 to 718,323 between 2019 and 2024, a figure with no sampling error. Over that same 2019 to 2024 span, the housing vacancy rate fell from about 8.3%, give or take 0.4 percentage points, down to about 6.6%, also give or take 0.4 percentage points. One reading is that steady population additions alongside declining construction may be tightening the available living space, which could leave residents facing an increasingly competitive search for places to live. A key limitation in this picture is that the data does not track what types of homes are being built versus what residents are looking for.

_Reviewer's note:_ Five figures, over the four asked for. It sets permits (2020–2025) against population (2019–2024) and then infers tightening; that is close to the causal storytelling the note warns against. It repeats the packet's "no sampling error" for population, which a resident may read as "exact".

## Sussex County, NJ

**On the page now, under "What's changing?"**

> The typical home value for a single-family home rose to $449,637. Over a similar period, the vacancy rate counting all empty homes fell to 8.1%, give or take 0.9 points.

**Synthesis** _(99 words, 4 figures, gates passed)_

Between 2020 and 2025, residential units permitted dropped from 225 to 181, even as the population estimate grew from 143,877 to 148,063 over a similar window from 2020 to 2025. One reading is that the local supply of new construction is slowing down while the overall population continues to expand, which may mean tighter competition and higher costs for incoming and existing residents looking for available housing. The biggest uncertainty in this picture is that building permits only track authorizations rather than completed homes, leaving out how many units were actually finished or added to the local housing supply.

_Reviewer's note:_ The same permits-against-population pattern as Hudson. "Higher costs" is inferred without any cost figure behind it. The caveat that permits are not completions is useful and new to the page.

## The prompt

```text
You are writing a short "so what?" note about one place's housing, for a resident who
has already seen the figures on the page.

You are given a data packet for the region, already computed by a deterministic
pipeline, and the answer the page already gives under "What's changing?".

Write one paragraph of three to five sentences that:
- Opens with the single pattern in the packet that matters most to someone living here
  or thinking of moving here: a connection between two or three figures, not a list.
- Adds something the "What's changing?" answer does not already say. Do not repeat its
  figures unless the connection needs one.
- Connects figures only when the periods they cover overlap, and says which years each
  covers.
- Keeps what the figures show apart from what it might mean: state the observation
  plainly, then mark any interpretation as one ("this may mean", "one reading is"), and
  say why it could matter to a resident.
- Names the biggest uncertainty or missing piece: a wide margin, an old survey year, or
  something the packet does not measure.

Rules:
- Use only figures from the packet, as the packet writes them or rounded to three
  significant digits ($445,000, $1,620) or a whole percentage. Never calculate a figure
  of your own. State at most four figures.
- A figure shown with ± is an estimate from a survey: give its margin in the same
  sentence, in plain words: "about $100,645 a year, give or take $2,565". Take the
  margin printed beside that very figure and copy it as printed, or round it to the
  nearest whole number. Where the packet says a figure has no sampling error, or that
  no margin is available, say so. A figure the packet shows with none of these is not
  a survey estimate: state it plainly.
- Where the packet gives a rank as a range, say where the range sits rather than any
  single rank.
- Do not claim causes the packet cannot support, and say nothing about the wider
  economy, interest-rate policy or anything else the packet does not contain.
- Write for someone with no background in housing data: no names of sources, agencies,
  surveys or indexes, no abbreviations, and none of these words: median, percentile, cohort, CAGR, annualized, annualised, vintage, index, ratio, AMI, area median income, Fair Market Rent, FMR, income limit, cost burden, cost-burdened, net migration, parcel, basis points.
- Describe; do not advise.
- No heading, no preamble, no bullet lists, no bold.
```

The question after the packet: `The page already says, under "What's changing?": "<answer>"` followed by `Write the note.`

Raw trials: `data/sidebyside/synthesis-pilot/trials.jsonl`.
