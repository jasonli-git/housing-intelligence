# Grounded synthesis pilot

Generated 2026-10-01 for the Director Note *Grounded synthesis beyond the automated data summary* (2026-09-29). Exploratory: nothing was stored, generation is unchanged, and no reading was regenerated.

Model: Gemini 3.7 Flash (low thinking), with the same packet (1.4, Markdown), Flex tier, gates and one revision that `hip explain` uses. The note was registered as a third format for these runs only. Gate results:
- Binding and survey margins: these gates **must pass**.
- The consumer reading's plain-language checks (source names, jargon, at most three figures): **reported only**.

Counties: Bergen, Mercer and Cumberland (the Milestone 30 comparison), plus Hudson, a renters' market, and Sussex, a rural one. Each prompt was given the county's published "What's changing?" answer and asked to add to it, not repeat it.

Two rounds were run. Round 2's prompt was written to fix what round 1 showed:
- It asks for the pattern that sets the county apart, judged by its ranks.
- It names the measures the page's answer quotes and forbids quoting a second measure of the same thing.
- It allows one interpretation, limited to what the stated figures measure.
- It bans the template phrases.

## Round 1

| County | Gates | Words | Figures | Plain-language flags | Mixed measures | Tier | Cost |
| --- | --- | ---: | ---: | --- | --- | --- | ---: |
| Bergen | passed | 123 | 3 | none | none | standard | $0.0048 |
| Mercer | passed | 102 | 4 | over the consumer reading's 3 figures | none | flex | $0.0024 |
| Cumberland | passed | 87 | 3 | none | survey home value beside Zillow's | standard | $0.0046 |
| Hudson | passed | 118 | 5 | over the consumer reading's 3 figures | none | standard | $0.0050 |
| Sussex | passed | 99 | 4 | over the consumer reading's 3 figures | none | standard | $0.0046 |

Total $0.0214.

- **It adds something.** None of the five repeats its "What's changing?" answer.
- **It is formulaic.** All five read "Between 2019 and 2024… One reading is… A key limitation…", and four of five conclude "tighter supply, more competition".
- **It mixes measures.** Cumberland shows two different typical home values in neighbouring boxes.
- **Inference creeps toward cause.** Hudson's and Sussex's tightening readings, and Sussex's "higher costs", go past their figures.

## Round 2

| County | Gates | Words | Figures | Plain-language flags | Mixed measures | Tier | Cost |
| --- | --- | ---: | ---: | --- | --- | --- | ---: |
| Bergen | passed | 96 | 2 | jargon: 'parcel' in "…nd making up just 1.5% of all parcels in 2024. A resident…" | none | flex | $0.0024 |
| Mercer | passed | 104 | 4 | over the consumer reading's 3 figures | none | standard | $0.0050 |
| Cumberland | passed | 124 | 3 | none | none | standard | $0.0048 |
| Hudson | passed | 95 | 3 | none | none | flex | $0.0025 |
| Sussex | passed | 110 | 2 | none | none | flex | $0.0024 |

Total $0.0170. Every rank claim was checked by hand against the packet and holds.

- **Fixed:** sameness. Each county now leads with something different: Bergen's tax bills and lack of vacant land, Cumberland's population and unemployment, Sussex's homeownership.
- **Fixed:** mixed measures. None appear (checked mechanically, not just read).
- **Worse:** the interpretation sentence. Freed from "supply and competition", it speculates about community ties (Sussex), local businesses (Cumberland) and public revenues (Bergen). The figures support none of it.
- **Drifts from housing:** Cumberland's note is about jobs; Sussex's is mostly about who lives there.
- **Synonyms replace banned phrases:** "A possible interpretation", "One way to view".

## What the two rounds suggest

The observation sentence is where the value is. It found a distinctive, checkable pattern in every county in round 2. The interpretation sentence is where every problem in both rounds sits, and no automatic check can catch it. A third round could:
- drop the interpretation and ask only for the pattern, why it matters in housing terms, and its limitation;
- keep the note to housing measures.

Not run. Whether to continue is your decision.

## For your review

For each note, tick what holds:

