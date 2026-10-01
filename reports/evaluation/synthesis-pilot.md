# Grounded synthesis pilot

Generated 2026-10-01 for the Director Note *Grounded synthesis beyond the automated data summary* (2026-09-29). Exploratory: nothing was stored, generation is unchanged, and no reading was regenerated.

Model: Gemini 3.7 Flash (low thinking), with the same packet (1.4, Markdown), Flex tier, gates and one revision that `hip explain` uses. The note was registered as a third format for these runs only. Gate results:
- Binding and survey margins: these gates **must pass** in every round.
- The consumer reading's plain-language checks: **reported only**.
- Two measures of the same thing beside each other, and measures that aren't about housing: **reported** in rounds 1–3.
- In round 4, the same two checks plus an opening date became **gates**: a note that broke one was sent back once for revision, as a published reading would be. None needed it.

Counties: Bergen, Mercer and Cumberland (the Milestone 30 comparison), plus Hudson, a renters' market, and Sussex, a rural one. Each prompt was given the county's published "What's changing?" answer and asked to add to it, not repeat it. Every rank claim in rounds 2–4 was checked by hand against the packet.

| Round | What changed in the prompt |
| --- | --- |
| 1 | Lead with the pattern that matters most, connect overlapping years, mark interpretation, name a limitation |
| 2 | Lead with what sets the county apart by rank; one measure per thing; one interpretation, limited to what the figures measure; template phrases banned |
| 3 | Exactly three sentences: a housing pattern, what it means in terms of those same figures, its limitation. No interpretation, and housing measures only |
| 4 | Round 3, plus: ranks only for where the county stands now, in plain words; a sale price and a typical home value count as one measure; begin with the county or the measure, never a date (now a gate) |

## Scores

Scored by Claude on 2026-10-01 at the owner's request, against the Director Note's four tests. ✓ holds, ◐ partly, ✗ does not.

- **Useful:** a resident learns something consequential.
- **Readable.**
- **New:** not already on the page.
- **Supported:** every claim follows from the figures stated.

| Round | Useful | Readable | New | Supported |
| --- | :-: | :-: | :-: | :-: |
| 1 | 3 ✓ 2 ◐ 0 ✗ | 3 ✓ 1 ◐ 1 ✗ | 5 ✓ 0 ◐ 0 ✗ | 1 ✓ 2 ◐ 2 ✗ |
| 2 | 3 ✓ 2 ◐ 0 ✗ | 2 ✓ 2 ◐ 1 ✗ | 5 ✓ 0 ◐ 0 ✗ | 1 ✓ 1 ◐ 3 ✗ |
| 3 | 5 ✓ 0 ◐ 0 ✗ | 2 ✓ 2 ◐ 1 ✗ | 5 ✓ 0 ◐ 0 ✗ | 5 ✓ 0 ◐ 0 ✗ |
| 4 | 4 ✓ 1 ◐ 0 ✗ | 4 ✓ 1 ◐ 0 ✗ | 5 ✓ 0 ◐ 0 ✗ | 4 ✓ 1 ◐ 0 ✗ |

