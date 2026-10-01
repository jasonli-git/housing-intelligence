# Readings side by side — readings-v2

Generated 2026-10-01 by `hip eval readings`. Each model was given the prompt, packet (1.4, with margins and rank ranges), service tier and gates `hip explain` would give it, for 5 counties: Bergen County, NJ, Mercer County, NJ, Cumberland County, NJ, Hudson County, NJ, Sussex County, NJ. Nothing was stored; a reading marked *refused* is shown with the rule it broke. A refused answer goes back to its model with the refusal, up to `generation.revisions` times, as it would in `hip explain`; each such refusal is listed above the reading. The consumer reading's model is chosen from this (ROADMAP, Milestone 30).

The consumer reading answers, in this order: *What's changing?*; *What should I check before moving?*.

## Summary

| Model | Consumer published | …at 4 figures an answer | Analyst published | Published after a revision | Consumer words | Figures per answer, most | Cost | Seconds, mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.7 Flash (low thinking) | 5 of 5 | 5 of 5 | 0 of 0 | 0 | 88 | 3 | $0.0117 | 6.4 |
| Gemini 3.1 Flash-Lite | 4 of 5 | 4 of 5 | 0 of 0 | 0 | 72 | 3 | $0.0047 | 1.9 |
| DeepSeek V4.1 Flash (thinking off) | 4 of 5 | 4 of 5 | 0 of 0 | 2 | 106 | 4 | $0.0065 | 2.6 |

*…at 4 figures an answer* counts the consumer readings that would publish if an answer could state one figure more than 3: those refused for figures per answer alone, with no answer over the new limit.

Cost is what each model's generations here would bill, at the tier the provider says served them and, for DeepSeek, the hour they ran — an upper bound, since prompt-cache discounts are not counted. The local model is not billed per token. Seconds are wall-clock, network included.

## Bergen County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_98 words · 140 tokens out · 10.8s · $0.0024 · flex_

**What's changing?** _(3 figures)_

The typical single-family home value grew to $786,765, reflecting an increase of about 33%. Over a similar period, the vacancy rate counting every empty home declined to 3.9%, give or take 0.3 points.

**What should I check before moving?** _(1 figure)_

You should look into local municipality details, because countywide figures cannot show specific neighbourhood conditions or how individual towns assess properties for the typical $12,038 property tax bill before state relief. Furthermore, county standards for rent and income cannot reveal street-level rental prices or whether housing assistance in a particular neighbourhood relies on smaller local payment amounts.

#### Gemini 3.1 Flash-Lite — would publish

_79 words · 113 tokens out · 1.2s · $0.0008 · flex_

**What's changing?** _(2 figures)_

The typical home value has risen to $623,000, give or take $4,306. Meanwhile, the typical gross rent has increased to $1,914 a month, give or take $21.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the specific condition of a property or the characteristics of a particular street. Because property tax bills are based on local assessments rather than market value, you should also verify the tax status for any home you consider.

#### DeepSeek V4.1 Flash (thinking off) — would publish

_99 words · 131 tokens out · 2.0s · $0.0008_

**What's changing?** _(3 figures)_

Typical gross rent rose to $1,914 a month, give or take $21, and the typical home value reached $623,000, give or take $4,306. The vacancy rate fell to 3.9%, meaning fewer empty homes of every kind are available.

**What should I check before moving?** _(0 figures)_

These figures describe the whole county, so they cannot tell you about a particular home, street, or neighborhood. The property tax bill shown is a countywide typical figure before any relief paid to individual households, and it follows each municipality's own assessments, so check the actual bill and assessment for a specific address.

## Mercer County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_75 words · 109 tokens out · 2.0s · $0.0023 · flex_

**What's changing?** _(3 figures)_

The typical single-family home value rose to $445,000, while residential units permitted grew by 94% to reach 1,611. Meanwhile, typical rents and household incomes both saw substantial increases across the county.

**What should I check before moving?** _(0 figures)_

