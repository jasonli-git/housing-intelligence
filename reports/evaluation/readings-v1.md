# Readings side by side — readings-v1

Generated 2026-09-27 by `hip eval readings`. Each model was given the prompt, packet (1.3, with margins and rank ranges), service tier and gates `hip explain` would give it, for 3 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *The bottom line*; *Is it getting harder to afford here?*; *How does renting compare with buying?*; *What's changing?*; *What should I check before moving?*.

## Decision

Decided with the owner on 2026-09-27, after reading the readings below (ARCHITECTURE
#262). The consumer reading is written first by **Gemini 3.7 Flash (low thinking)**, then
Gemini 3.1 Flash-Lite, DeepSeek V4.1 Flash and Gemma 4 E4B. Gemini 3.7 Flash was the one
model to answer each question with the comparison it asks for — home values against
incomes, rent against price — where Flash-Lite kept every rule with thinner answers that
repeat one pair of figures, and DeepSeek stated survey figures without their margins.
An answer may state three figures rather than two: at two, Gemini lost Bergen's reading
for a rent-or-buy answer the third figure made useful. The prompt still asks for two,
since a model asked for three wrote four and five. This run was judged at two figures,
so its counts below are as they stood then; this section was added by hand after it.

## Summary

| Model | Consumer published | …at 3 figures an answer | Analyst published | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| DeepSeek V4.1 Flash (thinking off) | 0 of 3 | 0 of 3 | 3 of 3 | — | 4 | $0.0120 | 3.5 |
| Gemini 3.7 Flash (low thinking) | 2 of 3 | 3 of 3 | 3 of 3 | 196 | 3 | $0.0178 | 5.5 |
| Gemini 3.1 Flash-Lite | 3 of 3 | 3 of 3 | 3 of 3 | 173 | 2 | $0.0054 | 3.1 |
| Gemma 4 E4B | 1 of 3 | 1 of 3 | 3 of 3 | 182 | 3 | — | 82.2 |

*…at 3 figures an answer* counts the consumer readings that would publish if an answer could state three figures rather than 2: those refused for figures per answer alone, with no answer over three.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not counted. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### DeepSeek V4.1 Flash (thinking off) — would be **refused**

_269 words · 340 tokens out · 2.7s · $0.0018_

> a survey figure stated without its margin in "…Yes. Typical rent rose about 27.1% while typical household incom…"

> a survey figure stated without its margin in "…ile typical household income rose about 23.5%, and the share of renters pay…"

> a survey figure stated without its margin in "…nters paying over 30% of income reached 50.8%. The gap between what people …"

> a survey figure stated without its margin in "…Typical rent is $1,914 a month, while the typical ho…"

> a survey figure stated without its margin in "… month, while the typical home value is $623,000. Annual rent works out to abo…"

> a survey figure stated without its margin in "…623,000. Annual rent works out to about 26.0% of household income, and the …"

> a survey figure stated without its margin in "…out 32.7% and the typical rent up about 27.1%. Few new homes are being adde…"

> jargon: 'income limit' in "…me, street, or municipality — income limits and rent standards …"

> 3 figures under 'Is it getting harder to afford here?', where at most 2 are allowed

> 4 figures under 'How does renting compare with buying?', where at most 2 are allowed

**The bottom line** _(0 figures)_

Bergen County is a high-cost place where both rents and home values have climbed faster than incomes, and the typical home now costs several times what a typical household earns. It remains a relatively low-unemployment area with a tight supply of available homes.

**Is it getting harder to afford here?** _(3 figures)_

Yes. Typical rent rose about 27.1% while typical household income rose about 23.5%, and the share of renters paying over 30% of income reached 50.8%. The gap between what people earn and what housing costs has widened.

**How does renting compare with buying?** _(4 figures)_

Typical rent is $1,914 a month, while the typical home value is $623,000. Annual rent works out to about 26.0% of household income, and the home value is about 5.59 times household income.

**What's changing?** _(2 figures)_

Home values and rents have both risen sharply, with the typical home value up about 32.7% and the typical rent up about 27.1%. Few new homes are being added relative to the size of the county, and more people have been leaving than arriving.

**What should I check before moving?** _(0 figures)_

These figures are county-wide, so they cannot tell you about a particular home, street, or municipality — income limits and rent standards are set for the whole county and are not meant to be applied to one town. The property tax figure is an average bill before any relief a household might receive, and it follows each town's own assessments, so check the actual bill and assessment for a specific address. Rent figures also rest on a thinner base than home-value figures, so treat them with more caution.

#### Gemini 3.7 Flash (low thinking) — would be **refused**

_185 words · 271 tokens out · 2.2s · $0.0026 · flex_

> 3 figures under 'How does renting compare with buying?', where at most 2 are allowed

> 3 figures under 'What's changing?', where at most 2 are allowed

**The bottom line** _(0 figures)_

Bergen County has high housing costs for both buyers and renters, supported by high local incomes and a strong job market.

**Is it getting harder to afford here?** _(2 figures)_

Housing costs have risen faster than household earnings over the past five years. Typical home values grew by 32.7%, give or take 1.2%, while typical household incomes grew by 23.5%, give or take 2.3%.

**How does renting compare with buying?** _(3 figures)_

A typical home recently sold for $715,000, with an annual property tax bill of $12,038 on a typical home. Meanwhile, typical rent across all available homes stands at $2,899 a month.

**What's changing?** _(3 figures)_

Residential construction permits increased by 1.9% to 3,803 units. The local unemployment rate also dropped significantly, falling by 43.5% over the five-year period.

**What should I check before moving?** _(0 figures)_

These countywide figures cannot show how property taxes vary across individual towns, nor do they reflect neighborhood-level rental prices or the exact condition and age of a specific home. You should also check local school districts and neighborhood municipal assessments, as broad county data hides large differences between individual streets and communities.

#### Gemini 3.1 Flash-Lite — would publish

_169 words · 246 tokens out · 1.5s · $0.0009 · flex_

**The bottom line** _(0 figures)_

Housing costs have risen significantly, making this one of the most expensive areas in the state. Typical home values and rents are both at the high end of the regional spectrum.

**Is it getting harder to afford here?** _(2 figures)_

Yes, the typical gross rent has increased to $1,914 a month, give or take $21. The typical home value has also climbed to $623,000, give or take $4,306.

**How does renting compare with buying?** _(2 figures)_

The typical monthly rent is $1,914, give or take $21. The typical home value is $623,000, give or take $4,306.

**What's changing?** _(1 figure)_

The area is seeing a steady rise in both home values and rental prices. Meanwhile, the vacancy rate has dropped to 3.9%, give or take 0.3 percentage points.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the condition of a specific home or the character of a particular street. They also do not account for local property tax relief programs or variations in rent standards between different neighborhoods.

#### Gemma 4 E4B — would publish

_182 words · 1,952 tokens out · 92.5s · —_

**The bottom line** _(1 figure)_

The region has seen significant increases in both housing costs and typical income. The typical annual rent is about 26.0% of the typical household income, give or take 0.4 points.

**Is it getting harder to afford here?** _(2 figures)_

The typical gross rent increased by 27.1% (give or take 2.3%), while the typical household income increased by 23.5% (give or take 2.3%). This shows that housing costs have risen faster than typical income.

**How does renting compare with buying?** _(2 figures)_

The typical monthly rent is $1,914 (give or take $21). The typical owner-occupied home value is $623,000 (give or take $4,306).

**What's changing?** _(2 figures)_

The vacancy rate has decreased by 22.0% (give or take 7.0%). The total population has increased by 3.4% (no sampling error).

**What should I check before moving?** _(0 figures)_

Be aware that some housing cost figures are based on a smaller group of places than the home value figures. The property tax bill is the total tax levied, before any relief paid to individual households. Some housing cost figures are based on data from earlier years than the newest income figures.

### Analyst reading

#### DeepSeek V4.1 Flash (thinking off) — would publish

_433 words · 768 tokens out · 4.2s · $0.0022_

Bergen County's housing market has gotten more expensive on both sides of the ledger. Median gross rent rose from $1,506/mo (± $21/mo) to $1,914/mo (± $21/mo), a 27.1% (± 2.3%) increase, while the median owner-occupied home value climbed from $469,500 (± $2,664) to $623,000 (± $4,306), up 32.7% (± 1.2%). Median household income also grew, from $101,144 (± $1,300) to $124,884 (± $1,735), a 23.5% (± 2.3%) rise — so values and rents both outpaced income over the same 2019-to-2024 window. The county's current median home value of $623,000 (± $4,306) ranks 1st of 21, and its typical recent sale price of $715,000 also ranks 1st, though the change in home values ranks only 11th–18th of 21 (toward the bottom), meaning peers have been catching up rather than Bergen slowing down.

Affordability pressure shows up in the ratios. The home value to household income ratio went from 5.06× (± 0.07×) to 5.59× (± 0.08×), a 10.5% (± 2.1%) increase that ranks 2nd–5th of 21 (near the top). Annual rent to household income rose from 24.4% (± 0.3 points) to 26.0% (± 0.4 points), and the share of renters paying over 30% of income went from 48.0% (± 1.4 points) to 50.8% (± 1.5 points) — a change of +5.8% (± 4.4%), wide enough that the direction is clearer than the size. HUD's separate CHAS tabulation, which carries no margin available and describes 2022, puts 44.8% of renters over the 30% threshold and 23.9% over 50%. The two-bedroom Fair Market Rent to household income ratio sits at 19.9% (± 0.3 points), ranking 4th–7th of 21 (near the top).

Supply and labor look tight in different ways. The vacancy rate fell from 5.0% (± 0.3 points) to 3.9% (± 0.3 points), a 22.0% (± 7.0%) drop ranking 3rd–7th of 21 (near the top), and the unemployment rate fell 43.5% to 3.9%, ranking 2nd of 21 — the county's strongest showing in the packet. Population grew 3.4% (no sampling error) to 962,316, ranking 1st of 21, yet net migration on tax returns was -2,294, ranking 18th of 21, and that figure spans a 2022-2023 method change that added about 5 percent more returns, so part of the shift is measurement rather than movement. Residential units permitted rose just 1.9% to 3,803, and the median home was built in 1954, with vacant land at 1.5% of parcels — last of 21. One caution on ranks: many of these survey measures carry margins wide enough that the county cannot be separated from most peers, and ACS vintages overlap by four years, so short-window changes understate the real separation.

#### Gemini 3.7 Flash (low thinking) — would publish

_416 words · 719 tokens out · 3.2s · $0.0033 · flex_

Bergen County stands out for a strong labor market alongside some of the highest housing costs in New Jersey. The county's unemployment rate fell by 43.5% down to 3.9%, ranking 2nd of 21 counties in the state. At the same time, the typical sale price from recent transactions reached $715,000, ranking 1st of 21 counties, and the single-family home value index reached $786,765, ranking 3rd of 21. For renters, the observed rent index reached $2,899 per month, which ranks 2nd of 18 peer areas, though this index covers fewer places and rests on a thinner base than home-value metrics. Additionally, the annual property tax bill for a typical home was $12,038—ranking 2nd of 21 counties—though this reflects the tax as levied before state relief programs like ANCHOR and is based on municipal assessments rather than uniform market values.

Over the five-year survey window, housing costs grew faster than household incomes. The median owner-occupied home value rose 32.7% (± 1.2%) to $623,000 (± $4,306), placing it between 11th and 18th of 21 counties for growth, while median gross rent climbed 27.1% (± 2.3%) to $1,914 per month (± $21 per month), which cannot be told apart from most peers at a rank between 3rd and 17th of 21. In comparison, median household income grew 23.5% (± 2.3%) to $124,884 (± $1,735). Because home values outpaced earnings, the home value to household income ratio rose 10.5% (± 2.1%) to 5.59× (± 0.08×), ranking near the top for growth between 2nd and 5th of 21 counties, though this ratio is derived by the platform rather than published directly by survey sources.

These cost pressures are reflected in tightening supply and high cost burdens. The residential vacancy rate dropped 22.0% (± 7.0%) to 3.9% (± 0.3%), placing it toward the bottom of the state between 14th and 16th of 21 counties. Meanwhile, the share of renters paying over 30% of their income on housing rose to 50.8% (± 1.5%), ranking toward the top between 4th and 14th of 21 counties. Earlier HUD CHAS baseline estimates indicate that 29.0% (no margin available) of owners and 44.8% (no margin available) of renters paid over 30% of income on housing. Overall population rose 3.4% (no sampling error) to 962,316 (no sampling error), while net migration showed a net loss of 2,294 tax returns, ranking 18th of 21, though changes across this migration series partly reflect an updated IRS matching method that captures about 5 percent more returns rather than shifts in migration alone.

#### Gemini 3.1 Flash-Lite — would publish

_204 words · 374 tokens out · 2.4s · $0.0009 · flex_

Bergen County’s housing market has experienced significant price appreciation and rising costs for residents over the five-year window. Median owner-occupied home values rose by 32.7% (± 1.2%) to $623,000 (± $4,306), while median gross rents increased by 27.1% (± 2.3%) to $1,914/mo (± $21/mo). During this same period, median household income grew by 23.5% (± 2.3%) to $124,884 (± $1,735).

These shifts have placed upward pressure on housing affordability. The share of renters paying over 30% of their income on housing rose by 5.8% (± 4.4%) to 50.8% (± 1.5%). Additionally, the ratio of home value to household income increased by 10.5% (± 2.1%) to 5.59× (± 0.08×), a figure that ranks near the top of the state. While the region maintains a strong economic position with an unemployment rate of 3.9%—ranking 2nd of 21 counties—it also faces a tight housing supply, with a vacancy rate that fell 22.0% (± 7.0%) to 3.9% (± 0.3%).

It is important to note that American Community Survey estimates, such as those for homeownership and income, are subject to overlapping vintages, meaning consecutive measurements are not independent. Furthermore, because HUD changed its Fair Market Rent standards during the reporting period, figures spanning that time reflect two different methodologies.

#### Gemma 4 E4B — would publish

_239 words · 1,528 tokens out · 73.8s · —_

The region has experienced substantial appreciation in housing wealth and income over the past five years. The median owner-occupied home value increased by +32.7% ± 1.2% between 2019-12-31 and 2024-12-31, and the current median value is $623,000 ± $4,306, ranking 1st of 21 counties. Similarly, the median household income rose by +23.5% ± 2.3% over the same period, reaching $124,884 ± $1,735, which ranks 4th–5th of 21 counties (near the top). This strong income growth has been reflected in the home value to household income ratio, which increased by +10.5% ± 2.1% and ranks 2nd–5th of 21 counties (near the top).

However, cost increases are also pronounced. The median gross rent saw a significant rise of +27.1% ± 2.3% over the five-year window, reaching $1,914/mo ± $21/mo, which ranks 2nd–4th of 21 counties (near the top). This cost pressure is evident in the annual rent to household income ratio, which rose by +6.5% ± 2.0% and ranks 2nd–7th of 17 (toward the top). Furthermore, the percentage of renters paying over 30% of income on housing increased by +5.8% ± 4.4% over the period.

From a market perspective, the region shows signs of tightening supply and demand. The vacancy rate dropped by -22.0% ± 7.0% over the five years, ranking 3rd–7th of 21 counties (near the top). While the total population increased by +3.4% (no sampling error), the net migration, tax returns, declined by -8.2% (2018-2023), ranking 12th of 21.

## Mercer County, NJ

### Consumer reading

#### DeepSeek V4.1 Flash (thinking off) — would be **refused**

_208 words · 289 tokens out · 2.7s · $0.0018_

> a survey figure stated without its margin in "…Yes. Typical rent rose about 28.2% while typical household incom…"

> a survey figure stated without its margin in "…ile typical household income rose about 24.2%, and the share of income a ty…"

> a survey figure stated without its margin in "…typical renter spends on rent went from 24.7% to 28.1%.…"

> a survey figure stated without its margin in "…enter spends on rent went from 24.7% to 28.1%.…"

> a survey figure stated without its margin in "…t 94.1%, and the vacancy rate fell from 10.3% to 4.6%. The county also lost…"

> a survey figure stated without its margin in "…and the vacancy rate fell from 10.3% to 4.6%. The county also lost about 1…"

> 3 figures under 'Is it getting harder to afford here?', where at most 2 are allowed

> 3 figures under 'How does renting compare with buying?', where at most 2 are allowed

> 4 figures under 'What's changing?', where at most 2 are allowed

**The bottom line** _(0 figures)_

Mercer County is a middle-of-the-pack New Jersey county where both rents and home values have climbed faster than incomes, and new construction has picked up sharply.

**Is it getting harder to afford here?** _(3 figures)_

Yes. Typical rent rose about 28.2% while typical household income rose about 24.2%, and the share of income a typical renter spends on rent went from 24.7% to 28.1%.

**How does renting compare with buying?** _(3 figures)_

Typical rent is $1,623 a month, give or take $34, while the typical home value is $377,700, give or take $6,110. The typical home costs about 4.26 times typical household income, give or take 0.11 times.

**What's changing?** _(4 figures)_

Residential building permits jumped about 94.1%, and the vacancy rate fell from 10.3% to 4.6%. The county also lost about 1,900 people to moves within the state and country in the most recent year counted.

**What should I check before moving?** _(0 figures)_

These figures are county-wide, so they cannot tell you about a particular home, street, or town. The rent figures rest on a thinner base than the home-value figures, and the affordability comparisons are built from two separate published series rather than one. The property tax figure is the bill as levied, before any relief paid to individual households.

#### Gemini 3.7 Flash (low thinking) — would publish

_194 words · 295 tokens out · 2.3s · $0.0027 · flex_

**The bottom line** _(1 figure)_

Mercer County has seen housing costs climb alongside notable growth in new residential construction. A typical household income is about $100,645 a year, give or take $2,565, while local home values and rents sit near the middle of New Jersey's 21 counties.

**Is it getting harder to afford here?** _(2 figures)_

Housing costs have outpaced income growth over recent years. A typical home value rose by 29.7%, give or take 2.8%, while typical rents climbed by 28.2%, give or take 3.6%.

**How does renting compare with buying?** _(2 figures)_

A typical home recently sold for $435,000, with no margin available for this non-survey figure. For those leasing, typical monthly rent is about $1,623, give or take $34.

**What's changing?** _(2 figures)_

Residential building permits expanded sharply over the five-year window, increasing by 94.1%. At the same time, the rental vacancy rate dropped to 4.6%, give or take 0.5 points.

**What should I check before moving?** _(0 figures)_

These countywide figures cannot show variations in municipal property tax assessments, specific neighborhood conditions, or the pricing on individual streets. You should also check local housing availability directly, as countywide standards do not reflect differences across specific towns or smaller neighborhood zones.

#### Gemini 3.1 Flash-Lite — would publish

_203 words · 274 tokens out · 2.8s · $0.0009 · flex_

**The bottom line** _(0 figures)_

Housing costs have risen significantly in recent years, with both typical home values and rents increasing. The region is seeing a high level of new residential construction to accommodate its growing population.

**Is it getting harder to afford here?** _(1 figure)_

Yes, the typical household income is about $100,645 a year, give or take $2,565, but housing costs have outpaced this growth. A large portion of residents now spend a significant share of their earnings on their monthly housing payments.

**How does renting compare with buying?** _(2 figures)_

The typical home value is $445,000, while the typical monthly rent is $2,513. These figures reflect the current market for single-family homes and all rental properties respectively.

**What's changing?** _(2 figures)_

The region is experiencing a surge in development, with residential units permitted increasing by 94%. Meanwhile, the vacancy rate has dropped to 4.6%, give or take 0.5 points, indicating a tighter market for available homes.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the condition of a specific property or the character of an individual street. You should also investigate local property tax variations and whether your potential home is located in an area that uses different rent standards than the county-wide average.

#### Gemma 4 E4B — would be **refused**

_205 words · 1,754 tokens out · 83.8s · —_

> jargon: 'median' in "… the property tax bill is the median total tax across on…"

**The bottom line** _(0 figures)_

The region has seen significant growth in both income and housing costs. While the typical home value is high, the cost of renting is also rising quickly.

**Is it getting harder to afford here?** _(2 figures)_

The annual rent compared to household income is 28.1% give or take 0.7 points. The typical home value is 4.26 times the household income, give or take 0.11 times. These figures show the relationship between housing costs and income.

**How does renting compare with buying?** _(2 figures)_

The typical monthly rent is $1,623 give or take $34. The typical owner-occupied home value is $377,700 give or take $6,110. These figures show the current cost difference between renting and owning.

**What's changing?** _(2 figures)_

Over the last five years, the typical monthly rent increased by 28.2% give or take 3.6%. During the same period, the typical household income increased by 24.2% give or take 4.0%.

**What should I check before moving?** _(0 figures)_

These figures do not account for the specific details of a particular home or street. They also do not account for the fact that the property tax bill is the median total tax across one- to four-family homes, and it is the bill as levied before any relief paid to individual households.

### Analyst reading

#### DeepSeek V4.1 Flash (thinking off) — would publish

_497 words · 873 tokens out · 4.8s · $0.0024_

Mercer County's housing market over this window shows a county adding people and homes while costs outpace the incomes that would cover them. Total population rose from 367,922 to 385,864, a 4.9% increase with no sampling error, and the Census Bureau's population estimate puts the county at 399,289 as of 2025, up 3.3% since 2020. Residential units permitted climbed from 830 to 1,611, a 94.1% increase that ranks 2nd of 21 counties. Against that, median household income rose 24.2% (± 4.0%), from $81,057 (± $1,626) to $100,645 (± $2,565), while median gross rent rose 28.2% (± 3.6%), from $1,266/mo (± $24/mo) to $1,623/mo (± $34/mo), and median owner-occupied home value rose 29.7% (± 2.8%), from $291,100 (± $4,075) to $377,700 (± $6,110). The ratio of home value to household income went from 3.38× (± 0.07×) to 4.26× (± 0.11×), a 26.2% (± 4.1%) increase, and annual rent as a share of household income rose from 24.7% (± 0.5 points) to 28.1% (± 0.7 points).

Several of these changes are survey estimates with wide margins, and the packet cautions that ACS 5-year vintages overlap by four years, so consecutive readings are not independent and short windows understate the real separation. That caution matters most where ranks are given as ranges: median household income sits between 3rd and 20th of 21, median gross rent between 3rd and 15th, and the homeownership rate between 7th and 21st, meaning the survey cannot place the county more precisely than "can't be told apart from most." The home-value-to-income ratio ranks between 10th and 15th of 21, toward the bottom, and annual rent to household income between 7th and 12th of 17, also toward the bottom. The county's current median household income of $100,645 (± $2,565) ranks between 10th and 12th of 21, near the middle, and its current median gross rent of $1,623/mo (± $34/mo) ranks between 11th and 13th, also near the middle.

The packet also shows where Mercer stands out in both directions. HUD's area median income rose 30.9% to $139,800, ranking 3rd of 21, and the 80% AMI low-income limit for a four-person household rose 33.7% to $106,800, ranking 8th. But the two-bedroom Fair Market Rent rose 26.7% to $1,950/mo, ranking 20th of 21, and the unemployment rate, though down 29.4% to 4.8%, ranks 20th of 21. The vacancy rate fell 54.9% (± 5.9%), from 10.3% (± 0.6 points) to 4.6% (± 0.5 points), ranking between 16th and 20th. Net migration by tax returns went from -1,191 to -1,900, a 59.5% decline in the net outflow, ranking 16th of 21 — though the packet notes IRS changed its matching method from the 2022-2023 pair onward, so part of any change spanning that year reflects method rather than movement. The share of renters paying over 30% of income was 50.1% (± 2.3 points) in the latest ACS reading, and HUD's CHAS tabulation, which carries no margin and describes earlier years, puts 46.8% of renters and 24.1% of owners over that threshold.

#### Gemini 3.7 Flash (low thinking) — would publish

_418 words · 769 tokens out · 3.0s · $0.0034 · flex_

Over the tracked windows, Mercer County experienced substantial housing construction alongside tightening market conditions and rising housing costs. Residential building permits surged by 94.1% from 830 to 1,611 units between 2020 and 2025, ranking 2nd out of 21 New Jersey counties for permit growth and placing 7th in current permit volume. At the same time, the rental vacancy rate fell by 54.9% (± 5.9%) to reach 4.6% (± 0.5 points), a change ranking near the bottom between 16th and 20th of 21 counties. Total population grew by 4.9% (with no sampling error) to 385,864 (with no sampling error), ranking 8th of 21 in growth, while IRS migration showed net outflows expanding from -1,191 to -1,900 tax returns (ranking 16th of 21), though this migration change is partly influenced by an IRS matching methodology update that captures roughly 5 percent more returns.

Housing costs and incomes have both climbed across the county. Median household income increased by 24.2% (± 4.0%) to reach $100,645 (± $2,565), ranking in the middle between 10th and 12th of 21 counties. Meanwhile, median owner-occupied home values grew by 29.7% (± 2.8%) to $377,700 (± $6,110), ranking 13th of 21 in current value, and single-family home values according to Zillow's index rose 34.4% to $445,078. On the rental side, median gross rent went up 28.2% (± 3.6%) to $1,623 per month (± $34 per month), while HUD's two-bedroom Fair Market Rent rose 26.7% to $1,950 per month, ranking 20th of 21 in growth. Zillow's observed rent index, which covers a smaller cohort of 18 counties on a thinner base of data, rose 32.3% to $2,513 per month.

These cost increases have kept cost burdens substantial for local residents, as affordability ratios calculated directly from published monthly value or rent series and annual incomes show worsening leverage. The ratio of home values to household income rose by 26.2% (± 4.1%) to 4.26× (± 0.11×), ranking in the middle between 8th and 9th of 21 counties, while annual rent rose to 28.1% (± 0.7 points) of household income (ranking toward the bottom between 12th and 16th of 19 counties). The share of renters paying over 30% of their income on housing remained elevated at 50.1% (± 2.3 points), ranking toward the top between 3rd and 14th of 21 counties, alongside earlier HUD CHAS data showing 46.8% (no margin available) of renters and 24.1% (no margin available) of owners experiencing cost burdens above 30%. Homeownership stood at 62.2% (± 1.1 points), placing the county 17th of 21 peers.

#### Gemini 3.1 Flash-Lite — would publish

_175 words · 326 tokens out · 3.0s · $0.0009 · flex_

Mercer County has seen significant growth in residential development, with residential units permitted rising by 94.1% between 2020 and 2025, ranking the region 2nd of 21 counties in New Jersey. Over the same period, the area median income (HUD) increased by 30.9% to $139,800, placing the county 3rd of 21. Despite these gains, the region’s unemployment rate fell by 29.4% to 4.8%, though it remains at the bottom of the cohort, ranking 20th of 21.

Housing costs have also risen, with the median gross rent increasing by 28.2% (± 3.6 percentage points) to $1,623/mo (± $34/mo) between 2019 and 2024. The median owner-occupied home value grew by 29.7% (± 2.8 percentage points) to $377,700 (± $6,110) over the same window. Because Fair Market Rent figures are set by federal fiscal year and were subject to a methodology change by HUD in 2020, these figures should be read with caution. Additionally, the county’s vacancy rate dropped by 54.9% (± 5.9 percentage points) to 4.6% (± 0.5 percentage points), ranking it near the bottom of the state.

#### Gemma 4 E4B — would publish

_236 words · 1,712 tokens out · 81.6s · —_

Over the past five-year window, the region has experienced significant increases in both housing costs and income. The median household income rose by +24.2% ± 4.0% between 2019-12-31 and 2024-12-31, while the Area median income (HUD) saw a +30.9% increase over the 2021-2026 window. However, housing costs have risen even faster; the Observed rent index, all homes, increased by +32.3% between 2021-08-31 and 2026-08-31. This cost pressure is reflected in the Two-bedroom Fair Market Rent to household income ratio, which rose by +12.2% ± 3.6% over the 2019-2024 period. Furthermore, the median owner-occupied home value increased by +29.7% ± 2.8% during the same period.

Market supply indicators show a strong upward trend, with residential units permitted increasing by +94.1% over the 2020-2025 window, ranking 2nd of 21. This supply growth contrasts with a sharp decline in the vacancy rate, which dropped by -54.9% ± 5.9% between 2019-12-31 and 2024-12-31, placing the region near the bottom of its peer group for this metric. Demographically, the total population grew by +4.9% (no sampling error) between 2019-12-31 and 2024-12-31, though net migration declined by -59.5% between 2018-12-31 and 2023-12-31.

Overall, the region shows signs of increasing housing demand and supply capacity, as evidenced by the high percentage increase in permitted units. However, the rapid appreciation in housing values and rents, coupled with a decline in net migration, suggests a tightening and potentially strained housing market relative to income growth.

## Cumberland County, NJ

### Consumer reading

#### DeepSeek V4.1 Flash (thinking off) — would be **refused**

_207 words · 285 tokens out · 2.9s · $0.0017_

> a survey figure stated without its margin in "…Typical household income rose about 24.5% while the typical home value …"

> a survey figure stated without its margin in "…while the typical home value rose about 36.2%, so buying has pulled ahead o…"

> a survey figure stated without its margin in "…The typical rent is $1,282 a month, while the typical ho…"

> a survey figure stated without its margin in "… month, while the typical home value is $221,400. A typical two-bedroom rent r…"

> 3 figures under 'Is it getting harder to afford here?', where at most 2 are allowed

> 3 figures under 'How does renting compare with buying?', where at most 2 are allowed

> 4 figures under 'What's changing?', where at most 2 are allowed

**The bottom line** _(0 figures)_

Cumberland County is one of New Jersey's cheapest places to buy or rent, but local incomes are also among the state's lowest, so affordability is mixed rather than easy.

**Is it getting harder to afford here?** _(3 figures)_

Typical household income rose about 24.5% while the typical home value rose about 36.2%, so buying has pulled ahead of earnings. The share of renters paying over 30% of income fell to 56.2%, though that figure comes with a margin of about 4.4 points.

**How does renting compare with buying?** _(3 figures)_

The typical rent is $1,282 a month, while the typical home value is $221,400. A typical two-bedroom rent runs about 28.3% of household income, give or take 0.8 points.

**What's changing?** _(4 figures)_

Home values climbed about 35.0% on the single-family measure, and the typical sale price now sits at $250,000. New building is modest: 193 residential units were permitted, and the population grew just 0.9%, with no sampling error.

**What should I check before moving?** _(0 figures)_

These figures are county-wide, so they cannot tell you about a particular home, street, or municipality. Property taxes vary by town and are shown before any relief a household may receive, and the rent figures rest on a thinner base than the home-value figures.

#### Gemini 3.7 Flash (low thinking) — would publish

_197 words · 289 tokens out · 9.9s · $0.0026 · flex_

**The bottom line** _(0 figures)_

Housing costs and household incomes in Cumberland County are among the lowest in New Jersey. Home values and rents have both risen over the past five years, but remain low compared to the rest of the state.

**Is it getting harder to afford here?** _(2 figures)_

Typical household income grew by an estimated 24.5%, give or take 5.2%, over five years. However, typical home values increased faster, rising by an estimated 36.2%, give or take 3.7%.

**How does renting compare with buying?** _(2 figures)_

A typical monthly rent is estimated at about $1,282, give or take $38. For buyers, the typical owner-occupied home value is estimated at about $221,400, give or take $4,674.

**What's changing?** _(2 figures)_

The rental vacancy rate dropped by an estimated 39.7%, give or take 10.1%, over five years. At the same time, the unemployment rate declined to 7.2%, though it remains the highest among New Jersey counties.

**What should I check before moving?** _(0 figures)_

Countywide figures cannot reveal specific neighborhood conditions, individual home prices, or differences across local school districts. Property taxes also depend on each municipality's local assessments rather than county averages, and broader rental figures do not reflect neighborhood-level voucher standards or rent variations.

#### Gemini 3.1 Flash-Lite — would publish

_146 words · 222 tokens out · 4.3s · $0.0008 · flex_

**The bottom line** _(0 figures)_

Housing costs have risen significantly in recent years, though the region remains one of the more affordable areas in the state.

**Is it getting harder to afford here?** _(2 figures)_

The typical home value has increased to $221,400, give or take $4,674. Meanwhile, the typical household income has grown to $67,436, give or take $1,985.

**How does renting compare with buying?** _(2 figures)_

The typical monthly rent is $1,282, give or take $38. The typical home value is $221,400, give or take $4,674.

**What's changing?** _(2 figures)_

The number of residential building permits issued has grown by 38%. The unemployment rate has fallen by 26%.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the condition of a specific property or the character of an individual street. They also do not account for local property tax relief programs or variations in housing costs between different neighborhoods.

#### Gemma 4 E4B — would be **refused**

_211 words · 1,472 tokens out · 74.3s · —_

> jargon: 'index' in "… Also, remember that the rent index uses a thinner base…"

> jargon: 'ratio' in "…e or take 8.5%). However, the ratio of two-bedroom Fair…"

> jargon: 'Fair Market Rent' in "…ver, the ratio of two-bedroom Fair Market Rent to household income…"

> 3 figures under 'What's changing?', where at most 2 are allowed

**The bottom line** _(1 figure)_

Housing costs are rising, but household income has increased by 24.5% (give or take 5.2%). The cost of owning a home has risen faster than the cost of renting.

**Is it getting harder to afford here?** _(2 figures)_

The percentage of renters paying over 30% of income on housing has decreased by 12.0% (give or take 8.5%). However, the ratio of two-bedroom Fair Market Rent to household income has increased by 1.5% (give or take 4.3%).

**How does renting compare with buying?** _(2 figures)_

The typical cost of owning a home has increased by 36.2% (give or take 3.7%). In comparison, the typical cost of renting has increased by 19.9% (give or take 5.3%).

**What's changing?** _(3 figures)_

The typical household income has increased by 24.5% (give or take 5.2%). The total population has increased by 0.9% (no sampling error). Additionally, the number of residential units permitted has increased by 37.9%.

**What should I check before moving?** _(0 figures)_

You should check that the property tax bill is the typical total tax across one- to four-family homes, and that the tax bill is the amount levied before any relief paid to individual households. Also, remember that the rent index uses a thinner base and ranks against a smaller group of places than the home value index.

### Analyst reading

#### DeepSeek V4.1 Flash (thinking off) — would publish

_344 words · 642 tokens out · 3.7s · $0.0021_

Cumberland County's housing market over these windows shows prices and incomes rising together, but from a low base and with the county still at or near the bottom of its 21-county peer group on most levels. Median owner-occupied home value rose 36.2% (± 3.7%), from $162,500 (± $2,756) to $221,400 (± $4,674), while median household income rose 24.5% (± 5.2%), from $54,149 (± $1,622) to $67,436 (± $1,985). Because values grew faster than incomes, the home-value-to-household-income ratio climbed 33.3% (± 5.6%), from 2.94× (± 0.09×) to 3.92× (± 0.12×). Even so, the county's current median home value and median household income both rank 21st of 21, and its typical sale price of $250,000 ranks 20th of 21.

Rents and the broader affordability picture are mixed. Median gross rent rose 19.9% (± 5.3%), from $1,069/mo (± $35/mo) to $1,282/mo (± $38/mo), ranking 19th–21st of 21 by current value. The share of renters paying over 30% of income fell 12.0% (± 8.5%), from 63.8% (± 3.6 points) to 56.2% (± 4.4 points), though the margin is wide enough that the current figure ranks anywhere from 9th to 21st. HUD's CHAS tabulation, which carries no margin available and describes earlier years, puts 54.0% of renters over 30% of income and 31.7% over 50%, both 21st of 21. The two-bedroom Fair Market Rent-to-income ratio sits at 28.3% (± 0.8 points), ranking 17th–19th of 21.

On the HUD series, which run on different windows, area median income rose 32.2% to $89,100 (rank 2 of 21), yet the two-bedroom Fair Market Rent rose 23.7% to $1,673/mo and the 80% AMI low-income limit rose 26.6% to $78,000 — both ranking 21st of 21. Population grew just 0.9% (no sampling error) on the ACS window, ranking 21st of 21, and the population estimate rose 2.2% to 157,148. Net migration from tax returns improved from -572 to -84, though the packet notes the 2022-2023 method change inflates that comparison. Unemployment fell 25.8% to 7.2%, still 21st of 21. Residential units permitted rose 37.9% to 193, but that current level ranks 19th of 21.

#### Gemini 3.7 Flash (low thinking) — would publish

_365 words · 711 tokens out · 12.3s · $0.0033 · flex_

Cumberland County ranks among the lowest in New Jersey for housing costs and household earnings, even as values and incomes have grown. Between 2019 and 2024, median household income rose by 24.5% (± 5.2%) to $67,436 (± $1,985), which ranks 21st of 21 counties in the state. Over that same period, median owner-occupied home values grew by 36.2% (± 3.7%) to $221,400 (± $4,674), also ranking 21st of 21. By 2026, HUD area median income reached $89,100—up 32.2% over five years, which was the 2nd-fastest growth in the state, though the overall level remains 21st of 21. Meanwhile, single-family home values according to the Zillow index reached $279,277 (21st of 21) after a 35.0% rise.

Rent and overall housing cost burdens show a mixed picture. Median gross rent climbed 19.9% (± 5.3%) between 2019 and 2024 to $1,282 per month (± $38 per month), placing it between 19th and 21st of 21 counties. The share of renters paying over 30% of their income on housing decreased by 12.0% (± 8.5%) to 56.2% (± 4.4 points). However, HUD CHAS data from 2018–2022—which describe earlier years and have no margin available—show that 54.0% of renters paid over 30% of income and 31.7% paid over 50%, both ranking 21st of 21 across the state. Two-bedroom Fair Market Rent rose 23.7% to $1,673 per month by late 2026, which remains the lowest (21st of 21) among New Jersey county areas.

Economic indicators and housing supply metrics reflect modest overall expansion. Total population reached 153,305 (no sampling error), an increase of 0.9% (no sampling error), representing the lowest population growth rate (21st of 21) in New Jersey. The unemployment rate fell from 9.7% to 7.2% (a 25.8% decrease), though at 7.2% it remains the highest unemployment rate in the state (21st of 21). Net migration improved from -572 to -84 tax returns, though changes spanning the 2022–2023 period partly reflect an updated IRS matching method that captures about 5 percent more returns. Residential building permits rose 37.9% from 140 to 193 units (19th of 21), while the typical annual property tax bill on a home stood at $4,563 (21st of 21), as levied before individual relief programs such as ANCHOR.

#### Gemini 3.1 Flash-Lite — would publish

_246 words · 433 tokens out · 4.4s · $0.0010 · flex_

Cumberland County’s housing market shows significant growth in costs alongside a challenging economic environment. Between 2019 and 2024, the median owner-occupied home value rose by 36.2% (± 3.7%) to $221,400 (± $4,674), while the median household income increased by 24.5% (± 5.2%) to $67,436 (± $1,985). Despite these gains, the region ranks at the bottom of its 21-county cohort for several key economic indicators, including the most recent unemployment rate of 7.2% (no sampling error) and the median household income.

Housing affordability remains a pressure point for residents. The ratio of home value to household income climbed to 3.92× (± 0.12×), placing the county between 14th and 21st of 21 counties. While the share of renters paying over 30% of their income on housing decreased by 12.0% (± 8.5%), the county still ranks toward the bottom of the cohort for this metric. Additionally, the region’s Fair Market Rent for a two-bedroom unit reached $1,673/mo (no sampling error), which ranks 21st of 21 counties.

The region’s population growth has been minimal, with a 0.9% increase (no sampling error) over the five-year window, ranking 21st of 21. While the vacancy rate dropped by 39.7% (± 10.1%) to 6.1% (± 0.8 points), the county continues to see a high share of vacant land at 14.1% (no sampling error), ranking 1st of 21. Note that these figures are subject to various caveats, including the fact that ACS estimates overlap and HUD’s Fair Market Rent standards shifted during the reporting period.

#### Gemma 4 E4B — would publish

_294 words · 1,830 tokens out · 87.5s · —_

Over the observed window, the region has seen significant growth in both income and housing values. The Area median income (HUD) increased by +32.2%, rising from $67,400 to $89,100, placing the region 2nd of 21 in its peer group. Median household income also rose substantially by +24.5% ± 5.2%, moving from $54,149 ± $1,622 to $67,436 ± $1,985. Housing values have also appreciated, with the median owner-occupied home value increasing by +36.2% ± 3.7%, from $162,500 ± $2,756 to $221,400 ± $4,674. Furthermore, the unemployment rate improved by -25.8%, dropping from 9.7% to 7.2%, and the number of residential units permitted increased by +37.9%, from 140 to 193.

Despite the income and value gains, housing costs have risen, though the rate of increase varied. Median gross rent increased by +19.9% ± 5.3%, from $1,069/mo ± $35/mo to $1,282/mo ± $38/mo. The two-bedroom Fair Market Rent also rose by +23.7%, from $1,353/mo to $1,673/mo. In terms of affordability, the home value to household income ratio increased by +33.3% ± 5.6%, from 2.94× ± 0.09× to 3.92× ± 0.12×, placing the region toward the bottom of its peer group. Conversely, the vacancy rate saw a sharp decline of -39.7% ± 10.1%, falling from 10.1% ± 1.0 points to 6.1% ± 0.8 points.

Demographically, the region's total population saw a modest increase of +0.9%, from 151,906 (no sampling error) to 153,305 (no sampling error), ranking 21st of 21. However, net migration, based on tax returns, showed a strong rebound of +85.3%, increasing from -572 to -84, ranking 5th of 21. The analysis is subject to several caveats, including that the Area median income (HUD) is a county figure, and that the median household income and median owner-occupied home value are survey estimates with associated margins of error.