| County | Round | Useful | Readable | New | Supported |
| --- | :-: | :-: | :-: | :-: | :-: |
| Bergen | 1 | ✓ | ✓ | ✓ | ◐ |
| Bergen | 2 | ✓ | ◐ | ✓ | ✗ |
| Bergen | 3 | ✓ | ◐ | ✓ | ✓ |
| Bergen | 4 | ✓ | ✓ | ✓ | ◐ |
| Mercer | 1 | ✓ | ✓ | ✓ | ◐ |
| Mercer | 2 | ✓ | ◐ | ✓ | ✓ |
| Mercer | 3 | ✓ | ◐ | ✓ | ✓ |
| Mercer | 4 | ◐ | ◐ | ✓ | ✓ |
| Cumberland | 1 | ✓ | ✗ | ✓ | ✓ |
| Cumberland | 2 | ◐ | ✓ | ✓ | ✗ |
| Cumberland | 3 | ✓ | ✗ | ✓ | ✓ |
| Cumberland | 4 | ✓ | ✓ | ✓ | ✓ |
| Hudson | 1 | ◐ | ◐ | ✓ | ✗ |
| Hudson | 2 | ✓ | ✗ | ✓ | ◐ |
| Hudson | 3 | ✓ | ✓ | ✓ | ✓ |
| Hudson | 4 | ✓ | ✓ | ✓ | ✓ |
| Sussex | 1 | ◐ | ✓ | ✓ | ✗ |
| Sussex | 2 | ◐ | ✓ | ✓ | ✗ |
| Sussex | 3 | ✓ | ✓ | ✓ | ✓ |
| Sussex | 4 | ✓ | ✓ | ✓ | ✓ |

## Conclusion

**Round 4 fixed all three of round 3's problems:**
- No note ranks a change.
- No note sets two home prices side by side.
- Every note opens with the county's name.

None of its twenty scores fails, and seventeen hold outright. Cumberland's note — lowest tax bill, most vacant land, rent near the bottom, and a limitation that turns the rent's margin into a rank range — is the best of the twenty.

What is left:
- **A narrowed measure.** Bergen says "vacant residential land" where the packet's share covers vacant land of every kind.
- **A second sentence that only says two things "coincided"** (Mercer).
- **Cost.** Three of the five calls thought for about 2,600 tokens and cost about $0.014 each, six times the others. Round 4 averaged $0.010 a county, so 21 counties would cost about $0.21 a regeneration: roughly as much as every other reading combined. A lower thinking budget, or Flash-Lite, would need its own trial.

Whether this becomes part of the published readings is the owner's decision. Nothing here changes generation.

## Cost

| Round | Cost, five counties |
| --- | ---: |
| 1 | $0.0214 |
| 2 | $0.0170 |
| 3 | $0.0263 |
| 4 | $0.0504 |

## Round 1 — gates and checks

| County | Gates | Revised | Words | Figures | Flags | Tier | Tokens out | Cost |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| Bergen | passed | 0 | 123 | 3 | none | standard | 168 | $0.0048 |
| Mercer | passed | 0 | 102 | 4 | over 3 figures | flex | 149 | $0.0024 |
| Cumberland | passed | 0 | 87 | 3 | mixed: survey home value beside Zillow's | standard | 132 | $0.0046 |
| Hudson | passed | 0 | 118 | 5 | over 3 figures | standard | 184 | $0.0050 |
| Sussex | passed | 0 | 99 | 4 | over 3 figures | standard | 142 | $0.0046 |

## Round 2 — gates and checks

| County | Gates | Revised | Words | Figures | Flags | Tier | Tokens out | Cost |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| Bergen | passed | 0 | 96 | 2 | jargon: 'parcel' in "…nd making up just 1.5% of all parcels in 2024. A resident…" | flex | 124 | $0.0024 |
| Mercer | passed | 0 | 104 | 4 | over 3 figures | standard | 161 | $0.0050 |
| Cumberland | passed | 0 | 124 | 3 | none | standard | 159 | $0.0048 |
| Hudson | passed | 0 | 95 | 3 | none | flex | 141 | $0.0025 |
| Sussex | passed | 0 | 110 | 2 | none | flex | 146 | $0.0024 |

## Round 3 — gates and checks

| County | Gates | Revised | Words | Figures | Flags | Tier | Tokens out | Cost |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| Bergen | passed | 0 | 85 | 2 | mixed: sr1a_median_sale_price beside zhvi_sfr | flex | 123 | $0.0024 |
| Mercer | passed | 0 | 92 | 2 | none | standard | 2,688 | $0.0144 |
| Cumberland | passed | 0 | 99 | 3 | none | flex | 148 | $0.0024 |
| Hudson | passed | 0 | 93 | 3 | none | flex | 135 | $0.0025 |
| Sussex | passed | 0 | 78 | 2 | none | standard | 109 | $0.0046 |