These countywide numbers cannot reveal property tax bills for specific addresses, which depend on local town assessments rather than overall market values. They also do not capture neighborhood-level rent differences or the condition of individual properties.

#### Gemini 3.1 Flash-Lite — would publish

_63 words · 87 tokens out · 2.1s · $0.0008 · flex_

**What's changing?** _(2 figures)_

The typical home value has risen to $445,078. Meanwhile, the number of residential units permitted has increased by 94.1%.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the specific condition of a property or the characteristics of a particular street. Because some data relies on broad area standards or older records, you should verify local details yourself.

#### DeepSeek V4.1 Flash (thinking off) — would publish

_105 words · 256 tokens out · 2.9s · $0.0016_

_Answer 1 refused and sent back for revision:_ a survey figure stated without its margin in "… jumped 94.1%. The vacancy rate fell to 4.6%, meaning far fewer empty home…"

**What's changing?** _(3 figures)_

The typical home value for a single-family home rose to $445,078, and the number of residential units permitted jumped 94.1%. The vacancy rate fell to 4.6%, give or take 0.5 percentage points, meaning far fewer empty homes than before.

**What should I check before moving?** _(0 figures)_

These figures describe the whole county, not a particular home or street, and the property tax bill shown is an average across one- to four-family homes before any relief a household may receive. Rent figures rest on a thinner base than home values, and the affordability measures are built from two separate published series rather than reported directly.

## Cumberland County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_83 words · 125 tokens out · 6.5s · $0.0023 · flex_

**What's changing?** _(3 figures)_

Single-family typical home values increased by 35.0% over recent years, reaching $279,277. Meanwhile, the countywide vacancy rate fell significantly, dropping to an estimated 6.1%, give or take 0.8%.

**What should I check before moving?** _(0 figures)_

These countywide figures cannot tell you about local tax rates or specific property bills, which follow municipal assessments rather than overall market values and exclude individual tax relief programs. They also do not capture specific neighborhood rent standards or street-by-street differences across individual towns and postal areas.

#### Gemini 3.1 Flash-Lite — would publish

_80 words · 105 tokens out · 1.2s · $0.0008 · flex_

**What's changing?** _(2 figures)_

The typical home value has risen by 35.0% over the last few years. Meanwhile, the vacancy rate for all homes has dropped by 39.7%, give or take 10%.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the specific condition of a home or the character of a particular street. Because property tax bills are based on local assessments rather than market value, you should also verify the tax costs for any property you consider.

#### DeepSeek V4.1 Flash (thinking off) — would publish

_112 words · 154 tokens out · 1.7s · $0.0008_

**What's changing?** _(3 figures)_

Typical rent is $1,282 a month, give or take $38, and the typical home value is $221,400, give or take $4,674. Both have risen since 2019, and the share of empty homes fell to 6.1%, give or take 0.8 percentage points.

**What should I check before moving?** _(0 figures)_

These figures are county-wide, so they cannot tell you about a particular home or street. The property tax bill shown is an average across one- to four-family homes and follows each municipality's own assessments, so check the actual bill and assessment for any address. Rent figures also rest on a thinner base than home values, and the affordability measures are county-level, not neighborhood-level.

## Hudson County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_89 words · 113 tokens out · 8.0s · $0.0024 · flex_

**What's changing?** _(2 figures)_

Residential units permitted fell by 52.0%, while total population grew by 7.2% with no sampling error. At the same time, typical gross rent rose significantly across the area.

**What should I check before moving?** _(0 figures)_

Before moving, check local property tax assessments and individual neighbourhood rent levels directly, as these countywide totals cannot tell you what a specific property or street will cost. You should also confirm whether a particular home receives local tax relief programs or sits in a specific postal code with different rental assistance standards.

#### Gemini 3.1 Flash-Lite — would publish

_68 words · 93 tokens out · 2.1s · $0.0008 · flex_

**What's changing?** _(2 figures)_

