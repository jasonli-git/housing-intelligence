# Research report: accessible, comprehensive, and current housing data

**Author:** Codex, reporting on the Director Note *Accessible, comprehensive, and current
housing data* (`DIRECTOR_NOTES.md`, 2026-09-19). Relayed to Claude by the owner on
2026-09-22 and committed on 2026-09-23 as the source behind ROADMAP.md's Version 3
restructure.

**Status:** a receipt, not canonical documentation. Its code-level claims were checked
against the repository before the roadmap used them (adapter year caps, the monthly
mortgage frequency, ACS estimates without margins of error, the skipped ZCTA pull, the
renter-burden denominator, and the publication gap). Its claims about publishers —
release dates, licence terms, dataset coverage — were **not** verified here; each
milestone that uses one confirms it against the publisher first. Publisher links in the
original were lost when it was relayed; the link text is kept where it appeared.

---

Yes. There is substantially more useful data available—and several important improvements would come from using your existing sources more completely, not buying another feed.

My main conclusion is:

The strongest path is a comprehensive, independently sourced NJ housing decision tool—not an attempt to reproduce Zillow's entire database. You can answer many more practical questions with public data, while being more transparent about dates, uncertainty, and comparability than a Google result.

I read the Director Note, source adapters and configuration, relevant roadmap/TODO sections, and cost calculations. I also queried the local staged observations and researched publishers' current offerings and terms. I did not change files, branches, or documentation.

This is a research report, not legal clearance for commercial use. I distinguish verified opportunities from avenues that still need a sample download, coverage test, or permission.

## 1. The most important findings

These are the conclusions I would act on first:

1. Your freshness problem is not fully solved by scheduled refresh. Several adapters still request old, explicitly listed years. Re-fetching those requests does not discover newer releases.
2. The published site can remain stale after the warehouse updates. Your TODO explicitly records that hip refresh stops before rebuilding packets, interpretations, and the deployed site.
3. The mortgage discrepancy is explainable. Your local data contains 6.67% for August and 6.81% for September's monthly series; Freddie Mac currently reports 6.95% for the week of September 17, 2026. Those are different time windows, not necessarily contradictory observations.
4. DCA is a genuinely valuable untapped source. Its municipal dashboard includes ZIP-level eviction filings and warrants of removal, alongside housing data assembled from multiple agencies.
5. ACS is underused. You currently omit margins of error and direct ZCTA acquisition. Both matter more to trustworthy completeness than adding another decorative metric.
6. There is a feasible path to a product without Zillow, but not a free, identical replacement for every Zillow measure. Transaction prices, price trends, current asking rents, and occupied rents need separate substitutes.
7. The repository's blanket rejection of paid vendors is too broad. RentCast's API terms expressly permit several forms of display and redistribution, subject to restrictions. A server-side proxy is neither universally necessary nor a way around a restrictive license.
8. Some planned sources would introduce old information under a current-looking interface. HUD's Location Affordability Index is the clearest example.
9. Cost completeness should prioritize insurance, mortgage insurance, maintenance, utilities, and upfront cash—not additional appreciation-based estimates.
10. "Data complete" needs a measurable definition. More filled cells can actually make the product less truthful if they come from geographic substitution, stale observations, or poorly labeled models.

## 2. Existing-source freshness: what actually needs attention

The following dates come from the local staging database, not a claim that I verified the deployed site. Some dates are period labels rather than the date an underlying measurement was made.

