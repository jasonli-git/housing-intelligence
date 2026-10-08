/**
 * What every metric means, in plain words, and why a reader should care (Milestone 23).
 *
 * The owner's rule: as succinct and plain as possible, so a beginner can follow, each
 * ending with why it matters. `config/metrics.yml` keeps its own descriptions, which are
 * written for maintainers ("ACS 5-year table B19013"); these are the reader's. Presentation,
 * so they live with the pages, like the section names in `groups.ts` — and a test checks
 * every metric a page can show has one, so a new metric fails to build a page silently
 * undefined rather than shipping without a definition.
 */

export type MetricDefinition = {
  /** What the figure is, in a sentence or two. */
  what: string;
  /** Why it matters to someone deciding where to live. */
  why: string;
};

export const DEFINITIONS: Record<string, MetricDefinition> = {
  // Prices
  nj_ah_present_need: {
    what: "DCA’s non-binding calculation of existing affordable housing need for the 2025–2035 round, published in October 2024.",
    why: "A planning baseline, not a final court-approved obligation or a count of available homes.",
  },
  nj_ah_prospective_need: {
    what: "DCA’s non-binding calculation of added need for 2025–2035, with its published 1,000-home/20% cap.",
    why: "Shows the state’s planning calculation, not the town’s final legal obligation.",
  },
  nj_ah_completed_units: {
    what: "Affordable units in municipal reports that mark a certificate of occupancy granted. Missing counts and unknown completion statuses are left out.",
    why: "A partial reported inventory across rounds, including rehabilitation. It cannot measure completion of the fourth-round need.",
  },
  nj_ah_trust_balance: {
    what: "The balance towns report in their affordable housing trust funds. Missing submissions are omitted, not treated as zero.",
    why: "Unspent commitments are not deducted, so this is not the amount freely available for new projects. Negative reports stay negative.",
  },
  zhvi_sfr: {
    what: "Zillow’s estimate of what a typical single-family house here is worth: one in the middle of the local market, not the cheapest or the dearest.",
    why: "It is the closest thing to “what a house costs here”, the figure a buyer’s budget starts from.",
  },
  sr1a_median_sale_price: {
    what: "The price of the middle home actually sold here over the last three years. New Jersey sets aside sales that are not open-market \u2014 inheritances, sales between relatives, sheriff\u2019s sales \u2014 and counts only the rest.",
    why: "It is what buyers really paid, not an estimate of what homes are worth.",
  },
  acs_median_home_value: {
    what: "What the middle homeowner says their home is worth, as owners told the Census Bureau’s survey. It covers every kind of owned home.",
    why: "An older, self-reported view of prices: useful where Zillow has no figure, and as a check on it.",
  },
  modiv_median_assessed_value: {
    what: "The middle value the town has put on one- to four-family homes for property tax. Not a market price: each town assesses on its own schedule.",
    why: "It decides how the tax bill is shared within a town, but cannot be compared between towns.",
  },
  zori_all: {
    what: "Zillow’s typical asking rent for homes listed for rent here: apartments, condos and houses together.",
    why: "It is what a new tenant can expect to be asked today, often more than people already renting pay.",
  },
  acs_median_gross_rent: {
    what: "What the middle renting household actually pays each month, utilities included, as renters told the Census Bureau’s survey.",
    why: "It is what tenants already in place pay; the gap to today’s asking rent shows how fast the market has moved.",
  },
  hud_fmr_2br: {
    what: "HUD’s estimate of what a modest two-bedroom home rents for here, utilities included, set near the lower middle of recent movers’ rents.",
    why: "It sets what housing vouchers pay, so it marks the cost of a modest home to the programs that help renters.",
  },
  fhfa_hpi: {
    what: "The Federal Housing Finance Agency’s measure of how prices change for the same homes when they sell again. An index, not a price: 100 is early 1991. Statewide only.",
    why: "Because it follows the same homes, it shows true price growth rather than a change in what kinds of homes sold.",
  },
  fhfa_hpi_all_transactions: {
    what: "The same kind of index from FHFA, but counting refinance appraisals as well as sales. An index: 100 is early 1980. Statewide only.",
    why: "It reaches back further than the purchase-only index, so it shows the long run of prices.",
  },

  // Affordability
  price_to_income: {
    what: "How many years of the typical household’s income the typical home costs: Zillow’s home value divided by the Census Bureau’s median income for the same year.",
    why: "Around 3 was long thought affordable; above 5 is a stretch for most buyers.",
  },
  price_to_ami: {
    what: "How many years of HUD’s area median income the typical home costs.",
    why: "Like home value to income, but against the official income that housing programs use.",
  },
  rent_to_income: {
    what: "A year of typical asking rent as a share of the typical household’s income.",
    why: "Above 30%, a typical household renting a typical home here would be cost-burdened.",
  },
  fmr_to_income: {
    what: "A year of HUD’s two-bedroom Fair Market Rent as a share of the typical household’s income.",
    why: "It shows whether a modest home fits within 30% of a typical income here.",
  },
  acs_renter_cost_burden: {
    what: "The share of renting households spending more than 30% of their income on rent and utilities.",
    why: "30% is the line the government uses for “cost-burdened”: above it, rent squeezes everything else.",
  },
  chas_renter_cost_burden: {
    what: "The share of renting households spending more than 30% of income on housing, as HUD counts it from Census data.",
    why: "HUD’s own count of cost-burdened renters, the figure behind official housing plans.",
  },
  chas_renter_severe_burden: {
    what: "The share of renting households spending more than half their income on housing.",
    why: "It leaves little for food, travel or savings, so it marks the households under the most strain.",
  },
  chas_owner_cost_burden: {
    what: "The share of homeowners spending more than 30% of their income on housing: mortgage, tax, insurance and utilities.",
    why: "Owners can be squeezed too; this shows how many are stretched by what they pay.",
  },
  acs_median_home_insurance: {
    what: "What the middle homeowner with a mortgage pays a year to insure the home, as owners told the Census. Worked out from the Census’s price brackets, so no margin is given.",
    why: "Lenders require it, so it is part of the monthly cost; a new policy can cost more than owners already insured pay.",
  },
  acs_median_electricity: {
    what: "The middle monthly electricity bill among homes here that pay one, owners and renters alike, as households told the Census. Worked out from the Census’s price brackets, so no margin is given.",
    why: "Part of what a home costs to run every month, on top of the mortgage or the rent.",
  },
  acs_median_gas: {
    what: "The middle monthly gas bill among homes here that pay one, as households told the Census. Worked out from the Census’s price brackets, so no margin is given.",
    why: "Many New Jersey homes heat with gas, so it can be the second-largest utility bill.",
  },
  acs_median_water_sewer: {
    what: "The middle yearly water and sewer bill among homes here billed for it, as households told the Census. Worked out from the Census’s price brackets, so no margin is given.",
    why: "Often billed by the town or a utility every quarter, so easy to leave out of a monthly budget.",
  },
  acs_median_other_fuel: {
    what: "The middle yearly cost of heating oil, propane, wood or other fuels among homes here that buy them, as households told the Census. The Census gives only three brackets, so where the middle home pays $750 or more no figure is shown.",
    why: "Homes that heat with oil can pay more for it than for electricity and gas together.",
  },
  acs_renters_paying_utilities: {
    what: "The share of renting households here that pay for at least one utility on top of their rent.",
    why: "It says how often a quoted rent leaves the bills to the tenant, which matters when setting a rent against the cost of owning.",
  },
  acs_median_rent_studio: {
    what: "What the middle studio apartment here rents for each month, utilities included, as tenants told the Census.",
    why: "Rent depends on size; this sets a small place against the typical rent for every size.",
  },
  acs_median_rent_1br: {
    what: "What the middle one-bedroom home here rents for each month, utilities included, as tenants told the Census.",
    why: "Rent depends on size; this is the figure to compare when looking for a one-bedroom.",
  },
  acs_median_rent_2br: {
    what: "What the middle two-bedroom home here rents for each month, utilities included, as tenants told the Census.",
    why: "The size HUD’s Fair Market Rent is set for, so the two can be compared.",
  },
  acs_median_rent_3br: {
    what: "What the middle three-bedroom home here rents for each month, utilities included, as tenants told the Census.",
    why: "What a family needing room would pay to rent rather than buy.",
  },
  acs_median_rent_4br: {
    what: "What the middle four-bedroom rental here costs each month, utilities included, as tenants told the Census.",
    why: "Large rentals are scarce in most places, so the margin is often wide.",
  },
  acs_rent_lower_quartile: {
    what: "A quarter of renters here pay their landlord less than this each month. Utilities are not included.",
    why: "Shows what the cheaper rentals cost, which the middle figure hides.",
  },
  acs_rent_upper_quartile: {
    what: "A quarter of renters here pay their landlord more than this each month. Utilities are not included.",
    why: "With the lower quarter, shows how wide the range of rents is.",
  },
  acs_owner_costs_mortgage: {
    what: "What the middle owner with a mortgage here pays each month for the loan, tax, insurance, utilities and fees, as owners told the Census.",
    why: "What owning costs people who already own, many on older, cheaper loans than a buyer gets today.",
  },
  acs_owner_costs_no_mortgage: {
    what: "What the middle owner without a mortgage here pays each month for tax, insurance, utilities and fees.",
    why: "The cost of a home that never goes away, even once the loan is paid off.",
  },
  acs_renter_severe_burden: {
    what: "The share of renting households here paying half their income or more on rent and utilities.",
    why: "Households this stretched have little left for anything else and are the most at risk of losing their home.",
  },
  acs_owner_severe_burden: {
    what: "The share of homeowners here paying half their income or more on their mortgage, tax, insurance and utilities.",
    why: "Owning does not always mean affordable; this counts owners under the most strain.",
  },
  acs_share_detached: {
    what: "The share of homes here that are houses standing on their own, as the Census counts them.",
    why: "Says whether a place is mostly houses or mostly apartments, which shapes what is for sale and for rent.",
  },
  acs_share_attached: {
    what: "The share of homes here that are single-family homes sharing a wall, such as townhouses and rowhouses.",
    why: "Part of the mix of homes; often cheaper than a detached house nearby.",
  },
  acs_share_2_4_units: {
    what: "The share of homes here in two- to four-family buildings, such as duplexes and triple-deckers.",
    why: "Small multi-family buildings are where many renters live, and some owners live in one and rent the rest.",
  },
  acs_share_5_19_units: {
    what: "The share of homes here in buildings of five to 19 apartments.",
    why: "Part of the mix of homes; mid-sized buildings are mostly rentals and condos.",
  },
  acs_share_20plus_units: {
    what: "The share of homes here in apartment buildings of 20 or more units.",
    why: "A high share means a dense place with large rental or condo buildings.",
  },
  acs_share_mobile_homes: {
    what: "The share of homes here that are mobile or manufactured homes.",
    why: "Often among the cheapest homes to own, though the land under them may be rented.",
  },
  acs_median_year_built: {
    what: "The year the middle home here was built: half are older and half newer, as households told the Census.",
    why: "Older homes can need more upkeep and may contain lead paint or outdated wiring.",
  },
  acs_share_built_2000_later: {
    what: "The share of homes here built in 2000 or later.",
    why: "Shows how much has been built recently, and how new the homes on offer may be.",
  },
  acs_share_built_1980_1999: {
    what: "The share of homes here built between 1980 and 1999.",
    why: "Part of the age of the homes here, from newest to oldest.",
  },
  acs_share_built_1940_1979: {
    what: "The share of homes here built between 1940 and 1979.",
    why: "Homes built before 1978 may contain lead paint, which a seller must disclose.",
  },
  acs_share_built_pre_1940: {
    what: "The share of homes here built before 1940.",
    why: "Very old homes can have character and high upkeep costs.",
  },
  acs_share_0_1_bedrooms: {
    what: "The share of homes here that are studios or have one bedroom.",
    why: "Says how much there is here for people living alone or as a couple.",
  },
  acs_share_2_bedrooms: {
    what: "The share of homes here with two bedrooms.",
    why: "Part of the mix of home sizes here.",
  },
  acs_share_3_bedrooms: {
    what: "The share of homes here with three bedrooms.",
    why: "Part of the mix of home sizes here; the usual family house.",
  },
  acs_share_4plus_bedrooms: {
    what: "The share of homes here with four or more bedrooms.",
    why: "Says how much there is here for large households.",
  },
  acs_overcrowded_share: {
    what: "The share of homes here with more people than rooms, counting every room but bathrooms, as the Census measures crowding.",
    why: "Crowding is often how households cope when homes cost more than they can pay.",
  },
  acs_lacking_plumbing_share: {
    what: "The share of homes here missing hot and cold running water, a bathtub or shower, or a flush toilet.",
    why: "A rare but basic sign of homes in poor condition.",
  },
  acs_lacking_kitchen_share: {
    what: "The share of homes here missing a sink with a faucet, a stove or range, or a refrigerator.",
    why: "Often rooming houses or units carved out of larger homes, as well as homes in poor repair.",
  },
  acs_avg_household_size: {
    what: "How many people live in the average home here, as households told the Census.",
    why: "Larger households need more room, which says what kind of homes are in demand.",
  },
  acs_no_vehicle_share: {
    what: "The share of households here that have no car, van or truck.",
    why: "High where transit is good, and where households cannot afford a car.",
  },
  acs_rental_vacancy_rate: {
    what: "The share of rental homes here that stood empty and for rent, as the Census defines the rental vacancy rate.",
    why: "A low rate means few rentals open at a time, which tends to push rents up.",
  },
  acs_homeowner_vacancy_rate: {
    what: "The share of owned homes here that stood empty and for sale, as the Census defines the homeowner vacancy rate.",
    why: "A low rate means few homes on the market at a time, so buyers compete.",
  },
  acs_vacant_seasonal_share: {
    what: "Of the homes here with nobody living in them, the share kept as summer homes, rentals for vacations, or for occasional use.",
    why: "Explains a high vacancy rate at the shore, where most empty homes are not for rent or sale.",
  },
  acs_vacant_other_share: {
    what: "Of the homes here with nobody living in them, the share empty for none of the usual reasons: being repaired, tied up in an estate or foreclosure, or abandoned.",
    why: "A high share can be a sign of neglected homes.",
  },
  acs_heat_gas_share: {
    what: "The share of homes here heated mainly with gas piped in by a utility.",
    why: "The heating fuel sets which bills a home runs up in winter.",
  },
  acs_heat_electric_share: {
    what: "The share of homes here heated mainly with electricity, by heat pump or by resistance heat.",
    why: "The heating fuel sets which bills a home runs up in winter.",
  },
  acs_heat_oil_share: {
    what: "The share of homes here heated mainly with heating oil or kerosene, delivered by truck.",
    why: "Oil can cost more than gas, and an old tank can be a costly problem when buying.",
  },
  acs_heat_propane_share: {
    what: "The share of homes here heated mainly with propane from a tank.",
    why: "Common where gas lines do not reach; prices swing with the season.",
  },
  acs_heat_other_share: {
    what: "The share of homes here heated with wood, coal, solar or another fuel, or not heated at all.",
    why: "Part of the mix of heating fuels here.",
  },
  acs_commute_transit_share: {
    what: "The share of workers living here who usually get to work by bus, train, light rail or ferry.",
    why: "Shows how practical it is to get around here without a car.",
  },
  acs_work_from_home_share: {
    what: "The share of workers living here who usually work from home.",
    why: "A place where many work from home draws people for its homes rather than its commute.",
  },
  acs_commute_drove_alone_share: {
    what: "The share of workers living here who usually drive to work alone.",
    why: "Part of how people here get to work.",
  },
  acs_commute_walked_share: {
    what: "The share of workers living here who usually walk to work.",
    why: "Part of how people here get to work.",
  },
  acs_mean_commute_minutes: {
    what: "How many minutes the average worker living here takes to get to work, one way, not counting those who work from home.",
    why: "A cheaper home farther out can cost hours a week in travel.",
  },
  acs_commute_60plus_share: {
    what: "The share of workers living here who take an hour or more to get to work, one way.",
    why: "Long commutes are often the price of a cheaper home farther from jobs.",
  },
  acs_living_alone_share: {
    what: "The share of households here that are one person living alone.",
    why: "Says how much of the demand here is for smaller homes.",
  },
  acs_married_couple_share: {
    what: "The share of households here headed by a married couple.",
    why: "Part of who lives here.",
  },
  acs_with_children_share: {
    what: "The share of households here with at least one child under 18.",
    why: "Families with children look for space and schools, which shapes what homes are in demand.",
  },
  acs_disability_share: {
    what: "The share of people here with a disability affecting hearing, sight, memory, walking, self-care or living on their own.",
    why: "Says how many people here may need homes that are accessible without stairs.",
  },
  modiv_median_tax_bill: {
    what: "What the middle one- to four-family home paid in property tax in the tax year shown, before any relief a household may claim.",
    why: "New Jersey’s property taxes are among the highest in the country, so this can matter as much as the price.",
  },
  nj_effective_tax_rate: {
    what: "Property tax per $100 of what a home is actually worth on the market, as New Jersey publishes it.",
    why: "The one property tax figure that can be compared between towns, because it is measured against market value rather than each town\u2019s own assessment.",
  },
  nj_general_tax_rate: {
    what: "Property tax per $100 of the value the town has assessed \u2014 the rate printed on a tax bill.",
    why: "It is the rate you are charged, but it cannot be compared between towns: a town that assesses homes at half their worth needs twice the rate to raise the same money.",
  },
  nj_director_ratio: {
    what: "How close the town\u2019s assessments are to market value, as a percentage. 100 means they match; 60 means homes are on the books at about 60% of what they would sell for.",
    why: "It shows how out of date a town\u2019s assessments are: the further from 100, the longer since it revalued.",
  },
  mortgage_rate_30y: {
    what: "The average interest rate on a 30-year fixed-rate home loan across the country, from Freddie Mac’s weekly survey, averaged by month. A month still in progress covers only the weeks reported so far.",
    why: "It sets the monthly payment: on the same house, a higher rate can add hundreds of dollars a month.",
  },
  mortgage_rate_30y_weekly: {
    what: "This week’s national benchmark for a 30-year fixed-rate home loan, from Freddie Mac’s weekly survey of lenders. A benchmark, not a rate any one borrower is offered.",
    why: "It is the rate a mortgage is priced at today; the monthly averages show how it got here.",
  },

  // Incomes and jobs
  acs_median_hh_income: {
    what: "The income of the household in the middle: half of households here earn more, half less. From the Census Bureau’s survey, pooled over five years.",
    why: "It is the yardstick for affordability; prices only mean something next to what people earn.",
  },
  hud_area_median_income: {
    what: "HUD’s official middle income for families in this area, set each year.",
    why: "Affordable-housing programs are set as a percentage of it, so it decides who qualifies.",
  },
  hud_fmr_0br: {
    what: "HUD’s estimate of what a modest studio home rents for here, utilities included, set near the lower middle of recent movers’ rents.",
    why: "It sets what housing vouchers pay for this size, so it marks the cost of a modest home to the programs that help renters.",
  },
  hud_fmr_1br: {
    what: "HUD’s estimate of what a modest one-bedroom home rents for here, utilities included, set near the lower middle of recent movers’ rents.",
    why: "It sets what housing vouchers pay for this size, so it marks the cost of a modest home to the programs that help renters.",
  },
  hud_fmr_3br: {
    what: "HUD’s estimate of what a modest three-bedroom home rents for here, utilities included, set near the lower middle of recent movers’ rents.",
    why: "It sets what housing vouchers pay for this size, so it marks the cost of a modest home to the programs that help renters.",
  },
  hud_fmr_4br: {
    what: "HUD’s estimate of what a modest four-bedroom home rents for here, utilities included, set near the lower middle of recent movers’ rents.",
    why: "It sets what housing vouchers pay for this size, so it marks the cost of a modest home to the programs that help renters.",
  },
  hud_safmr_0br: {
    what: "HUD’s rent standard for a modest studio home in this ZIP code, utilities included, set ZIP by ZIP where HUD prices the metro area that way.",
    why: "Where it exists, vouchers pay against it rather than the county figure, so it tracks rents street by street more closely.",
  },
  hud_safmr_1br: {
    what: "HUD’s rent standard for a modest one-bedroom home in this ZIP code, utilities included, set ZIP by ZIP where HUD prices the metro area that way.",
    why: "Where it exists, vouchers pay against it rather than the county figure, so it tracks rents street by street more closely.",
  },
  hud_safmr_2br: {
    what: "HUD’s rent standard for a modest two-bedroom home in this ZIP code, utilities included, set ZIP by ZIP where HUD prices the metro area that way.",
    why: "Where it exists, vouchers pay against it rather than the county figure, so it tracks rents street by street more closely.",
  },
  hud_safmr_3br: {
    what: "HUD’s rent standard for a modest three-bedroom home in this ZIP code, utilities included, set ZIP by ZIP where HUD prices the metro area that way.",
    why: "Where it exists, vouchers pay against it rather than the county figure, so it tracks rents street by street more closely.",
  },
  hud_safmr_4br: {
    what: "HUD’s rent standard for a modest four-bedroom home in this ZIP code, utilities included, set ZIP by ZIP where HUD prices the metro area that way.",
    why: "Where it exists, vouchers pay against it rather than the county figure, so it tracks rents street by street more closely.",
  },
  sr1a_sales_count: {
    what: "How many one- to four-family homes sold here in an arm’s-length sale over the three years shown, as the state recorded them.",
    why: "Every sales figure on this page rests on this many sales: the fewer, the more one sale can move them.",
  },
  sr1a_turnover_per_1000: {
    what: "How many homes sold here in a year, on average over the three years shown, for every 1,000 homes on the tax rolls.",
    why: "How often homes change hands. A low rate can mean few homes come up for sale, or simply that owners stay put.",
  },
  sr1a_price_lower_quartile: {
    what: "A quarter of the homes that sold here went for less than this, over three years.",
    why: "The cheaper end of what actually sells, which a median hides.",
  },
  sr1a_price_upper_quartile: {
    what: "A quarter of the homes that sold here went for more than this, over three years.",
    why: "With the lower quarter, it shows how wide the range of prices paid is.",
  },
  sr1a_median_sale_price_12m: {
    what: "The middle price paid for homes sold here in the last twelve months on file. Shown only where 50 or more sold.",
    why: "Fresher than the three-year figure, and noisier, so it is shown only where there are enough sales.",
  },
  sr1a_median_year_built_sold: {
    what: "The middle year built of the homes that sold here over three years — the age of what changed hands, not of every home.",
    why: "Says whether buyers here are mostly buying older homes or new ones.",
  },
  sr1a_median_price_per_sqft: {
    what: "The middle sale price per square foot of living space, among homes sold here over three years that record their size.",
    why: "Compares prices across homes of different sizes, which a median price cannot.",
  },
  sr1a_median_sales_ratio: {
    what: "A home’s assessed value as a share of what it sold for, the middle of recent sales here, as the state works it out.",
    why: "Below 100% means assessments trail the market; how far is why two towns’ tax rates cannot be compared directly.",
  },
  nj_revaluation_year: {
    what: "The latest tax year the state recognized a revaluation or reassessment here, which brings assessments back toward market value. Its lists begin with 2017.",
    why: "After a revaluation, who pays what share of the tax can change, even if the total does not.",
  },
  hud_income_limit_80: {
    what: "The income below which HUD counts a family of four as low-income here: 80% of the area median.",
    why: "Many affordable-housing programs start from this line, each with rules of its own, so it is a reference point rather than a test of who qualifies.",
  },
  unemployment_rate: {
    what: "The share of the labor force — people working or looking for work — who have no job, from the Bureau of Labor Statistics.",
    why: "Jobs pay for housing; a rising rate can mean more people struggling with rent or a mortgage.",
  },

  // Homes and people
  permits_total_units: {
    what: "How many new homes builders were given permission to build here in a year, each apartment counted as one.",
    why: "More permits mean more homes on the way, which can ease prices; few mean supply is not keeping up.",
  },
  nj_units_certified: {
    what: "How many new homes were finished and certified ready to live in during the year, from each town’s construction office.",
    why: "Permits say what may be built; this says what was. A town that reported nothing has no figure, not zero.",
  },
  nj_units_certified_1_2: {
    what: "New homes finished in houses and two-family buildings.",
    why: "Shows how much of what gets built is single-family housing.",
  },
  nj_units_certified_multi: {
    what: "New homes finished in buildings of three or more homes, mostly apartments.",
    why: "Apartments add the most homes per acre, and usually the most rentals.",
  },
  nj_units_certified_mixed: {
    what: "New homes finished in buildings that also hold shops or offices.",
    why: "Homes above stores are common in downtowns and near train stations.",
  },
  nj_units_demolished: {
    what: "How many homes were torn down during the year, counted from demolition permits.",
    why: "A home demolished cancels out a home built; the net is what the stock really gained.",
  },
  nj_net_units_added: {
    what: "Homes finished minus homes demolished in the year, where the town reported both.",
    why: "The real change in how many homes there are.",
  },
  nj_net_units_per_1000: {
    what: "Net homes added in the year for every 1,000 homes already standing.",
    why: "Compares how fast places of different sizes are growing their housing. One big building can swing a small town for a year.",
  },
  nj_certificates_reporting_share: {
    what: "The share of the area’s towns whose construction offices reported finished homes that year.",
    why: "A county total only covers the towns that reported, so this says how complete it is.",
  },
  nj_demolitions_reporting_share: {
    what: "The share of the area’s towns whose construction offices reported demolitions that year.",
    why: "Says how complete the demolition total is.",
  },
  acs_housing_units: {
    what: "How many homes there are, occupied or empty, from the Census Bureau’s survey, pooled over five years.",
    why: "The size of the housing stock that new building is measured against.",
  },
  acs_vacancy_rate: {
    what: "The share of all homes standing empty, including holiday homes and homes for sale or rent.",
    why: "Low vacancy means a tight market where homes fill fast. Shore towns read high because of holiday homes.",
  },
  acs_homeownership_rate: {
    what: "The share of occupied homes lived in by their owners rather than rented out.",
    why: "It shows whether a place is mostly owners or has plenty of rentals.",
  },
  pep_population: {
    what: "The Census Bureau’s estimate of residents as of July 1, using the last census plus births, deaths and migration. Not a survey average.",
    why: "A newer population snapshot. Survey-based population stays the denominator of this site’s calculated ratios.",
  },
  acs_population: {
    what: "How many people live here, from the Census Bureau’s survey, pooled over five years.",
    why: "Growth means more people competing for homes; decline can mean the opposite.",
  },
  net_migration_returns: {
    what: "How many more households moved in than moved out, counted from the addresses on federal tax returns.",
    why: "People moving in add demand for homes; people leaving can be a sign that it has become too dear.",
  },
  irs_inflow_returns: {
    what: "Households that moved into the county from somewhere else in the year, counted from federal tax returns.",
    why: "Every one of them needed a home here. People who file no return, such as many retirees, are not counted.",
  },
  irs_outflow_returns: {
    what: "Households that moved out of the county in the year, counted from federal tax returns.",
    why: "Set against those moving in, it says whether the county is gaining or losing households.",
  },
  irs_net_migration_per_1000: {
    what: "Households moving in less those moving out, for every 1,000 tax returns filed in the county the year before.",
    why: "Compares counties of different sizes: a positive figure means the county is gaining households by moves.",
  },
  irs_inflow_agi_per_return: {
    what: "The average income reported by households that moved in, from federal tax returns.",
    why: "Newcomers with more to spend can bid more for homes. An average, so a few very high earners can lift it.",
  },
  irs_outflow_agi_per_return: {
    what: "The average income reported by households that moved out, from federal tax returns.",
    why: "Who is leaving: higher earners moving away, or households priced out.",
  },
  irs_nonmigrant_agi_per_return: {
    what: "The average income reported by households that filed in the county both years.",
    why: "The yardstick for newcomers: what the households already here earn.",
  },
  irs_arrival_income_ratio: {
    what: "The average income of households moving in, as a multiple of the average for those who stayed.",
    why: "Above 1×, newcomers bring more income than residents have, which can add pressure on prices. It does not show that they caused any rise.",
  },
  modiv_residential_parcels: {
    what: "How many one- to four-family properties are on the tax roll. A parcel is a lot and what stands on it.",
    why: "It shows how large a place’s stock of houses is, as against its apartments.",
  },
  modiv_multifamily_share: {
    what: "Apartment buildings as a share of residential properties. It counts buildings, not homes: a 200-unit building counts once.",
    why: "More apartment buildings usually mean more rentals to choose from and a denser, more mixed place.",
  },
  modiv_vacant_land_share: {
    what: "The share of properties on the tax roll that are vacant land, including wetland and preserved land that cannot be built on.",
    why: "A rough sign of how much room is left to build, to be read with care.",
  },
  modiv_median_year_built: {
    what: "The middle year one- to four-family homes here were built, from the property tax records.",
    why: "Older homes often mean more upkeep and more character; newer ones, recent building and prices to match.",
  },
  modiv_median_lot_acres: {
    what: "The middle lot size of one- to four-family homes here, in acres. An acre is 43,560 square feet.",
    why: "Bigger lots mean more space and fewer homes to a street, and usually a higher price per home.",
  },

  // Flood and environment (Milestone 40)
  fema_flood_homes_share: {
    what: "The share of homes inside FEMA’s 1%-a-year flood zone, estimated from the 2020 Census’s homes against FEMA’s map in force.",
    why: "A flood there has at least a 26% chance over a 30-year mortgage, and a federally backed mortgage requires flood insurance. Outside the zone is not safe.",
  },
  fema_flood_homes_share_moderate: {
    what: "The share of homes in FEMA’s 0.2%-a-year flood zone, or behind a levee.",
    why: "Insurance is not required there, but floods still reach it.",
  },
  fema_flood_homes: {
    what: "How many homes, as counted in 2020, are estimated to be in FEMA’s 1% flood zone.",
    why: "The number behind the share.",
  },
  fema_mapped_homes_share: {
    what: "The share of homes where FEMA’s digital flood map gives a flood zone at all.",
    why: "Below 95%, no share in the zones is given: a share over homes the map does not reach would read as dry. Most of Morris County is in that position.",
  },
  njdep_tidal_homes_share: {
    what: "The share of homes in NJDEP’s tidal flood area with four feet of sea-level rise added, for the 14 counties NJDEP mapped.",
    why: "New Jersey plans new coastal building for this line; it is a planning layer, not a flood map in force.",
  },
  fema_flood_claims: {
    what: "Flood insurance claims the National Flood Insurance Program paid on, by the year of the flood.",
    why: "Where floods have actually cost insured owners. Only insured homes claim, so it undercounts.",
  },
  fema_flood_claims_paid: {
    what: "What the National Flood Insurance Program paid for floods in the year, in that year’s dollars.",
    why: "How costly a flood year was here.",
  },
  njdep_sites_open: {
    what: "Contaminated sites NJDEP lists whose cleanup is under way or not yet begun.",
    why: "A count, not a risk: where each site is, and what it is, is on NJDEP’s map.",
  },
  njdep_sites_post_remedy: {
    what: "Sites cleaned up with controls that stay, such as a deed notice or a limit on using the ground water.",
    why: "The land is usable, with conditions that pass to the next owner.",
  },
  njdep_sites_heating_oil: {
    what: "Leaking home heating-oil tanks being cleaned up, nearly all at houses.",
    why: "Common where homes were heated with oil; worth asking about when buying an older house.",
  },
  water_homes_share_public: {
    what: "The share of homes inside a public water system’s service area.",
    why: "The rest mostly drink from private wells, which New Jersey has tested only when a home is sold or leased.",
  },
  water_homes_share_violation: {
    what: "The share of homes whose water system had a health-based violation in the last five full years: a contaminant over its limit, or treatment not done.",
    why: "A period the water broke a rule, not a measure of the water today; each system’s record says what happened.",
  },
  lodes_resident_jobs: {
    what: "Jobs held by people who live here, wherever the job is: jobs covered by unemployment insurance and federal civilian jobs, from the Census Bureau’s LODES.",
    why: "The base the work shares are taken of. Self-employment and military jobs are not counted, and two jobs count twice.",
  },
  lodes_work_same_town_share: {
    what: "The share of residents’ jobs located in this town.",
    why: "A town where few residents work locally is one most people leave each morning.",
  },
  lodes_work_home_county_share: {
    what: "The share of residents’ jobs located in the county they live in, their own town included.",
    why: "Shows how far most residents’ work reaches.",
  },
  lodes_work_other_nj_share: {
    what: "The share of residents’ jobs in New Jersey but outside their home county.",
    why: "Part of where residents work.",
  },
  lodes_work_nyc_share: {
    what: "The share of residents’ jobs located in New York City’s five boroughs.",
    why: "Where many residents work in the city, the trip across the Hudson shapes daily life and costs.",
  },
  lodes_work_pennsylvania_share: {
    what: "The share of residents’ jobs located in Pennsylvania, Philadelphia included.",
    why: "Part of where residents work.",
  },
  lodes_work_other_state_share: {
    what: "The share of residents’ jobs outside New Jersey, New York City and Pennsylvania.",
    why: "Part of where residents work. LODES 2023 has no records for Alaska or Michigan.",
  },
  transit_rail_homes_share: {
    what: "The share of homes within half a mile, in a straight line, of a commuter rail, PATH, PATCO, subway or light rail stop.",
    why: "Nearness to a station, not how often trains call there.",
  },
  transit_bus_homes_share: {
    what: "The share of homes within a quarter mile, in a straight line, of a bus stop.",
    why: "A stop served once a day counts the same as one served every ten minutes.",
  },
  transit_any_homes_share: {
    what: "The share of homes near a rail stop (half a mile) or a bus stop (a quarter mile).",
    why: "How much of the place is within a walk of some transit.",
  },
  hmda_purchase_loans: {
    what: "Mortgages made to buy an owner-occupied home here in the year, as lenders report them under HMDA.",
    why: "How active home buying with a mortgage is here. Cash purchases and small lenders below HMDA’s thresholds are not counted.",
  },
  hmda_median_rate: {
    what: "The median interest rate on home-purchase mortgages made here in the year.",
    why: "What borrowers here actually got, not a rate anyone is offered today.",
  },
  hmda_median_loan_amount: {
    what: "The median amount borrowed to buy a home here.",
    why: "Published rounded to the middle of each $10,000 range, for privacy.",
  },
  hmda_median_ltv: {
    what: "The median loan as a share of the home’s value.",
    why: "100% less this is the typical down payment.",
  },
  hmda_median_loan_costs: {
    what: "The median of the loan costs disclosed at closing: origination charges, points and third-party services.",
    why: "Cash a buyer needs beyond the down payment.",
  },
  hmda_median_income: {
    what: "The median income lenders relied on for home-purchase mortgages here.",
    why: "Who is buying here with a mortgage.",
  },
  hmda_conventional_share: {
    what: "The share of home-purchase mortgages here that no government program insures.",
    why: "Part of how buyers here finance.",
  },
  hmda_fha_share: {
    what: "The share of home-purchase mortgages here insured by the FHA, which allows 3.5% down up to a county limit.",
    why: "A high share means many buyers here put little down.",
  },
  hmda_va_share: {
    what: "The share of home-purchase mortgages here guaranteed by the Department of Veterans Affairs.",
    why: "Part of how buyers here finance.",
  },
  hmda_denial_rate: {
    what: "Applications denied as a share of those decided.",
    why: "HMDA has no credit scores, so this is not a measure of who could qualify.",
  },
  hmda_denial_dti_share: {
    what: "The share of denials whose first stated reason was debt-to-income.",
    why: "The most common reason a purchase loan is denied.",
  },
  hmda_denial_value_share: {
    what: "The share of denials whose first stated reason was the home’s value, usually an appraisal below the price.",
    why: "Common where prices outrun appraisals.",
  },
  hmda_denial_credit_share: {
    what: "The share of denials whose first stated reason was credit history.",
    why: "Part of why loans here are denied.",
  },
  hud_fha_limit_1unit: {
    what: "The largest mortgage FHA insures on a one-unit home in this county this year.",
    why: "Above it, a 3.5%-down FHA loan is not available.",
  },
};

/** A metric's definition, or null for one the dictionary does not know yet. */
export function definitionOf(metricId: string): MetricDefinition | null {
  return DEFINITIONS[metricId] ?? null;
}