## Round 4 — gates and checks

| County | Gates | Revised | Words | Figures | Flags | Tier | Tokens out | Cost |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| Bergen | passed | 0 | 90 | 2 | none | standard | 2,713 | $0.0146 |
| Mercer | passed | 0 | 104 | 3 | none | flex | 149 | $0.0025 |
| Cumberland | passed | 0 | 98 | 3 | none | standard | 132 | $0.0048 |
| Hudson | passed | 0 | 105 | 2 | none | standard | 2,727 | $0.0147 |
| Sussex | passed | 0 | 91 | 2 | none | standard | 2,551 | $0.0138 |

## Bergen County, NJ

**On the page now, under "What's changing?"**

> Typical home values for single-family homes rose to $787,000. Over a similar period, typical rent increased to about $1,914 a month, give or take $21 a month. Both buying and renting have seen prices increase across the area.

**Round 1** _(123 words, 3 figures; useful ✓ · readable ✓ · new ✓ · supported ◐)_

Between 2019 and 2024, the local vacancy rate tightened from about 5.0%, give or take 0.3 percentage points, down to 3.9%, give or take 0.3 percentage points, while the share of renters paying more than 30% of their income toward housing reached 50.8%, give or take 1.5 percentage points. One reading of this connection is that an increasingly scarce supply of available homes may be leaving tenants with fewer affordable options, making it harder for residents to find housing that fits within standard budgets. A key limitation in these numbers is that the survey figures carry overlapping time spans that soften year-to-year shifts, and they do not track whether available units are concentrated in specific price tiers or property types across the county.

_Review:_ Half of renters paying over 30% of income, alongside fewer empty homes, all from the same survey years. "Fewer affordable options" goes a step past the figures. "Standard budgets" is vague.

**Round 2** _(96 words, 2 figures; useful ✓ · readable ◐ · new ✓ · supported ✗)_

Bergen County stands out across New Jersey for having among the state's highest housing tax bills alongside an exceptionally tight supply of unbuilt land, with typical annual property taxes of $12,038 ranking second and vacant land making up just 1.5% of all parcels in 2024. A resident might view this combination as an indication of an established, heavily developed landscape where public revenues rely on substantial local property assessments and opportunities for large-scale development are limited. These figures, however, do not reflect any property tax relief programs paid directly to individual homeowners, such as state credits.

_Review:_ Distinctive and checked: second-highest tax bill, least vacant land. "Parcels" is jargon. "Public revenues rely on substantial local property assessments" is speculation.

**Round 3** _(85 words, 2 figures; useful ✓ · readable ◐ · new ✓ · supported ✓)_

Bergen County ranks highest in New Jersey for recent transaction sale prices at $715,000 as of mid-2026, while carrying the state's second-highest typical property tax bill at $12,038 in 2024. This combination pairs top-of-the-market entry prices for buyers with exceptionally heavy recurring carrying costs compared to other counties. A key limitation of this picture is that the property tax figure is based on municipal tax records as levied, without accounting for state property tax relief programs that lower the net amount individual households actually pay.

_Review:_ Highest sale prices in the state and the second-highest tax bill: what it costs to buy, and then to keep, a home. Both checked. But it quotes a sale price ($715,000) next to a page answer quoting a typical value ($786,765), and a reader sees two home prices.

**Round 4** _(90 words, 2 figures; useful ✓ · readable ✓ · new ✓ · supported ◐)_

Bergen County pairs some of New Jersey's steepest recurring housing costs with its tightest land supply, recording the state's second-highest typical annual property tax bill at $12,038 in 2024 alongside the lowest share of vacant residential land at 1.5%. For someone buying in the county, this means managing some of the highest property tax bills in the state while navigating the lowest proportion of open residential land. That tax figure reflects what is billed before state property tax relief is credited and does not capture local assessment differences across municipalities.