| Source | What the project currently holds or requests | Finding and recommended action |
|---|---|---|
| Zillow ZHVI/ZORI | Local observations through August 2026 | Revalidation is useful here. Preserve revisions, test changed coverage, and ensure publication follows ingestion. |
| Mortgage rates | August 6.67%; September 6.81%, stored as monthly data | Add a separate latest-weekly benchmark for today's calculator. Keep monthly data for historical comparisons. |
| BLS unemployment | Adapter ends in 2025; staged data ends December 2025 | Explicitly capped. A 2026 refresh still cannot ingest 2026 observations without changing the requested range. |
| Census building permits | Adapter defaults to 2024; staged data ends December 2024 | Confirmed newer release: final 2025 annual data were released May 14, 2026. |
| IRS migration | Adapter stops at 2021–2022 | Confirmed newer release: 2022–2023 is available. Its matching methodology changed, so updating also needs a comparability note. |
| HUD income limits/AMI | Explicit year list ends in 2024 | Confirmed newer release: FY2026 income limits became effective May 1, 2026. |
| ACS five-year estimates | 2020–2024 is the newest loaded vintage | Do not assume a newer release exists just because it is September. Census says the 2025 one-year release date is still being determined. |
| Census population estimates | Vintage 2025, July 1 estimates | A separate, useful population series. Continue keeping it distinct from ACS denominators. |
| HUD FMR | FY2026, represented through September 30, 2026 | Separate publication date from effective date. FY2027 data should not silently become the operative standard before its effective date. |
| HUD CHAS | 2018–2022 | Consistent with HUD's published update schedule. This is publication lag, not necessarily a broken refresh. |
| FHFA HPI | Through June 2026 | Already relatively recent. Additional geographic series deserve a fresh feasibility check. |
| MOD-IV | Latest staged period June 4, 2026 | Check assessment year and municipal update completeness, not merely the statewide layer's download date. |
| SR1A sales | Latest staged metric endpoint June 2026 | Revalidate YTD files; distinguish deed date, recording date, and publication date. |
| NJ tax rates | Through 2025 | Audit each rate/ratio/equalization product separately. A "2026" equalization table does not automatically mean 2026 final tax rates exist. |

Publisher evidence: Census permits release schedule, IRS migration releases, HUD income limits, Census ACS release update, HUD update schedule, NJ tax statistics.

### The mortgage discrepancy, specifically

Your adapter explicitly requests monthly frequency, and your metric definition explicitly says "monthly average." The local figures are:

- August 2026: 6.67%
- September 2026: 6.81%
- Freddie Mac's latest published weekly benchmark: 6.95%, September 17, 2026. Freddie Mac PMMS

So Google's reported 6.95% can match an authoritative source, but the solution is not "use whatever Google says."

I recommend:

- Calculator default: latest published weekly 30-year benchmark.
- History charts: completed monthly averages.
- Reader's actual offer: optional rate override, clearly labeled personal scenario.
- Display: "National weekly benchmark · Sep 17, 2026 · not a loan quote."

Also, your September record ends on September 30, even though today is September 21. That is a calendar-period label, not evidence that the full month has been observed. An incomplete monthly average needs a month-to-date/provisional label or should stay out of completed-month comparisons.

### What a complete refresh system needs

There are four separate jobs:

1. Discover releases: find new years, editions, filenames, and effective dates.
2. Acquire and validate: download changed data and identify failures.
3. Recompute: update metrics, ranks, packets, and any dependent interpretations.
4. Publish consistently: deploy a coherent snapshot and check what users actually receive.

Milestone 29 substantially improved acquisition. It did not eliminate the other responsibilities. The publication gap is explicitly recorded in TODO.md.

For each source, track:

- Observation period.
- Publication/release date.
- Acquisition date.
- Last successful publisher check.
- Published-site version.
- Expected next release.
- Status: current, delayed, unreachable, superseded, discontinued, or intentionally historical.

"Checked today" must never imply "measured today."

## 3. The highest-value untapped data

### A. Expand ACS before adding many new publishers

This is probably the best combination of cost, coverage, maintainability, and consumer value.

Your ACS adapter currently requests a relatively small set of variables. I would investigate these additions:

| Information | What a person could learn |
|---|---|
| Rents by bedroom count | "What kind of rental does this affordability figure represent?" |
| Rent distribution, not just median | "Are there meaningful numbers of rentals near my budget?" |
| Owner costs with and without a mortgage | "How do existing homeowners' costs differ from buying today?" |
| Severe housing-cost burden | "How many households spend more than half their income on housing?" |
| Units in structure | "Is this mostly detached housing, small multifamily, or large apartment buildings?" |
| Bedrooms, crowding, plumbing/kitchen completeness | "Does the housing stock fit my household's needs?" |
| Vacancy by reason | "Is vacancy mostly homes for rent, seasonal homes, or something else?" |
| Heating fuel and vehicles available | "What ongoing expenses or transportation constraints might matter?" |
| Commute mode and travel time | "How do residents actually get to work?" |
| Household composition and disability-related measures | "What needs does the local housing stock have to serve?" |

