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
  zhvi_sfr: {
    what: "Zillow’s estimate of what a typical single-family house here is worth: one in the middle of the local market, not the cheapest or the dearest.",
    why: "It is the closest thing to “what a house costs here”, the figure a buyer’s budget starts from.",
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
  modiv_median_tax_bill: {
    what: "What the middle one- to four-family home paid in property tax last year, before any relief a household may claim.",
    why: "New Jersey’s property taxes are among the highest in the country, so this can matter as much as the price.",
  },
  mortgage_rate_30y: {
    what: "The average interest rate on a 30-year fixed-rate home loan across the country, from Freddie Mac’s weekly survey, averaged by month.",
    why: "It sets the monthly payment: on the same house, a higher rate can add hundreds of dollars a month.",
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
  hud_income_limit_80: {
    what: "The income below which HUD counts a family of four as low-income here: 80% of the area median.",
    why: "It is the cut-off for many affordable-housing programs, so it shows who can get help.",
  },
  unemployment_rate: {
    what: "The share of people looking for work who cannot find a job, from the Bureau of Labor Statistics.",
    why: "Jobs pay for housing; a rising rate can mean more people struggling with rent or a mortgage.",
  },

  // Homes and people
  permits_total_units: {
    what: "How many new homes builders were given permission to build here in a year, each apartment counted as one.",
    why: "More permits mean more homes on the way, which can ease prices; few mean supply is not keeping up.",
  },
  acs_vacancy_rate: {
    what: "The share of all homes standing empty, including holiday homes and homes for sale or rent.",
    why: "Low vacancy means a tight market where homes fill fast. Shore towns read high because of holiday homes.",
  },
  acs_homeownership_rate: {
    what: "The share of occupied homes lived in by their owners rather than rented out.",
    why: "It shows whether a place is mostly owners or has plenty of rentals.",
  },
  acs_population: {
    what: "How many people live here, from the Census Bureau’s survey, pooled over five years.",
    why: "Growth means more people competing for homes; decline can mean the opposite.",
  },
  net_migration_returns: {
    what: "How many more households moved in than moved out, counted from the addresses on federal tax returns.",
    why: "People moving in add demand for homes; people leaving can be a sign that it has become too dear.",
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
};

/** A metric's definition, or null for one the dictionary does not know yet. */
export function definitionOf(metricId: string): MetricDefinition | null {
  return DEFINITIONS[metricId] ?? null;
}