_Review:_ Second-highest tax bill and the least vacant land in the state, both checked. No sale price this time. But it calls the measure "vacant residential land", while the packet's share counts vacant land of every kind: a narrowing the analyst prompt's rules forbid.

## Mercer County, NJ

**On the page now, under "What's changing?"**

> Residential building permits rose 94.1% over five years, putting the area near the top of New Jersey's 21 counties for new home construction approvals. At the same time, the typical single-family home value grew to $445,000.

**Round 1** _(102 words, 4 figures; useful ✓ · readable ✓ · new ✓ · supported ◐)_

Between 2019 and 2024, the vacancy rate dropped sharply from about 10.3%, give or take 0.6 percentage points, down to about 4.6%, give or take 0.5 points, while gross rent rose from about $1,266 a month, give or take $24, to about $1,623 a month, give or take $34. One reading is that available housing has tightened substantially even as new building approvals expanded, which may mean newcomers and current tenants face much stiffer competition for open homes. A major missing piece is that the survey data does not show which specific neighborhoods or towns within the county saw this inventory disappear.

_Review:_ Empty homes more than halved while rent rose, same survey years, each with its margin. "Stiffer competition" is inferred, not measured. Four figures.

**Round 2** _(104 words, 4 figures; useful ✓ · readable ◐ · new ✓ · supported ✓)_

Residential units permitted surged 94% between 2020 and 2025 to reach 1,611 approvals, ranking second among New Jersey's 21 counties, while the vacancy rate dropped from 10.3% give or take 0.6 points to 4.6% give or take 0.5 points between 2019 and 2024. A possible interpretation of this pattern is that new residential building expanded sharply even as unoccupied residential space was cut in half, which matters to residents tracking the availability of local housing. A major limitation is that the vacancy figures come from five-year survey estimates whose consecutive spans share four years of data, muting how cleanly the change reflects year-to-year shifts.

_Review:_ Permits 2nd in the state while empty homes halved, which follows. The overlapping-survey-years limitation is accurate but technical. Four figures.

**Round 3** _(92 words, 2 figures; useful ✓ · readable ◐ · new ✓ · supported ✓)_

Empty residences became notably scarcer between 2019 and 2024 as the vacancy rate fell from 10.3%, give or take 0.6 percentage points, to 4.6%, give or take 0.5 percentage points, placing the county near the bottom of New Jersey's 21 counties for this change. For someone renting or buying, this contraction means finding an unoccupied home is constrained by a far tighter pool of vacant properties than in 2019. However, the survey counts all unoccupied housing together without measuring how many of those empty properties were actually available to rent or purchase.

_Review:_ Empty homes fell from 10.3% to 4.6%, both ends with margins. The limitation is the best of round 3: the count includes homes that are not for rent or sale. But "near the bottom of New Jersey's 21 counties for this change" is a rank of a change, which means nothing to a resident.

**Round 4** _(104 words, 3 figures; useful ◐ · readable ◐ · new ✓ · supported ✓)_

Mercer County saw its vacancy rate drop from 10.3%, give or take 0.6 percentage points, to 4.6%, give or take 0.5 percentage points between 2019 and 2024, leaving its share of empty homes near the middle among New Jersey counties while the homeownership rate ended at 62.2%, give or take 1.1 percentage points. For someone looking to rent or buy, tighter available housing across those years coincided with an overall homeownership level that ranks seventeenth in the state. However, the five-year survey estimates for both the vacancy rate and homeownership overlap by four years, which masks how quickly housing conditions shifted year to year.

_Review:_ Every figure and rank checks out (empty homes near the middle, homeownership 17th). But the second sentence only says the two "coincided", which tells a resident nothing. "Ranks seventeenth" is the ordinal the prompt asked it to put in words.