Two especially important additions:

**Margins of error.** Your current acquisition uses estimate variables but does not request their corresponding margins of error. Precise-looking municipal rankings can therefore conceal substantial survey uncertainty. Census exposes estimate, margin-of-error, and annotation fields. Census API variable documentation

**Direct ZCTA data.** Your adapter explicitly defers it because the nationwide pull is larger. That is an engineering tradeoff, not proof the data are unavailable. A targeted-variable national pull, filtered to relevant ZCTAs, could materially improve ZIP-page completeness.

Keep the distinction: a Census ZCTA is not a USPS ZIP delivery area. Do not silently label either as the other.

One existing methodology deserves review: renter cost burden currently divides by the table's total renter count without separately handling the "not computed" category. That is a defensible custom denominator only if labeled accordingly; it can differ from published affordability percentages that exclude uncomputable ratios. Census housing-affordability guidance

### B. DCA Data Hub: prioritize this

The DCA Data Hub is a discovery portal, not one uniformly licensed, uniformly updated dataset.

The strongest specific lead is its Municipal Housing Profile Dashboard. DCA says it combines Census, HUD, construction, banking/insurance, homelessness, and court information. Its announced coverage includes 2022–2024 eviction filings and warrants of removal by ZIP, plus a data dictionary and annual updates. DCA dashboard announcement

I would seek its underlying tables for:

- Eviction filings and warrants of removal.
- Housing conditions and production.
- Housing need by household size/income.
- Homelessness and assisted-housing context.
- Any source-specific data not already held by your project.

Important distinctions:

- An eviction filing is not an eviction.
- A warrant is not necessarily an executed removal.
- Repeated filings may involve the same household.
- Dashboard data assembled from ACS are not an independent confirmation of ACS.

Best next step: ask DCA for the downloadable tables, dictionary, update calendar, geographic definitions, and reuse permission—not permission to scrape a rendered Power BI screen.

### C. Construction completions, demolitions, and the housing pipeline

You have permits, but permits alone do not tell a resident how much housing was actually delivered.

NJ's Construction Reporter provides routes to permits, certificates of occupancy, and development-trend information. NJ Construction Reporter

Useful additions:

- Authorized units.
- Completed units.
- Demolished units.
- Rental versus ownership-oriented production where recorded.
- Building type and project size.
- A carefully defined net-additions measure.

Keep proposed → approved → permitted → completed separate. Do not present all four as future homes guaranteed to exist.

The raw state permit feeds also need coverage and revision checks; recent records can be incomplete or unaudited. A fresh API response does not guarantee complete municipal reporting.

### D. Affordable housing: distinguish obligations, existing stock, and availability

Three different questions require different datasets:

1. What affordable housing is supposed to be provided? DCA's fourth-round calculations and adopted local plans.
2. What has been completed? Municipal reporting on completed affordable units and trust funds.
3. Where can someone apply today? Housing authorities, property managers, program administrators, and current waiting-list information.

DCA publishes municipal reporting resources for completed units and trust funds. Those can be compared with obligations—but only with matching definitions and dates. DCA municipal reporting

Also investigate:

- HUD LIHTC properties.
- HUD-assisted/public housing inventories.
- Bedroom mix and accessibility where supplied.
- Expiring affordability restrictions.
- Official application and waiting-list links.

HUD LIHTC data and HUD assisted-housing data are concrete starting points.

The National Housing Preservation Database may save integration work, but it has purpose and redistribution restrictions. Free access is not an unrestricted commercial license; interactive property-level reuse generally requires a license. NHPD licensing

### E. Make rent information more useful

