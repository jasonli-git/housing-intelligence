# Readings side by side — gemini-first-v1

Generated 2026-09-30 by `hip eval readings`. Each model was given the prompt, packet (1.3, with margins and rank ranges), service tier and gates `hip explain` would give it, for 8 counties: Monmouth County, NJ, Hudson County, NJ, Atlantic County, NJ, Gloucester County, NJ, Burlington County, NJ, Sussex County, NJ, Passaic County, NJ, Warren County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What's changing?*; *What should I check before moving?*.

## Why this run

Run on 2026-09-30 for ARCHITECTURE #266, on the eight counties where Gemini 3.7 Flash's
readings were refused on 2026-09-28 — three analyst readings over rank ranges the
checker misread, two over margins, three consumer readings over jargon copied from the
packet's labels, and one over four figures in an answer. With the range check fixed, the
prompts naming those slips and the consumer reading down to two questions, every reading
published on the first answer; no revision was needed. Flex capacity was exhausted for
14 of the 16 calls, which were served at the standard rate after retries, and that
accounts for the cost. This section was added by hand after the run.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 8 of 8 | 8 of 8 | 8 of 8 | 0 | 88 | 3 | $0.0957 | 27.0 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not counted. The local model is not billed per token. Seconds are wall-clock, network included.

## Monmouth County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_80 words · 110 tokens out · 15.4s · $0.0046 · standard_

**What's changing?** _(2 figures)_

The typical single-family home value rose to $793,713, and the typical rent across all homes reached $2,867 per month. Overall housing availability tightened as the vacancy rate, which counts every empty home, fell across the region.

**What should I check before moving?** _(0 figures)_

These countywide figures cannot show local conditions on a specific street or property, including individual municipal tax assessments and tax relief programs. They also do not capture rental differences across specific neighborhoods or individual building types.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_388 words · 782 tokens out · 7.5s · $0.0069 · standard_

Monmouth County experienced substantial housing cost growth across both ownership and rental segments over the reported windows. The median owner-occupied home value rose by +43.7% (± 1.7%) from $421,900 (± $3,369) to $606,100 (± $5,540), placing its change near the top between 1st and 7th of 21 counties and its latest level at 2nd of 21. Single-family home values also increased, with the home value index rising 39.1% to $793,713, which ranks 2nd of 21. For rentals, median gross rent increased +30.6% (± 2.7%) from $1,399/mo (± $18/mo) to $1,827/mo (± $30/mo), ranking 6th of 21 among peers for its latest reading. Concurrently, the overall vacancy rate—which counts every empty home, not only rentals—declined by -31.0% (± 5.1%) down to 6.9% (± 0.4 points).

Income metrics also grew, though housing affordability indicators shifted. Median household income increased +25.2% (± 2.5%) from $99,733 (± $1,072) to $124,845 (± $2,115), placing its latest value near the top between 4th and 5th of 21 counties. The home value to household income ratio rose by +25.1% (± 2.5%) to 5.77× (± 0.10×), ranking near the bottom between 16th and 17th of 21 counties. Meanwhile, the share of renters paying over 30% of income on housing showed a change of -3.8% (± 4.8%) to 52.7% (± 2.2 points), though its change rank can't be told apart from most across 1st to 17th of 21 counties. In HUD CHAS data, which are tabulated from 2018–2022 microdata and describe earlier years without showing a change over time, 47.5% of renters (no margin available) and 26.6% of owners (no margin available) paid over 30% of income on housing.

Population and migration showed lower growth relative to peer counties. The total population reached 645,353 (no sampling error), a +3.8% (no sampling error) change that ranks 15th of 21. In Census estimates, the population estimate rose 1.3% to 651,035, ranking 20th of 21 counties at the bottom end. Net migration measured by tax returns dropped -108.2% from -843 to -1,755, ranking 20th of 21, though this change spans the 2022–2023 methodology update that matches about 5 percent more returns and reflects part of the shift. Residential construction activity expanded, with residential units permitted growing 72.0% from 1,949 to 3,352, ranking 3rd of 21 for total permits. The unemployment rate fell 38.8% to 4.1%, placing it 5th of 21.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_91 words · 125 tokens out · 101.0s · $0.0048 · standard_