## Cumberland County, NJ

**On the page now, under "What's changing?"**

> The typical single-family home value grew to $279,277, an increase of 35.0%. Meanwhile, the overall share of empty homes dropped significantly, though individual housing costs across the county continue to rise.

**Round 1** _(87 words, 3 figures; useful ✓ · readable ✗ · new ✓ · supported ✓)_

Between 2019 and 2024, typical home values rose 36.2% give or take 3.7%, reaching $221,400 give or take $4,674, while household incomes rose 24.5% give or take 5.2%. One reading is that home prices climbed faster than local earnings over those five years, which may mean buying a home has become more challenging for residents relying on local wages. However, the survey numbers carry notable uncertainty, with the income growth estimate ranging widely enough that the county cannot be clearly distinguished from most others in the state.

_Review:_ Home values rose faster than incomes over the same years, which follows directly. **But it quotes the survey's typical home value ($221,400) beside a page answer quoting another one ($279,277)**, with no explanation.

**Round 2** _(124 words, 3 figures; useful ◐ · readable ✓ · new ✓ · supported ✗)_

Cumberland County stands out from the rest of New Jersey for having the slowest population growth, rising just 0.9% with no sampling error to 153,305 residents between 2019 and 2024, alongside an unemployment rate of 7.2% in 2026 that ranks as the highest in the state. What these numbers show is a comparatively slack labor market paired with minimal resident additions. A possible interpretation is that community services and local businesses face less pressure from rapid headcount expansion than other parts of the state, though residents may navigate fewer local employment options. A notable limitation affecting these figures is that the population count and the unemployment rate come from different years and measuring systems that do not capture underlying commute patterns across county lines.

_Review:_ Checked: slowest population growth, highest unemployment. But it is about jobs, not housing, and "community services and local businesses face less pressure" is speculation.

**Round 3** _(99 words, 3 figures; useful ✓ · readable ✗ · new ✓ · supported ✓)_

Between 2019 and 2024, the typical monthly rent rose to $1,282, give or take $38, while the share of renters spending over 30% of their income on housing fell from 63.8% (give or take 3.6 percentage points) to 56.2% (give or take 4.4 percentage points). Although that payment share improved toward the top of New Jersey counties over that span, the county's overall renter payment level still places toward the bottom statewide. A key limitation is that these figures come from five-year survey windows that overlap across four years, which softens the actual separation between earlier and later estimates.

_Review:_ Renters paying over 30% of income fell from 63.8% to 56.2%, and its rank claims match the packet. But "the county's overall renter payment level still places toward the bottom" is garbled, and it opens with a span of years.

**Round 4** _(98 words, 3 figures; useful ✓ · readable ✓ · new ✓ · supported ✓)_

Cumberland County has the lowest typical annual property tax bill in the state at $4,563, alongside the highest share of vacant land at 14.1%, while its typical monthly rent of $1,282—give or take $38—ranks near the bottom among New Jersey counties as of 2024. For a buyer or renter, this means entering a housing market with lower recurring tax bills and lower rent levels compared to elsewhere in the state. The main limitation is that the survey estimate for monthly rent carries an uncertainty of $38, placing the county anywhere from nineteenth to lowest in statewide rent standings.

_Review:_ The state's lowest tax bill ($4,563) and most vacant land (14.1%), with rent near the bottom ($1,282, give or take $38). Its limitation correctly turns the margin into a rank range: anywhere from 19th to last. The best of the twenty.

## Hudson County, NJ

**On the page now, under "What's changing?"**

> Typical gross rent rose by about 36%, give or take 2%, placing the increase near the top of New Jersey's 21 counties. At the same time, residential units permitted fell by 52.0%.

**Round 1** _(118 words, 5 figures; useful ◐ · readable ◐ · new ✓ · supported ✗)_