The current all-rental ZORI versus single-family purchase comparison is inherently imperfect.

I would build a rent evidence panel, not force one number to answer every question:

- ZORI: market-rent movement for its covered rental universe.
- ACS gross rent: what occupied renter households report paying, including applicable utilities.
- HUD FMR: an administrative gross-rent benchmark.
- HUD SAFMR: ZIP-level benchmark where available.
- Bedroom-specific figures: essential for household relevance.
- Reader-entered rent: the best input when comparing an actual lease with an actual purchase.

HUD publishes Small Area Fair Market Rents, including FY2027 resources. These are not observed listing medians or guaranteed voucher payment amounts. HUD SAFMR

### F. Extract more value from SR1A and MOD-IV

You already hold data that could support additional useful work:

- Transaction counts and market activity.
- Price distributions and quartiles.
- More recent windows where sample size permits.
- Housing-age composition of transactions.
- Sale-to-assessment relationships.
- Potential price-per-square-foot measures.
- Reassessment/revaluation context.

But each needs guardrails:

- Validate living-area completeness before publishing price per square foot.
- Keep property classes separate.
- Do not confuse parcels with dwelling units.
- Do not compute county medians as medians of town medians.
- A rising median sale price may reflect a different mix of homes selling.
- Audit unresolved municipal identifiers before treating unmatched records as unavailable data.

An eventual repeat-sales or hedonic model is worth a feasibility study, not an immediate promise. It would require stable property matching, enough repeated transactions, treatment of renovations, and out-of-sample testing. The currently selected SR1A fields are not automatically a complete modeling dataset.

### G. Mortgage lending: HMDA

HMDA could add:

- Mortgage origination volumes.
- Loan types and terms.
- Reported interest rates and certain loan costs.
- Denial patterns.
- Borrower-income and loan-size distributions.

This helps answer "What financing has actually been used here?"—not "What rate will I personally qualify for?"

The public data are modified for privacy, have reporting exclusions, and are not a complete real-time mortgage market. CFPB data resources, HMDA Data Browser

### H. Flood and environmental exposure

This should be one of the first non-price expansions for NJ.

Combine, rather than conflate:

- FEMA regulatory flood mapping.
- NJDEP flood and climate-adjusted layers.
- Environmental-site and drinking-water context.
- Later: heat, air quality, coastal exposure, and other hazards with defensible coverage.

NJDEP explicitly warns that FEMA maps alone do not capture the whole future flood picture. NJDEP flood-risk guidance, NJDEP GeoWeb, federal NFHL catalog

Avoid claims such as "safe from flooding" because a location is outside a mapped zone. A municipal land-area percentage is also not a household's individual risk.

### I. Transportation and access to jobs

Useful layers include:

- Census LEHD/LODES workplace–residence flows.
- ACS commute patterns.
- NJ TRANSIT schedule data.
- Later, relevant neighboring operators and fares.
- Reader-specified destinations and travel times.

Census LODES documentation, NJ TRANSIT developer portal

Do not use the planned HUD Location Affordability Index as a current dollar estimate without substantial qualification. HUD says v3 primarily uses 2012–2016 ACS data and operates at tract, not block-group, level. HUD LAI v3 documentation

Likewise, EPA's Smart Location data need vintage checks; its currently described offering points to 2021 data. Historical built-environment context can remain useful, but old transit service is not today's schedule. EPA Smart Location Mapping

### J. Schools, broadband, and other neighborhood context

These are worthwhile, but should remain separate components—not a universal "best neighborhood" score.

- Schools: NJDOE downloadable performance data plus school/district geography. District boundaries do not prove assignment to a particular school. NJDOE downloads
- Broadband: FCC provider-reported availability, with a warning that availability is not measured household speed. The underlying location Fabric has separate licensing restrictions. FCC map guidance, Fabric licensing
- Crime: audit reporting coverage and agency geography even for NJ State Police data. "No report" is not zero crime. NJSP crime data
- Energy burden: DOE LEAD can add context, not an individualized utility quote. DOE LEAD