**What's changing?** _(2 figures)_

Residential units permitted dropped by 52.0%, ranking near the bottom of New Jersey's 21 counties. At the same time, typical rent climbed by 36.2%, give or take 1.7%, placing its growth near the top of the state.

**What should I check before moving?** _(0 figures)_

These countywide numbers cannot tell you about the condition, exact property tax bill, or neighborhood rent for a specific address. You should inspect local municipal assessment rules and neighborhood prices, since tax bills vary by town and rent benchmarks cover broad regions rather than individual streets.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_406 words · 770 tokens out · 70.5s · $0.0070 · standard_

Hudson County has experienced substantial increases in housing costs and notable population growth alongside a sharp drop in building permits. Total population grew by 7.2% (no sampling error) from 670,046 (no sampling error) to 718,323 (no sampling error), ranking 3rd of 21 counties. During a similar period, residential units permitted dropped by 52.0% from 6,980 to 3,348, placing Hudson County at rank 20 of 21 for permit growth. Housing costs increased quickly: median gross rent climbed 36.2% ± 1.7% from $1,391/mo ± $12/mo to $1,894/mo ± $17/mo, which ranks between 1st and 2nd of 21 counties, near the top of the state. Meanwhile, median owner-occupied home value rose 42.8% ± 3.5% from $378,000 ± $5,120 to $539,700 ± $11,187, ranking toward the top between 1st and 8th of 21 counties.

Income measures and general economic indicators also shifted over their respective tracking windows. Median household income increased 28.9% ± 3.1% from $71,189 ± $1,089 to $91,795 ± $1,657, ranking toward the top between 1st and 12th of 21 counties. The unemployment rate fell by 44.7% from 7.6% to 4.2%, which ranks 1st of 21 counties. For lower-income benchmarks, HUD's low-income limit for an 80% AMI 4-person household grew 42.4% from $82,800 to $117,900, ranking 1st of 21. Net migration based on tax returns improved by 53.8% from -2,472 to -1,142 (ranking 7th of 21), though because the IRS updated its matching method from the 2022–2023 pair onward to capture roughly 5 percent more returns, part of this change reflects the new methodology rather than actual migration shifts.

In recent snapshots, Hudson County ranks near the top of New Jersey for overall rent levels but near the bottom in homeownership. The county's homeownership rate stood at 30.7% ± 0.6 points, ranking 21st of 21 counties. According to the observed rent index for all homes, rent reached $3,056/mo, ranking 1st of 21 counties, though this index covers fewer places and rests on a thinner base than home-value measures. In terms of affordability burdens, the share of renters paying over 30% of income on housing was 46.4% ± 1.2 points, ranking near the top between 1st and 6th of 21 counties. Older HUD CHAS baseline data from 2018–2022 (which carries no change over time and for which no margin is available) shows 41.6% (no margin available) of renters paying over 30% of income and 21.4% (no margin available) paying over 50% of income, both ranking 3rd of 21 counties.

## Atlantic County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_86 words · 112 tokens out · 29.0s · $0.0047 · standard_

**What's changing?** _(2 figures)_

Prices have risen substantially across the county for both buyers and renters. The single-family typical home value grew by 44.5%, while typical rents across all homes increased by 44.2%.

**What should I check before moving?** _(0 figures)_

You should look closely at local conditions, because these broad county figures do not reveal property tax differences between specific towns or neighborhoods. In addition, actual tax bills on an individual property may differ once state relief programs are applied, and local rental pricing can vary from countywide estimates.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_367 words · 685 tokens out · 29.3s · $0.0066 · standard_

Atlantic County experienced substantial price growth over its recent five-year tracking windows, leading the state in housing cost increases while trailing peers in income growth. The single-family home value index grew 44.5% to $385,559 (ranking 1st of 21 counties), and the observed rent index for all homes rose 44.2% to $2,059/mo (ranking 1st of 18 counties, resting on a smaller cohort than the home-value index). At the same time, HUD area median income increased by 17.3% to $97,500, ranking near the bottom at 20th of 21. This divergence caused housing affordability ratios to worsen relative to peers: the ratio of home value to area median income grew 25.5% to 3.92× (ranking worst at 21st of 21), and the ratio of annual rent to household income increased by 29.2% (± 4.4%) to 28.2% (± 0.7 points), ranking 17th of 17. 