- **Useful:** a resident learns something consequential.
- **Readable.**
- **New:** not already on the page.
- **Supported:** every claim follows from the figures stated.

| County | Round | Useful | Readable | New | Supported |
| --- | :-: | :-: | :-: | :-: | :-: |
| Bergen | 1 | ☐ | ☐ | ☐ | ☐ |
| Bergen | 2 | ☐ | ☐ | ☐ | ☐ |
| Mercer | 1 | ☐ | ☐ | ☐ | ☐ |
| Mercer | 2 | ☐ | ☐ | ☐ | ☐ |
| Cumberland | 1 | ☐ | ☐ | ☐ | ☐ |
| Cumberland | 2 | ☐ | ☐ | ☐ | ☐ |
| Hudson | 1 | ☐ | ☐ | ☐ | ☐ |
| Hudson | 2 | ☐ | ☐ | ☐ | ☐ |
| Sussex | 1 | ☐ | ☐ | ☐ | ☐ |
| Sussex | 2 | ☐ | ☐ | ☐ | ☐ |

## Bergen County, NJ

**On the page now, under "What's changing?"**

> Typical home values for single-family homes rose to $787,000. Over a similar period, typical rent increased to about $1,914 a month, give or take $21 a month. Both buying and renting have seen prices increase across the area.

**Round 1** _(123 words, 3 figures)_

Between 2019 and 2024, the local vacancy rate tightened from about 5.0%, give or take 0.3 percentage points, down to 3.9%, give or take 0.3 percentage points, while the share of renters paying more than 30% of their income toward housing reached 50.8%, give or take 1.5 percentage points. One reading of this connection is that an increasingly scarce supply of available homes may be leaving tenants with fewer affordable options, making it harder for residents to find housing that fits within standard budgets. A key limitation in these numbers is that the survey figures carry overlapping time spans that soften year-to-year shifts, and they do not track whether available units are concentrated in specific price tiers or property types across the county.

_Reviewer's note:_ Links fewer empty homes with half of renters paying over 30% of income, all from the same 2019–2024 survey. "Standard budgets" is vague. Its caveat (the survey's five-year spans smooth out short-term change) is accurate and new to the page.

**Round 2** _(96 words, 2 figures)_

Bergen County stands out across New Jersey for having among the state's highest housing tax bills alongside an exceptionally tight supply of unbuilt land, with typical annual property taxes of $12,038 ranking second and vacant land making up just 1.5% of all parcels in 2024. A resident might view this combination as an indication of an established, heavily developed landscape where public revenues rely on substantial local property assessments and opportunities for large-scale development are limited. These figures, however, do not reflect any property tax relief programs paid directly to individual homeowners, such as state credits.

_Reviewer's note:_ Distinctive and checked: the second-highest tax bill and the smallest share of vacant land in the state. "Parcels" is on the jargon list. "Public revenues rely on substantial local property assessments" is speculation.

## Mercer County, NJ

**On the page now, under "What's changing?"**

> Residential building permits rose 94.1% over five years, putting the area near the top of New Jersey's 21 counties for new home construction approvals. At the same time, the typical single-family home value grew to $445,000.

**Round 1** _(102 words, 4 figures)_

Between 2019 and 2024, the vacancy rate dropped sharply from about 10.3%, give or take 0.6 percentage points, down to about 4.6%, give or take 0.5 points, while gross rent rose from about $1,266 a month, give or take $24, to about $1,623 a month, give or take $34. One reading is that available housing has tightened substantially even as new building approvals expanded, which may mean newcomers and current tenants face much stiffer competition for open homes. A major missing piece is that the survey data does not show which specific neighborhoods or towns within the county saw this inventory disappear.

_Reviewer's note:_ Probably the strongest: empty homes more than halved while rent rose, from the same survey years, each with its margin. Four figures.

**Round 2** _(104 words, 4 figures)_

Residential units permitted surged 94% between 2020 and 2025 to reach 1,611 approvals, ranking second among New Jersey's 21 counties, while the vacancy rate dropped from 10.3% give or take 0.6 points to 4.6% give or take 0.5 points between 2019 and 2024. A possible interpretation of this pattern is that new residential building expanded sharply even as unoccupied residential space was cut in half, which matters to residents tracking the availability of local housing. A major limitation is that the vacancy figures come from five-year survey estimates whose consecutive spans share four years of data, muting how cleanly the change reflects year-to-year shifts.