A later discovery queue should also cover zoning and redevelopment plans, rental registration/inspection aggregates, parks, healthcare access, local utility tariffs, sewer/septic service, and accessible housing. These are candidates requiring jurisdiction-by-jurisdiction access and coverage checks, not sources I would call integration-ready today.

## 4. Can you replace Zillow and become commercial?

There is a plausible route, but "replace Zillow" needs to be split into distinct functions.

| Current function | Plausible alternative | What you lose or change |
|---|---|---|
| Typical home value in dollars | SR1A qualifying transaction prices; reader-entered price | Price of homes that sold, not modeled value of the whole housing stock |
| Home-price appreciation | FHFA indexes; eventually a validated local model | Different coverage, frequency, and mortgage/property universe |
| Typical current market rent | Licensed rental feed or a sufficiently representative partnership | No verified free, equally complete substitute |
| Broad rent context | ACS gross rent + HUD FMR/SAFMR | Occupied-rent estimates or administrative benchmarks, not current asking rents |
| Market activity | SR1A counts; potentially licensed Realtor.com aggregates | Deeds lag listings; listing datasets need permission |
| Personal affordability | Reader inputs + public tax/program data + licensed rate inputs | More honest personalization, but no universal "typical property" claim |

FHFA officially offers local HPI products, including county and ZIP-level series. The adapter's historical note about broken download paths should trigger a fresh retrieval test, not permanent rejection of the source. Those indexes still cannot substitute directly for a dollar home price. FHFA HPI, local HPI documentation

### Zillow's licensing deserves a narrower, written determination

Your configuration says "non-commercial use with attribution." Zillow's current general terms also contain an aggregate-data provision allowing certain non-personal uses and attributed derivative displays, while imposing other restrictions.

That is not enough to declare this particular product commercially cleared. The applicability to Research downloads, competitive products, automated acquisition, static exports, and paid access needs confirmation. Zillow terms

Ask for a written answer covering your actual intended uses. Until then, retain the existing restriction.

Also audit every other source, not just Zillow. FRED hosts series with originator-specific rights. Freddie Mac provides a permission route for automatically updated PMMS content, subject to its syndication terms; that is not a blanket license for every form of data resale. Freddie Mac content policy

### My commercial recommendation

Build toward a license-separated public-data core:

- The core must remain useful if a proprietary source disappears.
- Source restrictions should propagate to exports and derived outputs.
- Commercially cleared sources can be enabled separately.
- Do not make every headline dependent on one vendor.

That gives you negotiating power and a feasible product even if Zillow permission is unavailable.

## 5. Paid data under $10/month, Ficstar, and scraping

### A real low-cost option exists—but for a pilot

RentCast currently advertises:

- 50 free API requests per month.
- Developer-tier overage of $0.20/request.
- A $74/month Foundation plan.

At that Developer rate, an additional 50 requests would cost $10 before applicable taxes. That supports a small controlled experiment, not unrestricted user traffic or a comprehensive statewide refresh. Endpoints and pagination determine how much data a request actually yields. RentCast pricing

Its API license expressly permits storage and certain display, distribution, and resale uses, subject to restrictions and third-party rights. Therefore, the repository's claim that every paid property vendor forbids redistribution is unsupported. RentCast API terms

My recommendation: do not subscribe yet. First identify one gap public sources cannot satisfy, test the free allowance, measure NJ coverage and accuracy, confirm rights, and impose a hard request budget.

### Ficstar

The linked article is useful for discovering vendors, but it is not evidence of:

- Affordable pricing.
- NJ municipal coverage.
- Commercial display rights.
- Complete provenance.
- Permission to scrape the listed websites.

Ficstar is also selling data-extraction services. Treat its overview as a vendor shortlist, not an independent licensing audit. Ficstar overview

I did not verify a sustainable ≤$10/month statewide feed from the larger enterprise providers.

### Realtor.com is worth revisiting

Its research library offers downloadable county and ZIP market data, including inventory-oriented measures. That could be more complementary than another home-value index. However, I did not establish a Research-specific commercial redistribution grant, so it remains a permission-dependent candidate. Realtor.com data library