Census survey measures similarly show rising costs alongside modest income gains. Median gross rent rose 22.9% (± 3.9%) to $1,376/mo (± $35/mo), while median owner-occupied home value rose 35.4% (± 3.0%) to $295,000 (± $5,138). Meanwhile, median household income grew 25.7% (± 4.3%) to reach $78,050 (± $1,834), which places the county near the bottom at between 19th and 20th of 21 counties for current income levels. The vacancy rate, which counts every empty home across the county, fell by 22.7% (± 4.1%) to 17.1% (± 0.7 points), though its current level still ranks near the top at between 2nd and 3rd of 21.

Broader labor and demographic metrics showed mixed trends. The unemployment rate dropped by 41.8% down to 5.3%, ranking 4th of 21 in improvement. Total population grew by 3.8% (no sampling error) to 276,270 (no sampling error), ranking 14th of 21. Net migration based on tax returns changed from -485 to -442, an 8.9% increase ranking 10th of 21; however, because this migration window spans 2022–2023, the change is partly due to an updated IRS matching method that captures about 5 percent more returns rather than solely a shift in moving patterns. In addition, HUD CHAS figures based on older 2018–2022 data indicate that 53.5% (no margin available) of renters and 29.7% (no margin available) of owners paid over 30% of their income toward housing.

## Gloucester County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_73 words · 110 tokens out · 11.9s · $0.0023 · flex_

**What's changing?** _(2 figures)_

The typical single-family home value grew to $385,868 across the county. Meanwhile, the vacancy rate covering all empty homes fell to 4.6%, give or take 0.5 percentage points.

**What should I check before moving?** _(1 figure)_

The countywide property tax figure of $7,235 will not reflect local assessment differences across specific towns or individual properties. You should also check specific neighborhood rent and pricing levels, as county-level numbers blend together very different communities.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_377 words · 721 tokens out · 17.6s · $0.0067 · standard_

Gloucester County experienced substantial growth in housing costs and inward migration over its recent five-year tracking periods. Net migration based on tax returns rose by 234.3%, shifting from -300 to 403 to rank 3rd of 21 counties, though changes spanning the 2022–2023 period partly reflect an updated IRS matching method that captures about 5 percent more returns. Total population grew by 5.4% (no sampling error) to 306,954 (no sampling error), ranking 6th of 21 counties for change. At the same time, the vacancy rate dropped by 39.7% (± 8.5%) to 4.6% (± 0.5 points), ranking between 7th and 17th of 21 counties for change, while residential units permitted grew 28.2% to 1,000 permits, ranking 8th of 21 counties.

Housing prices and rents climbed rapidly across the county. Median owner-occupied home value increased 41.3% (± 2.3%) to reach $310,400 (± $4,245), ranking toward the top between 2nd and 9th of 21 counties for change. The single-family home value index also grew 39.3% to $385,868, ranking 4th of 21 counties. On the rental side, the two-bedroom Fair Market Rent—which applies across the broader area set by HUD rather than this county alone—rose 43.7% to $1,810 per month, ranking 2nd of 21 counties. Median gross rent climbed 25.0% (± 5.4%) to $1,531 per month (± $56 per month), placing its change between 3rd and 20th of 21 counties.

These rising costs outpaced local household income gains, shifting affordability measures. While median household income rose 20.4% (± 3.9%) to $105,115 (± $2,579), the derived home value to household income ratio increased 35.9% (± 4.4%) to 3.38× (± 0.08×), and the annual rent to household income ratio rose 21.8% (± 4.0%) to 21.9% (± 0.5 points). Both ratios ranked near the bottom of their peer cohorts for change (between 15th and 21st of 21 counties, and between 13th and 16th of 17 counties, respectively). The share of renters paying over 30% of income on housing reached 55.0% (± 3.4 points), representing an increase of 3.0% (± 8.9%), which cannot be told apart from most peers at a change rank between 2nd and 21st of 21 counties. In HUD's single-snapshot CHAS data, 48.0% (no margin available) of renters and 23.2% (no margin available) of owners paid over 30% of their income on housing.