_Reviewer's note:_ Much the same as round 1 and still good; it now names the permits rank (2nd). Four figures.

## Cumberland County, NJ

**On the page now, under "What's changing?"**

> The typical single-family home value grew to $279,277, an increase of 35.0%. Meanwhile, the overall share of empty homes dropped significantly, though individual housing costs across the county continue to rise.

**Round 1** _(87 words, 3 figures)_

Between 2019 and 2024, typical home values rose 36.2% give or take 3.7%, reaching $221,400 give or take $4,674, while household incomes rose 24.5% give or take 5.2%. One reading is that home prices climbed faster than local earnings over those five years, which may mean buying a home has become more challenging for residents relying on local wages. However, the survey numbers carry notable uncertainty, with the income growth estimate ranging widely enough that the county cannot be clearly distinguished from most others in the state.

_Reviewer's note:_ A strong pattern: home values rose faster than incomes over the same survey years. **But it cites the survey's typical home value ($221,400) right beside a "What's changing?" that cites a different one ($279,277, single-family)**, with nothing explaining the difference.

**Round 2** _(124 words, 3 figures)_

Cumberland County stands out from the rest of New Jersey for having the slowest population growth, rising just 0.9% with no sampling error to 153,305 residents between 2019 and 2024, alongside an unemployment rate of 7.2% in 2026 that ranks as the highest in the state. What these numbers show is a comparatively slack labor market paired with minimal resident additions. A possible interpretation is that community services and local businesses face less pressure from rapid headcount expansion than other parts of the state, though residents may navigate fewer local employment options. A notable limitation affecting these figures is that the population count and the unemployment rate come from different years and measuring systems that do not capture underlying commute patterns across county lines.

_Reviewer's note:_ Checked: slowest population growth and highest unemployment of the 21. But it has drifted from housing to jobs, and "community services and local businesses face less pressure" is speculation.

## Hudson County, NJ

**On the page now, under "What's changing?"**

> Typical gross rent rose by about 36%, give or take 2%, placing the increase near the top of New Jersey's 21 counties. At the same time, residential units permitted fell by 52.0%.

**Round 1** _(118 words, 5 figures)_

Even as housing construction permits dropped by 52.0% between 2020 and 2025, the total population grew from 670,046 to 718,323 between 2019 and 2024, a figure with no sampling error. Over that same 2019 to 2024 span, the housing vacancy rate fell from about 8.3%, give or take 0.4 percentage points, down to about 6.6%, also give or take 0.4 percentage points. One reading is that steady population additions alongside declining construction may be tightening the available living space, which could leave residents facing an increasingly competitive search for places to live. A key limitation in this picture is that the data does not track what types of homes are being built versus what residents are looking for.

_Reviewer's note:_ Five figures. Sets permits (2020–2025) against population (2019–2024) and infers tightening, close to the causal storytelling the note warns against.

**Round 2** _(95 words, 3 figures)_

Between 2019 and 2024, the total population grew by 7.2% with no sampling error to reach 718,323, while the vacancy rate dropped 20.3% (give or take 6.4%), ranking among the state's largest tightening shifts across both measures. This pattern could indicate that the local housing stock absorbed more residents even as fewer homes remained unoccupied, leaving fewer empty options across the county. The clearest constraint on tracking this shift is that the five-year survey windows overlap across four shared years, which smooths out year-to-year swings and understates the separation between the start and end periods.

_Reviewer's note:_ Checked: population growth 3rd, vacancy drop near the top. "Vacancy rate dropped 20.3%" (a percent change in a rate) is hard to read; "from 8.3% to 6.6%" would be clearer.

## Sussex County, NJ

**On the page now, under "What's changing?"**

> The typical home value for a single-family home rose to $449,637. Over a similar period, the vacancy rate counting all empty homes fell to 8.1%, give or take 0.9 points.

**Round 1** _(99 words, 4 figures)_