Even as housing construction permits dropped by 52.0% between 2020 and 2025, the total population grew from 670,046 to 718,323 between 2019 and 2024, a figure with no sampling error. Over that same 2019 to 2024 span, the housing vacancy rate fell from about 8.3%, give or take 0.4 percentage points, down to about 6.6%, also give or take 0.4 percentage points. One reading is that steady population additions alongside declining construction may be tightening the available living space, which could leave residents facing an increasingly competitive search for places to live. A key limitation in this picture is that the data does not track what types of homes are being built versus what residents are looking for.

_Review:_ Five figures. Sets permits (2020–2025) against population (2019–2024) and infers tightening: close to a causal claim.

**Round 2** _(95 words, 3 figures; useful ✓ · readable ✗ · new ✓ · supported ◐)_

Between 2019 and 2024, the total population grew by 7.2% with no sampling error to reach 718,323, while the vacancy rate dropped 20.3% (give or take 6.4%), ranking among the state's largest tightening shifts across both measures. This pattern could indicate that the local housing stock absorbed more residents even as fewer homes remained unoccupied, leaving fewer empty options across the county. The clearest constraint on tracking this shift is that the five-year survey windows overlap across four shared years, which smooths out year-to-year swings and understates the separation between the start and end periods.

_Review:_ Checked: population growth 3rd, vacancy drop near the top. "The vacancy rate dropped 20.3%" (a percent change in a rate) is hard to read. "Absorbed more residents" is inferred.

**Round 3** _(93 words, 3 figures; useful ✓ · readable ✓ · new ✓ · supported ✓)_

Between 2019 and 2024, the county maintained the state's lowest rate of homeownership at 30.7%, give or take 0.6 percentage points, while the share of empty homes fell from 8.3% to 6.6%, with a margin of error of 0.4 percentage points at both ends. For someone looking for housing, this combination reflects an overwhelmingly renter-dominated market where finding an available home has become tighter. A key limitation of these figures is that the five-year survey windows overlap across consecutive measurements, which understates how much conditions truly changed from one period to the next.

_Review:_ The state's lowest homeownership (30.7%) and fewer empty homes (8.3% to 6.6%): a renters' market getting tighter. Both checked, both ends given. Opens with a span of years.

**Round 4** _(105 words, 2 figures; useful ✓ · readable ✓ · new ✓ · supported ✓)_

Hudson County has the lowest homeownership rate in New Jersey at 30.7%, give or take 0.6 percentage points, while the portion of renters paying over 30% of their income on housing ranked near the top statewide at 46.4%, give or take 1.2 percentage points, in 2024. For anyone renting or buying here, this reflects a market where renting is far more common than owning and where a large share of tenants put a substantial part of their income toward housing. A key limitation is that these numbers rely on survey responses collected over five years ending in 2024, which can smooth over sharper year-to-year changes.

_Review:_ Lowest homeownership (30.7%) and renters paying over 30% of income near the top (46.4%), both checked: a renters' county where many tenants are stretched.

## Sussex County, NJ

**On the page now, under "What's changing?"**

> The typical home value for a single-family home rose to $449,637. Over a similar period, the vacancy rate counting all empty homes fell to 8.1%, give or take 0.9 points.

**Round 1** _(99 words, 4 figures; useful ◐ · readable ✓ · new ✓ · supported ✗)_

Between 2020 and 2025, residential units permitted dropped from 225 to 181, even as the population estimate grew from 143,877 to 148,063 over a similar window from 2020 to 2025. One reading is that the local supply of new construction is slowing down while the overall population continues to expand, which may mean tighter competition and higher costs for incoming and existing residents looking for available housing. The biggest uncertainty in this picture is that building permits only track authorizations rather than completed homes, leaving out how many units were actually finished or added to the local housing supply.

_Review:_ The same permits-against-population pattern. "Higher costs" has no cost figure behind it. The note that permits are not completions is useful.