## Burlington County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_84 words · 110 tokens out · 11.7s · $0.0047 · standard_

**What's changing?** _(2 figures)_

The total population grew by 5% to 467,805 people, with no sampling error on either figure. During this time, both rents and home values increased across the county.

**What should I check before moving?** _(0 figures)_

Broad county figures cannot reveal neighborhood-level rental costs or the precise condition and tax bill of an individual home. You should also check local municipality tax assessments directly, because actual property bills depend on local assessments rather than countywide values and do not reflect personal state relief programs.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_391 words · 706 tokens out · 14.9s · $0.0067 · standard_

Burlington County experienced notable population and migration shifts alongside rising housing costs across its recent measurement windows. Total population grew by +5.0% (no sampling error) to reach 467,805 (no sampling error), placing it 7th of 21 New Jersey counties for change and 11th of 21 in total size. Net migration measured by tax returns shifted from -85 to 667, a +884.7% change that ranked 1st of 21 counties, though changes spanning the 2022–2023 pair reflect an updated IRS matching method that captures about 5 percent more returns rather than solely migration. Across all residential properties, the overall vacancy rate dropped by -32.8% ± 7.2% to 4.9% ± 0.4 points, ranking between 6th and 12th of 21 counties for change and between 9th and 13th of 21 for its latest level.

Housing prices and rents climbed substantially over the observed periods. Median owner-occupied home values rose +40.9% ± 2.0% to $354,000 ± $3,061, ranking toward the top for growth between 4th and 9th of 21 counties, even as the latest dollar figure ranked 15th of 21 statewide. The single-family home value index increased by 36.7% to $423,352, ranking 7th of 21 for growth. For renters, median gross rent grew +29.6% ± 2.9% to reach $1,745/mo ± $30/mo, which ranks toward the top for growth between 3rd and 12th of 21 counties and between 7th and 10th of 21 for current rent levels. Two-bedroom Fair Market Rent reached $1,810/mo after a 43.7% increase, ranking 2nd of 21 for growth, though Fair Market Rents represent area-wide standards shared across whole HUD areas rather than county-specific values alone.

These cost increases generally outpaced income growth, affecting housing affordability metrics. While median household income rose +23.7% ± 2.5% to $108,111 ± $1,600, the ratio of home value to household income widened by +29.2% ± 2.6% to 3.69× ± 0.05×, placing it near the top of the state between 3rd and 5th of 21 counties. The share of renters paying over 30% of income on housing rose to 52.5% ± 2.5 points, though due to sampling margins its current level cannot be told apart from most peers, ranking between 5th and 18th of 21 counties. Additionally, single-vintage HUD CHAS tabulations from 2018–2022 indicate that 23.6% (no margin available) of owners and 45.3% (no margin available) of renters were paying over 30% of their income toward housing costs.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_115 words · 162 tokens out · 32.0s · $0.0047 · standard_

**What's changing?** _(3 figures)_

Housing costs have risen across the area, with the typical home value reaching $450,000 and the vacancy rate, which counts all unoccupied homes, dropping to about 8.1%, give or take 0.9 points. As overall availability tightened, rent for all types of homes climbed to $2,220 a month.

**What should I check before moving?** _(1 figure)_

Countywide numbers cannot show local variations, so check the specific property tax bill for an individual address rather than relying on the typical $7,870 county bill, which reflects municipal assessments before any state relief programs. You should also inspect the neighborhood directly, as broad figures cannot reveal differences in neighborhood density, block-level rent levels, or the condition of older buildings.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_402 words · 816 tokens out · 10.4s · $0.0069 · standard_