### Scraping policy

Prefer, in order:

1. Official bulk downloads.
2. Documented APIs.
3. Public data services explicitly intended for reuse.
4. Permission-based extraction of public tables.
5. Carefully maintained document extraction when no structured release exists.

Good candidates include public tax tables, municipal plans, official fee schedules, and construction reports—after checking access and reuse conditions.

Avoid building the business around scraping listing portals, bypassing controls, or inferring permission from public visibility. Robots instructions and copyright/licensing are separate issues.

A proxy changes where requests happen. It does not grant rights you do not have.

## 6. Institutional outreach: yes, there is real potential

I would prioritize targeted requests over broad "can we have more data?" emails.

| Institution | Specific request |
|---|---|
| DCA data team | Dashboard source tables, dictionary, refresh calendar, eviction aggregates, reuse terms |
| NJ Treasury/Taxation and NJ Office of GIS | Stable bulk endpoints, field definitions, historical releases, municipal-code reconciliation, revision notices |
| NJHMFA and local housing authorities | Affordable-property inventories, bedroom/accessibility fields, official application links, waiting-list status feeds |
| Courts or DCA's court-data intermediary | Aggregate filings, warrants, executed removals where available, reporting-unit definitions |
| Rutgers Bloustein/CUPR | Methodology review, local-data partnerships, validation datasets, research collaboration |
| County GIS and municipal planning offices | Zoning, redevelopment areas, approvals, completions, rental-inspection aggregates |
| Housing nonprofits and legal aid | Missing user questions, tenant-facing usefulness, interpretation of administrative data |
| MLSs or rental operators | Explicitly licensed aggregate statistics, only if public sources leave a material gap |

Rutgers CUPR specifically works on housing, local government, public finance, transportation, and data systems, making it a credible methodological partner. Rutgers CUPR

A good initial request would say:

> We operate a public-facing NJ housing information tool. We are seeking an existing, periodically updated aggregate dataset—not personal case records. Could you provide the available fields, geographic coverage, update schedule, data dictionary, bulk-access method, and conditions for public display and possible future commercial use?

Offer attribution, reproducible checks, and feedback on data defects. Do not assume a university's research-only license transfers to your commercial product.

## 7. Temporal modes: keep the idea, change the conceptual model

I would not begin with a global three-position switch that implies every metric has a credible current estimate and forecast.

There are two independent questions:

1. What kind of figure is this?
2. What period does it describe?

For example:

| Figure | Type | Temporal meaning |
|---|---|---|
| Recorded sale | Administrative observation | Transaction date |
| Median of qualifying sales | Calculation from observations | Explicit transaction window |
| ACS household income | Survey estimate | Five-year reference period |
| Zillow home value | Modeled estimate | Published index period |
| Cost at an entered purchase price | Scenario calculation | Current assumptions |
| Estimate of unreported current-month sales | Nowcast | Current, incompletely observed period |
| Next-year home-price change | Forecast | Future period |

### "Firm" should mean latest published evidence, not "unmodeled truth"

ACS, PEP, Zillow, and HUD benchmarks already involve estimation or modeling.

I would use "Latest published data" as the default view, with figure-level type labels. That is clearer than suggesting that everything in Firm mode was directly measured.

### Current projections: worthwhile selectively

Good early candidates:

- Recalculate mortgage payments using the latest rate.
- Show current official fees or program thresholds.
- Update a scenario using reader-entered insurance, rent, or purchase price.
- Eventually nowcast a small number of delayed metrics with validated signals.

The first three are not forecasts of the housing market. They are calculations using newer inputs.

Avoid manufacturing current municipal income, rents, and ranks by uniformly inflating old data. That can erase real geographic differences while producing very convincing decimals.

### Future forecasting: optional and later

Require:

- Historical, time-ordered backtests.
- Data as it was available at each forecast date.
- Comparison with simple no-change and trend baselines.
- Honest uncertainty intervals and calibration.
- Performance broken down by geography and horizon.
- A rule for withholding forecasts when evidence is weak.