The typical home value has risen by 42.8%, give or take 3.5%. Meanwhile, the number of residential units permitted has dropped by 52.0%.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the condition of a specific property or the character of an individual street. Because the data relies on broad averages, it does not capture the unique features of a particular home.

#### DeepSeek V4.1 Flash (thinking off) — would be **refused**

_97 words · 271 tokens out · 3.3s · $0.0017_

_Answer 1 refused and sent back for revision:_ a survey figure stated without its margin in "…Typical gross rent rose 36.2% to $1,894 a month, give or ta…"; a survey figure stated without its margin in "…$17, and the number of empty homes fell 20.3% to a vacancy rate of 6.6%. Ty…"; a survey figure stated without its margin in "…y homes fell 20.3% to a vacancy rate of 6.6%. Typical home values also cli…"; 5 figures under 'What's changing?', where at most 3 are allowed

> a survey figure stated without its margin in "…Typical gross rent rose 36.2% to $1,894 a month, give or ta…"

> a survey figure stated without its margin in "…take $17. The share of empty homes fell 20.3% to a vacancy rate of 6.6%, gi…"

> 4 figures under 'What's changing?', where at most 3 are allowed

**What's changing?** _(4 figures)_

Typical gross rent rose 36.2% to $1,894 a month, give or take $17. The share of empty homes fell 20.3% to a vacancy rate of 6.6%, give or take 0.4 percentage points.

**What should I check before moving?** _(0 figures)_

These figures are county-wide, so they cannot tell you about a particular home or street, and the income figures behind the affordability measures are county figures not meant to be applied to one town. Rent figures also rest on a thinner base than home-value figures, and some counts describe earlier years than the newest ones beside them.

## Sussex County, NJ

### Consumer reading

#### Gemini 3.7 Flash (low thinking) — would publish

_97 words · 128 tokens out · 4.7s · $0.0023 · flex_

**What's changing?** _(2 figures)_

Housing costs have risen alongside general growth across the area. Over recent five-year periods, the typical single-family home value rose to $449,637, while the typical rent for all homes reached $2,221 per month.

**What should I check before moving?** _(0 figures)_

You should look into local property tax assessments for an individual address, because local tax bills follow municipal valuations rather than overall market values and do not reflect personal relief programs. You should also check specific neighborhood rental prices and local income standards, since regional measures cover broad geographic areas rather than single towns or streets.

#### Gemini 3.1 Flash-Lite — would be **refused**

_76 words · 202 tokens out · 3.0s · $0.0015 · flex_

_Answer 1 refused and sent back for revision:_ a survey figure stated without its margin in "…ate for every empty home has dropped by 44.4%, give or take 8%.…"

> a survey figure stated without its margin in "…ate for every empty home has dropped by 44.4%, give or take 8%.…"

**What's changing?** _(3 figures)_

The typical home value has risen by 38.1%, give or take 3%. The vacancy rate for every empty home has dropped by 44.4%, give or take 8%.

**What should I check before moving?** _(0 figures)_

These figures cannot tell you about the specific condition of a property or the details of a particular street. Because some data relies on broad area standards or older records, you should verify local tax assessments and current rental availability yourself.

#### DeepSeek V4.1 Flash (thinking off) — would publish

_107 words · 276 tokens out · 3.2s · $0.0016_

_Answer 1 refused and sent back for revision:_ a survey figure stated without its margin in "…r take $4,606. The vacancy rate fell to 8.1%, meaning fewer empty homes of…"

**What's changing?** _(3 figures)_

Typical gross rent rose to $1,585 a month, give or take $67, and the typical owner-occupied home value rose to $369,400, give or take $4,606. The vacancy rate fell to 8.1%, give or take 0.9 percentage points, meaning fewer empty homes of every kind.

**What should I check before moving?** _(0 figures)_

These figures describe the whole county, not a particular home or street, and the rent figures rest on a thinner base than the home value figures. Property taxes are shown as a typical bill before any relief paid to individual households, and the affordability measures are county-wide, so they cannot be applied to one town.