Between 2020 and 2025, residential units permitted dropped from 225 to 181, even as the population estimate grew from 143,877 to 148,063 over a similar window from 2020 to 2025. One reading is that the local supply of new construction is slowing down while the overall population continues to expand, which may mean tighter competition and higher costs for incoming and existing residents looking for available housing. The biggest uncertainty in this picture is that building permits only track authorizations rather than completed homes, leaving out how many units were actually finished or added to the local housing supply.

_Reviewer's note:_ The same permits-against-population pattern as Hudson. "Higher costs" is inferred with no cost figure behind it. The caveat that permits are not completions is useful.

**Round 2** _(110 words, 2 figures)_

Sussex County stands near the very top of New Jersey for homeownership, with 83.7% of homes owned by their occupants, give or take 0.9 percentage points in 2024, while its overall population grew by just 3.1% with no sampling error between 2019 and 2024 to rank near the bottom of the state. One way to view this combination is that the county remains an exceptionally settled, owner-dominated community where few newcomers arrive, which shapes how community decisions are made and how stable local neighborhood ties remain. A limitation of this pattern is that the population growth figure has no sampling error reported to indicate the precision of its underlying count.

_Reviewer's note:_ Checked: second-highest homeownership. But "shapes how community decisions are made and how stable neighborhood ties remain" is unsupported. Its limitation sentence misreads "no sampling error".

## The prompts

### Round 1

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

Question after the packet: `The page already says, under "What's changing?": "<answer>"` then `Write the note.`

### Round 2

```text
You are writing a short "so what?" note about one place's housing, for a resident who
has already seen the figures on the page.

You are given a data packet for the region, the answer the page already gives under
"What's changing?", and the measures that answer quotes.

Write one paragraph of three or four sentences that:
- Opens with the pattern that most sets this county apart from New Jersey's other
  counties, judged by where its figures rank, rather than one that would be true of
  most counties. Connect two or three figures; do not list them.
- Adds something the "What's changing?" answer does not already say.
- Connects figures only when the periods they cover overlap, and says which years.
- States what the figures show, then gives at most one interpretation, marked as one,
  and says why it could matter to a resident. The interpretation may only be about
  what your figures measure: do not bring in prices, rents, competition, supply or
  costs unless you state a figure that measures them.
- Ends with the one limitation that most affects this pattern: a wide margin, an old
  survey year, or something the packet does not measure.

Rules:
- Use only figures from the packet, as the packet writes them or rounded to three
  significant digits ($445,000, $1,620) or a whole percentage. Never calculate a figure
  of your own. State at most three figures.
- Where you mention home values, rents, incomes, population or what renters pay, and
  the page's answer already quotes a measure of it, use that same measure. Never quote
  a second, different measure of the same thing: a reader would see two different
  "typical home values" side by side.
- A figure shown with ± is an estimate from a survey: give its margin in the same
  sentence, in plain words: "about $100,645 a year, give or take $2,565". Take the
  margin printed beside that very figure and copy it as printed, or round it to the
  nearest whole number. Where the packet says a figure has no sampling error, or that
  no margin is available, say so. A figure the packet shows with none of these is not
  a survey estimate: state it plainly.
- Where the packet gives a rank as a range, say where the range sits rather than any
  single rank.
- Do not claim causes, and say nothing about the wider economy, interest-rate policy
  or anything else the packet does not contain.
- Do not open with a span of years, and do not use the phrases "one reading",
  "this may mean" or "key limitation"; say it in your own words.
- Write for someone with no background in housing data: no names of sources, agencies,
  surveys or indexes, no abbreviations, and none of these words: median, percentile, cohort, CAGR, annualized, annualised, vintage, index, ratio, AMI, area median income, Fair Market Rent, FMR, income limit, cost burden, cost-burdened, net migration, parcel, basis points.
- Describe; do not advise.
- No heading, no preamble, no bullet lists, no bold.
```

Question after the packet: the page's answer as in round 1, then `It quotes these measures: <labels>.` and `Write the note.`

Raw trials: `data/sidebyside/synthesis-pilot/trials.jsonl` and `data/sidebyside/synthesis-pilot-v2/trials.jsonl`.