In Sussex County, housing costs rose substantially across both ownership and rental segments over the reported windows. From 2019 to 2024, the median owner-occupied home value grew by +38.1% (± 2.5%) to $369,400 (± $4,606), which ranks toward the top for growth at between 7th and 12th of 21 counties, though its current value stands 14th of 21. Over the same timeframe, median household income rose by +22.9% (± 3.9%) to $116,186 (± $2,466), and the home value to household income ratio increased by +30.7% (± 4.1%) to 3.59× (± 0.08×). In the rental market between 2019 and 2024, median gross rent increased by +20.6% (± 6.4%) to $1,585/mo (± $67/mo), ranking toward the bottom for growth at between 9th and 21st of 21 counties, while the share of renters paying over 30% of income on housing rose by +12.5% (± 13.3%) to 54.9% (± 5.4 points). 

Housing supply and availability tightened as vacancy dropped and permitting slowed. The vacancy rate fell by -44.4% (± 7.5%) from 14.6% (± 1.1 points) in 2019 to 8.1% (± 0.9 points) in 2024, placing its current level 5th of 21 counties. Between 2020 and 2025, residential units permitted dropped by -19.6% from 225 to 181, ranking 16th of 21 in change and placing the latest level at 20th of 21 counties. The homeownership rate saw a change of +0.7% (± 1.4%), reaching 83.7% (± 0.9 points) in 2024, which ranks 2nd of 21 statewide. Total population grew +3.1% (no sampling error) between 2019 and 2024 to reach 145,807 (no sampling error), a rate of change ranking at the bottom end at 19th of 21 counties. 

Broader economic and market indicators show strengthening values and labor conditions alongside shifting migration counts. Between 2021 and 2026, the unemployment rate fell by -38.2% from 6.8% to 4.2% (ranking 6th of 21), and the single-family home value index grew +33.7% to $449,637 (ranking 13th of 21). Net migration measured by tax returns shifted by +204.3% from -94 to 98 between 2018 and 2023, ranking 4th of 21 for change and 5th of 21 for its latest level, though changes spanning the 2022–2023 period partly reflect an updated IRS matching method that captures about 5 percent more returns. Additionally, recent snapshot data shows HUD CHAS estimates where 25.5% (no margin available) of owners and 46.2% (no margin available) of renters paid over 30% of income on housing as of 2022.

## Passaic County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_89 words · 2,259 tokens out · 16.3s · $0.0127 · standard_

**What's changing?** _(2 figures)_

Residential units permitted fell by 56.2%. Meanwhile, the typical single-family home value rose by 34.6%. At the same time, fewer overall homes across the county remain empty.

**What should I check before moving?** _(1 figure)_

The annual property tax bill for a typical home of $10,756 reflects town assessments before household relief, so taxes will vary by municipality. Broad countywide metrics also cannot capture conditions on a specific street or pricing differences across individual neighborhoods. A prospective resident should review the exact property and its local municipal tax records.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_420 words · 784 tokens out · 13.7s · $0.0070 · standard_

Passaic County saw notable shifts across housing supply and labor metrics over recent tracking periods. Residential units permitted dropped sharply by 56.2% from 1,437 to 629 permits, representing the steepest decline in the state (ranked 21st of 21 counties). At the same time, the vacancy rate—which counts every empty home—fell by 43.8% (± 7.4%) from 6.6% (± 0.4 points) to 3.7% (± 0.4 points), placing the county's latest vacancy rate near the bottom of the state between 15th and 18th of 21 counties. Concurrently, the county experienced strong labor improvements as the unemployment rate fell 43.0% from 9.3% to 5.3%, ranking 3rd of 21 counties for change, though its latest reading still stands at 16th of 21 counties. Net migration based on tax returns moved from -2,128 to -2,927, though this comparison is affected by an updated IRS methodology starting with the 2022–2023 data that captures roughly 5 percent more returns.

Both housing values and rental costs rose substantially over the measured periods. Median owner-occupied home value grew 34.1% (± 1.5%) to $459,500 (± $3,736), placing the county near the middle for current value (between 9th and 10th of 21 counties). The single-family home value index also increased 34.6% to $599,502 (ranked 10th of 21 counties). In the rental market, median gross rent climbed 25.4% (± 1.8%) to $1,621 per month (± $17 per month), which ranks near the middle at 11th to 13th of 21 counties. The observed rent index for all homes rose 30.4% to $2,230 per month, ranking 13th among a smaller cohort of 21 counties with available data (18 counties in the change cohort), as this series rests on a thinner base of coverage.