Start with scenarios—"What if rates rise one percentage point?"—before predictions—"Rates will rise."

I would postpone projected rankings. Ranking uncertain estimates can create far more apparent precision than the underlying forecasts support.

## 8. Cost-breakdown comprehensiveness

Your current calculator already includes principal and interest, the area's median property tax when available, and a first-payment principal/interest split.

Its omissions are material.

I recommend four separate views:

1. Monthly cash required
2. Upfront cash required
3. Ownership expenses excluding principal
4. Long-horizon scenarios

That is more understandable than one number claiming to be the complete cost.

| Cost | Recommended treatment |
|---|---|
| Principal and interest | Deterministic calculation from price, down payment, rate, term |
| Property tax | Prefer the actual property bill when entered; otherwise clearly labeled area benchmark |
| Homeowners insurance | Reader quote first; carefully sourced range only when defensible |
| Flood/supplemental insurance | Separate conditional cost; hazard mapping is not a premium quote |
| Mortgage insurance | Loan-specific estimate or reader input; do not silently omit for low-down-payment scenarios |
| HOA/condo/co-op charges | Reader/listing input; avoid a municipality-wide default |
| Maintenance and major replacements | Explicit reserve assumption or range, not "observed local cost" |
| Utilities | Separate owner/renter treatment, with included utilities identified |
| Closing costs | Upfront itemization or scenario range |
| Moving and initial repairs | Optional upfront inputs |
| Selling costs | Include only in holding-period comparisons |
| Opportunity cost | Optional assumption-based scenario |
| Tax relief/assistance | Separate eligibility-dependent information, not an automatic subtraction |

The CFPB's own budgeting guidance includes taxes, insurance, supplemental insurance, mortgage insurance, and association fees when considering monthly home costs. CFPB home-budget guidance

### Three important cautions

Taxes: do not use purchase price × municipal effective tax rate as though it were an individual tax bill. NJ distinguishes the general rate applied to assessed value from effective rates used for comparison. NJ property-tax explanation

Insurance: statewide historical premium averages can provide context, but not a current town-level quote. NJDOBI public filings and NAIC reports are research avenues, with reuse and applicability checks. NJDOBI public rate filings, NAIC homeowners information

Missing components: your calculation currently treats missing tax as zero in the arithmetic while exposing a missing-tax explanation elsewhere. The displayed total should unmistakably say partial estimate, not rely on the reader finding a caveat.

Also:

- Do not add utilities twice when the rent measure already includes them.
- Keep principal out of "money spent and gone," but in monthly cash required.
- Do not subtract historical appreciation from today's monthly bill.
- A 3.5% down scenario should not imply a complete FHA cost calculation unless FHA-specific charges and rules are modeled.
- Show renting's additional expenses too.

Tax-relief and assistance information could be genuinely valuable, but rules change and eligibility is household-specific. Link to current official guidance and record a review date. NJ property-tax relief, NJHMFA homebuyer programs

## 9. How to outperform Google without pretending to know everything

The product should answer decision-shaped questions, not merely display source-shaped tables.

Examples:

- "What would buying at my budget cost, and what is still missing?"
- "Where could my household find a two-bedroom rental near this amount?"
- "Which nearby places cost less without greatly increasing my commute?"
- "How much of this apparent price difference comes from different housing types?"
- "What housing assistance should I investigate?"
- "What flood exposure or property-tax uncertainty should I check before making an offer?"
- "Is this area adding housing, or only approving it?"
- "How confident should I be that one town really ranks above another?"

Every answer should make five things easy to inspect:

Source · period · geography · calculation · limitation

Other useful functionality:

- Side-by-side comparisons using genuinely comparable measures.
- Reader-entered purchase price, rent, rate, and household size.
- Clear separation of personal scenarios from published regional rankings.
- Downloadable evidence where licensing permits.
- Revision history and "what changed since the last release."
- A visible missing-data explanation.
- Links to the official next action, such as a housing authority application page.

That is the defensible advantage: less work to reach an answer, with more ability to verify it.

## 10. The two presentation questions