**Round 2** _(110 words, 2 figures; useful ◐ · readable ✓ · new ✓ · supported ✗)_

Sussex County stands near the very top of New Jersey for homeownership, with 83.7% of homes owned by their occupants, give or take 0.9 percentage points in 2024, while its overall population grew by just 3.1% with no sampling error between 2019 and 2024 to rank near the bottom of the state. One way to view this combination is that the county remains an exceptionally settled, owner-dominated community where few newcomers arrive, which shapes how community decisions are made and how stable local neighborhood ties remain. A limitation of this pattern is that the population growth figure has no sampling error reported to indicate the precision of its underlying count.

_Review:_ Checked: second-highest homeownership. "How community decisions are made and how stable neighborhood ties remain" is unsupported, and its limitation misreads "no sampling error".

**Round 3** _(78 words, 2 figures; useful ✓ · readable ✓ · new ✓ · supported ✓)_

Sussex County stands out for having New Jersey's second-highest homeownership rate at 83.7%, give or take 0.9 points, alongside one of the state's lowest tallies of new home construction, with 181 residential units permitted in 2025. This means buyers encounter a housing landscape dominated by existing owner-occupied properties where few additional homes are being added to the supply. A key limitation is that the building permits data counts authorized units rather than completed homes ready to be occupied.

_Review:_ Second-highest homeownership and 20th of 21 for homes permitted: an owners' county adding few homes. Checked. Limitation: permits are not completions.

**Round 4** _(91 words, 2 figures; useful ✓ · readable ✓ · new ✓ · supported ✓)_

Sussex County maintained the second-highest rate of homeownership in New Jersey at 83.7%, give or take 0.9 points in 2024, while its count of permitted residential homes reached 181 in 2025, among the lowest in the state over the 2020 to 2025 period. For buyers and renters, this means nearly all of the housing supply remains in owner hands with very few newly authorized homes being added. A key limitation is that permit records measure only construction approvals rather than homes that were actually completed and made available to live in.

_Review:_ Second-highest homeownership and among the fewest homes permitted, both checked. "Over the 2020 to 2025 period" blurs the 2025 count with the five-year span, but not into anything false.

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

### Round 3

```text
You are writing a short "so what?" note about one place's housing, for a resident who
has already seen the figures on the page.

You are given a data packet for the region, the answer the page already gives under
"What's changing?", and the measures that answer quotes.

Write exactly three sentences:
1. The housing pattern that most sets this county apart from New Jersey's other
   counties, judged by where its figures rank: connect two or three figures, do not
   list them. Use housing measures only: home values and sale prices, rents, what
   households pay for housing against their income, empty homes, homeownership, homes
   permitted, property tax bills, and the age and type of homes. Never population,
   jobs, unemployment or people moving.
2. What that pattern means for someone renting or buying here, said only in terms of
   those same figures: no new figure, no guess at why, and nothing about people,
   businesses, jobs or community life.
3. The one limitation that most affects this pattern: a wide margin, an old survey
   year, or something the packet does not measure.

Rules:
- Add something the "What's changing?" answer does not already say.
- Connect figures only when the periods they cover overlap, and say which years.
- Use only figures from the packet, as the packet writes them or rounded to three
  significant digits ($445,000, $1,620) or a whole percentage. Never calculate a figure
  of your own. State at most three figures.
- Where you mention home values, rents, incomes or what renters pay, and the page's
  answer already quotes a measure of it, use that same measure. Never quote a second,
  different measure of the same thing.
- A figure shown with ± is an estimate from a survey: give its margin in the same
  sentence, in plain words: "about $100,645 a year, give or take $2,565". Take the
  margin printed beside that very figure and copy it as printed, or round it to the
  nearest whole number. Where the packet says a figure has no sampling error, or that
  no margin is available, say so. A figure the packet shows with none of these is not
  a survey estimate: state it plainly.
- Where the packet gives a rank as a range, say where the range sits rather than any
  single rank.
- A change in a rate is clearer as its two ends ("from 8.3% to 6.6%") than as a
  percentage change of the rate.
- Do not claim causes, and say nothing about the wider economy, interest-rate policy
  or anything else the packet does not contain.
- Do not open with a span of years.
- Write for someone with no background in housing data: no names of sources, agencies,
  surveys or indexes, no abbreviations, and none of these words: median, percentile, cohort, CAGR, annualized, annualised, vintage, index, ratio, AMI, area median income, Fair Market Rent, FMR, income limit, cost burden, cost-burdened, net migration, parcel, basis points.
- Describe; do not advise.
- No heading, no preamble, no bullet lists, no bold.
```