Housing affordability pressures persist across the county as price growth outpaced income gains. Median household income increased 25.6% (± 4.2%) to $87,522 (± $2,333), placing it toward the bottom of the state at 14th to 17th of 21 counties. Because home values rose faster than earnings, the derived home value to household income ratio increased 19.2% (± 4.0%) to 6.22× (± 0.17×), ranking 18th of 21 counties. The homeownership rate remained largely flat, moving 0.6% (± 2.0%) to reach 53.1% (± 0.8 points), leaving the county ranked 19th of 21. Among renters, 57.0% (± 2.0 points) pay over 30% of their income on housing (ranked between 12th and 21st of 21 counties), while earlier HUD CHAS data from 2018–2022 indicates 33.2% (no margin available) of owners and 50.0% (no margin available) of renters paid over 30% of their income toward housing costs.

## Warren County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_84 words · 114 tokens out · 17.7s · $0.0024 · flex_

**What's changing?** _(2 figures)_

The vacancy rate dropped to 3.0%, give or take 1%, sitting near the bottom of New Jersey's 21 counties. Meanwhile, residential building permits rose to 576.

**What should I check before moving?** _(0 figures)_

These countywide figures cannot show conditions on an individual street or the specific property tax bill for a particular home, which follows local municipal assessments rather than overall market value. You should also check local neighborhood prices directly, since countywide rent and income standards do not capture differences between towns.

### Analyst reading

#### Gemini 3.7 Flash (low thinking) — would publish

_396 words · 767 tokens out · 33.1s · $0.0070 · standard_

Warren County experienced notable increases in housing costs alongside a tightening overall housing supply. The two-bedroom Fair Market Rent surged by 48.3% from $1,278 to $1,895 per month, ranking 1st of 21 counties in rate of increase, while the Observed rent index, all homes rose 35.9% to $2,075 per month, ranking 3rd of 18 counties. Over a separate window from 2019 to 2024, median gross rent climbed 24.5% (± 4.1%) to $1,409 per month (± $39 per month). Meanwhile, the vacancy rate—which counts every empty home, not just rentals—fell by 65.0% (± 9.0%) down to 3.0% (± 0.7 points), ranking near the bottom between 18th and 21st of 21 counties. Total population grew by 4.7% (no sampling error) to 110,849 (no sampling error), and residential units permitted increased by 89.5% from 304 to 576 units, ranking 4th of 21 counties.

Home values also rose substantially across the county. The single-family home value index grew 27.9% to $425,989, placing it toward the bottom at 19th of 21 counties for price growth. In survey measurements, median owner-occupied home value rose 31.2% (± 3.5%) to $346,500 (± $6,745), placing it toward the bottom between 10th and 20th of 21 counties for growth, while its current value ranks 16th of 21. The county's homeownership rate increased by 4.7% (± 2.6%) to reach 75.1% (± 1.5 points), ranking near the top between 1st and 7th of 21 counties for change and toward the top between 6th and 10th of 21 for its current level. 

Income metrics grew at a comparatively slower pace than several housing cost measures. Area median income (HUD) rose 15.2% from $111,000 to $127,900, ranking 21st of 21 counties, while median household income increased 24.1% (± 5.6%) to $100,869 (± $3,607), placing its rate of growth between 3rd and 21st of 21 counties where it cannot be told apart from most. As a result of these shifts, the derived home value to area median income ratio climbed 13.7% to 3.32×, ranking 20th of 21 in growth, and the home value to household income ratio rose 24.3% (± 5.6%) to 3.99× (± 0.14×). At the same time, the share of renters paying over 30% of income on housing moved to 47.6% (± 4.4 points), though its change of -4.2% (± 11.3%) was too uncertain to place among peers with a rank range between 1st and 21st of 21 counties.