### House-price-index values

Keep the definitions, but add interpretation at the point of reading.

For the examples in the note:

- 442.7 — prices about 4.43× the early-1991 baseline
- 967.6 — prices about 9.68× the early-1980 baseline

Those interpretations assume the baseline definitions already recorded in your glossary. The two levels are not directly comparable, because their bases and underlying series differ.

I would lead with a common-period percentage change, then place the index level and baseline beneath it. Avoid letting a larger index look like a more expensive market.

### Rank context

Yes, remove the standalone sentence if each rank preserves the comparison set.

Examples:

- 6 / 21 NJ counties
- 42 / 551 municipalities with data
- Highest 10% among comparable ZIP areas

The denominator should reflect the actual ranked cohort. "6/21" alone is compact but ambiguous; an accessible label or nearby text should state the geography, period, and direction.

For uncertain survey estimates, consider "near the middle" or an uncertainty warning instead of treating every one-place difference as meaningful.

## 11. What "data complete" should mean—and how I would sequence it

I would measure completeness along six dimensions:

| Dimension | Example |
|---|---|
| Geographic coverage | Share of municipalities and population represented |
| Temporal coverage | Latest available release versus latest acquired versus latest published |
| Subject coverage | Price, rent, financing, taxes, stock, supply, assistance, hazards, access |
| Statistical quality | Sample counts, margins of error, suppression, match quality |
| Usability | Can an ordinary person answer a practical question? |
| Reuse rights | Can the data support public display, downloads, derivatives, and commercial use? |

Do not reward the system for filling an unknown value with a weak proxy. An honest blank is more complete knowledge than a misleading number.

### Proposed order—not a roadmap change

**First: reliability and inexpensive completeness**

- Update confirmed outdated release selections.
- Separate weekly mortgage benchmarks from monthly history.
- Close the warehouse-to-publication gap with explicitly approved automation boundaries.
- Add freshness/coverage reporting.
- Add ACS margins of error.
- Investigate direct ZCTA ACS coverage.
- Correct the source register's outdated counts and overly broad licensing conclusions.

**Next: complete the housing decision**

- HUD bedroom-specific rent benchmarks and household-size income limits.
- More complete cost scenarios.
- DCA underlying tables and eviction aggregates.
- Construction completions/demolitions.
- SR1A distributions, sample sizes, and identifier reconciliation.
- Flood/environmental context.
- Affordable-housing and assistance links.

**Then: deeper regional context and differentiation**

- Transportation and job access.
- School information.
- HMDA financing context.
- Affordable-stock preservation.
- Selected zoning and local administrative-data pilots.
- A commercially cleared, vendor-independent core.

**Last: predictive features**

- Validated nowcasts for selected metrics.
- Forecasts only where they improve on simple alternatives.
- No obligation to implement a global Future mode.

### Honest cost expectations

These are planning estimates, not quotes:

- Small release-selection fixes: hours to a few days each, depending on schema changes and historical comparability.
- Reliable refresh-to-publication workflow: several days to a couple of weeks, depending on approval gates and stale-interpretation handling.
- ACS expansion with uncertainty and geographic QA: roughly one to several weeks.
- A clean, well-documented new source: several days to two weeks for production-quality integration.
- Fragmented municipal records or negotiated partnerships: weeks to months, with uncertain access.
- Defensible local price/rent modeling: a research project measured in weeks or months, with no guaranteed useful result.

Much of the data can cost $0 in acquisition fees. Storage, geospatial processing, maintenance, licensing review, and interpretation generation are still real costs.

My strongest recommendation: before spending the $10/month on data, spend the next development effort making existing observations fresher, uncertainty visible, ZIP coverage better, and costs more complete. Then pursue DCA and targeted institutional partnerships. Those steps would make the platform substantially more useful—and more trustworthy—without requiring a forecasting system or an expensive property-data contract.

The remaining uncertainties are concrete: specific dataset reuse permissions, field-level completeness, successful bulk retrieval of some candidates, and institutional willingness to share. I would treat those as explicit research gates, not quietly assume them away.