### Round 4

```text
You are writing a short "so what?" note about one place's housing, for a resident who
has already seen the figures on the page.

You are given a data packet for the region, the answer the page already gives under
"What's changing?", and the measures that answer quotes.

Write exactly three sentences:
1. The housing pattern that most sets this county apart from New Jersey's other
   counties, judged by where its latest figures rank: connect two or three figures,
   do not list them. Begin with the county's name or the measure, never with a date,
   a span of years or "Between". Use housing measures only: home values and sale prices, rents, what
   households pay for housing against their income, empty homes, homeownership, homes
   permitted, property tax bills, and the age and type of homes. Never population,
   jobs, unemployment or people moving.
2. What that pattern means for someone renting or buying here, said only in terms of
   those same figures: no new figure, no guess at why, and nothing about people,
   businesses, jobs or community life.
3. The one limitation that most affects this pattern: a wide margin, an old survey
   year, or something the packet does not measure.

Rules:
- Add something the "What's changing?" answer does not already say.
- Connect figures only when the periods they cover overlap, and say which years.
- Use only figures from the packet, as the packet writes them or rounded to three
  significant digits ($445,000, $1,620) or a whole percentage. Never calculate a figure
  of your own. State at most three figures.
- Where you mention home values, rents, incomes or what renters pay, and the page's
  answer already quotes a measure of it, use that same measure. Never quote a second,
  different measure of the same thing. A sale price and a typical home value count as
  the same thing: a reader would see two home prices that seem to disagree.
- Give a rank only for where the county stands now, never for how much a figure
  changed: "the second-highest share of homeowners in New Jersey", not "near the
  bottom for this change". Say a rank in words a resident follows: highest, lowest,
  among the highest, near the middle.
- A figure shown with ± is an estimate from a survey: give its margin in the same
  sentence, in plain words: "about $100,645 a year, give or take $2,565". Take the
  margin printed beside that very figure and copy it as printed, or round it to the
  nearest whole number. Where the packet says a figure has no sampling error, or that
  no margin is available, say so. A figure the packet shows with none of these is not
  a survey estimate: state it plainly.
- Where the packet gives a rank as a range, say where the range sits rather than any
  single rank.
- A change in a rate is clearer as its two ends ("from 8.3% to 6.6%") than as a
  percentage change of the rate.
- Do not claim causes, and say nothing about the wider economy, interest-rate policy
  or anything else the packet does not contain.
- Write for someone with no background in housing data: no names of sources, agencies,
  surveys or indexes, no abbreviations, and none of these words: median, percentile, cohort, CAGR, annualized, annualised, vintage, index, ratio, AMI, area median income, Fair Market Rent, FMR, income limit, cost burden, cost-burdened, net migration, parcel, basis points.
- Describe; do not advise.
- No heading, no preamble, no bullet lists, no bold.
```

The question after the packet:
- Round 1: `The page already says, under "What's changing?": "<answer>"`, then `Write the note.`
- Rounds 2–4: the same, plus `It quotes these measures: <labels>.` before `Write the note.`

Raw trials: `data/sidebyside/synthesis-pilot{,-v2,-v3,-v4}/trials.jsonl`.
