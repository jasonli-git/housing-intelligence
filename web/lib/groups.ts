/**
 * Which section of a region page a metric belongs to.
 *
 * A presentation concern, so it lives with the pages rather than in `config/metrics.yml`:
 * the warehouse has no stake in how a page is sectioned. The cost of keeping it here is
 * drift — a metric added to the config and not to this table — and the fallback is the
 * guard: an unlisted metric lands in "Other measures", never nowhere, and the test beside
 * this file lists the catalog so a new metric shows up there as a failure to classify.
 *
 * Within a group, rows follow the order listed here: the figure a reader looks for first
 * leads.
 */

export type Group = {
  key: string;
  title: string;
  metrics: readonly string[];
  /** The map ramp, where the group has none of its own: one of the four in tokens.css. */
  ramp?: "prices" | "affordability" | "incomes" | "housing";
};

export const GROUPS: readonly Group[] = [
  {
    key: "prices",
    title: "Prices",
    metrics: [
      "zhvi_sfr",
      // Beside the index on purpose. One is modelled, one is what buyers actually
      // paid, and SPEC principle 11 turns on a reader being able to see which is
      // which — adjacent is where that comparison is unavoidable.
      "sr1a_median_sale_price",
      "acs_median_home_value",
      "modiv_median_assessed_value",
      "zori_all",
      "acs_median_gross_rent",
      // What a place rents for by size, then how wide its rents run (Milestone 34).
      "acs_median_rent_studio",
      "acs_median_rent_1br",
      "acs_median_rent_2br",
      "acs_median_rent_3br",
      "acs_median_rent_4br",
      "acs_rent_lower_quartile",
      "acs_rent_upper_quartile",
      "hud_fmr_2br",
      // Every size, county and ZIP, for the rent comparison (Milestone 35).
      "hud_fmr_0br",
      "hud_fmr_1br",
      "hud_fmr_3br",
      "hud_fmr_4br",
      "hud_safmr_0br",
      "hud_safmr_1br",
      "hud_safmr_2br",
      "hud_safmr_3br",
      "hud_safmr_4br",
      "fhfa_hpi",
      "fhfa_hpi_all_transactions",
    ],
  },
  {
    key: "affordability",
    title: "Affordability",
    metrics: [
      "price_to_income",
      "price_to_ami",
      "rent_to_income",
      "fmr_to_income",
      "acs_renter_cost_burden",
      "acs_renter_severe_burden",
      "chas_renter_cost_burden",
      "chas_renter_severe_burden",
      "chas_owner_cost_burden",
      "acs_owner_severe_burden",
      // What owners already pay, beside the cost of buying today (Milestone 34).
      "acs_owner_costs_mortgage",
      "acs_owner_costs_no_mortgage",
      "modiv_median_tax_bill",
      "nj_effective_tax_rate",
      "nj_general_tax_rate",
      // Not an affordability measure, but the figure that explains why the two rates
      // above differ, and a reader looking at them is exactly who needs it.
      "nj_director_ratio",
      "mortgage_rate_30y",
      "mortgage_rate_30y_weekly",
    ],
  },
  {
    // The running costs of a home beyond its mortgage and tax (Milestone 33): what the
    // cost of owning reads its insurance and utility bills from, shown as levels and
    // never ranked, because the Census gives them only in brackets (ARCHITECTURE #279).
    key: "running",
    title: "Running costs",
    ramp: "affordability",
    metrics: [
      "acs_median_home_insurance",
      "acs_median_electricity",
      "acs_median_gas",
      "acs_median_water_sewer",
      "acs_median_other_fuel",
      "acs_renters_paying_utilities",
      // What the homes here are heated with, which sets the winter bills (Milestone 34).
      "acs_heat_gas_share",
      "acs_heat_electric_share",
      "acs_heat_oil_share",
      "acs_heat_propane_share",
      "acs_heat_other_share",
    ],
  },
  {
    key: "incomes",
    title: "Incomes and jobs",
    metrics: [
      "acs_median_hh_income",
      "hud_area_median_income",
      "hud_income_limit_80",
      "unemployment_rate",
    ],
  },
  {
    key: "housing",
    title: "Homes and people",
    metrics: [
      "permits_total_units",
      // What was built and what came down (Milestone 39), after what was permitted.
      "nj_units_certified",
      "nj_units_certified_1_2",
      "nj_units_certified_multi",
      "nj_units_certified_mixed",
      "nj_units_demolished",
      "nj_net_units_added",
      "nj_net_units_per_1000",
      "nj_certificates_reporting_share",
      "nj_demolitions_reporting_share",
      "acs_housing_units",
      "acs_vacancy_rate",
      "acs_homeownership_rate",
      "acs_population",
      "net_migration_returns",
      "modiv_residential_parcels",
      "modiv_multifamily_share",
      "modiv_vacant_land_share",
      "modiv_median_year_built",
      "modiv_median_lot_acres",
    ],
  },
  {
    // The homes themselves, from the ACS in depth (Milestone 34): what kind, how old, how
    // big, in what condition, and how many stand empty and why. Bands of a distribution
    // are listed in order and never ranked (ARCHITECTURE #283).
    key: "homes",
    title: "The homes",
    ramp: "housing",
    metrics: [
      "acs_share_detached",
      "acs_share_attached",
      "acs_share_2_4_units",
      "acs_share_5_19_units",
      "acs_share_20plus_units",
      "acs_share_mobile_homes",
      "acs_median_year_built",
      "acs_share_built_2000_later",
      "acs_share_built_1980_1999",
      "acs_share_built_1940_1979",
      "acs_share_built_pre_1940",
      "acs_share_0_1_bedrooms",
      "acs_share_2_bedrooms",
      "acs_share_3_bedrooms",
      "acs_share_4plus_bedrooms",
      "acs_overcrowded_share",
      "acs_lacking_plumbing_share",
      "acs_lacking_kitchen_share",
      "acs_rental_vacancy_rate",
      "acs_homeowner_vacancy_rate",
      "acs_vacant_seasonal_share",
      "acs_vacant_other_share",
    ],
  },
  {
    // How homes change hands (Milestone 36): what the deeds say, beside the median sale
    // price in "Prices", and when the town last brought assessments back to market.
    key: "sales",
    title: "How homes sell",
    ramp: "prices",
    metrics: [
      "sr1a_median_sale_price_12m",
      "sr1a_price_lower_quartile",
      "sr1a_price_upper_quartile",
      "sr1a_sales_count",
      "sr1a_median_price_per_sqft",
      "sr1a_median_year_built_sold",
      "sr1a_median_sales_ratio",
      "nj_revaluation_year",
    ],
  },
  {
    // Who lives here and how they get around (Milestone 34).
    key: "people",
    title: "Households and getting around",
    ramp: "incomes",
    metrics: [
      "acs_avg_household_size",
      "acs_living_alone_share",
      "acs_married_couple_share",
      "acs_with_children_share",
      "acs_disability_share",
      "acs_no_vehicle_share",
      "acs_commute_transit_share",
      "acs_work_from_home_share",
      "acs_commute_drove_alone_share",
      "acs_commute_walked_share",
      "acs_mean_commute_minutes",
      "acs_commute_60plus_share",
    ],
  },
];

export const OTHER: Omit<Group, "metrics"> = {
  key: "other",
  title: "Other measures",
};

export type Section<T> = { key: string; title: string; rows: T[] };

/** Rows sorted into sections in page order; an empty section is left out. */
export function groupRows<T extends { metric_id: string }>(
  rows: T[],
): Section<T>[] {
  const sections: Section<T>[] = GROUPS.map((g) => ({
    key: g.key,
    title: g.title,
    rows: [],
  }));
  const other: Section<T> = { ...OTHER, rows: [] };
  const position = new Map<string, [number, number]>();
  GROUPS.forEach((g, gi) =>
    g.metrics.forEach((m, mi) => position.set(m, [gi, mi])),
  );

  for (const row of rows) {
    const at = position.get(row.metric_id);
    (at ? sections[at[0]] : other).rows.push(row);
  }
  for (const section of sections) {
    section.rows.sort(
      (a, b) => position.get(a.metric_id)![1] - position.get(b.metric_id)![1],
    );
  }
  return [...sections, other].filter((s) => s.rows.length > 0);
}

/**
 * The sequential ramp a measure's map is drawn in, by the group it belongs to.
 *
 * Hue says what kind of question the map is answering — a price, an affordability
 * ratio, an income, the housing stock — while lightness goes on meaning magnitude, as a
 * sequential ramp must. The two never compete, because a reader sees one measure at a
 * time: within a map the hue is constant and only the lightness moves.
 *
 * Deliberately one hue per *group*, not per metric. A shade of its own for each of the
 * 29 measures would carry no information the label does not already give — nobody sees
 * two measures at once — while leaving a reader unable to tell whether a color
 * difference means "a different measure" or "a different figure", which is the one thing
 * the ramp exists to say. It would also need 29 ramps validated in two themes to buy it.
 *
 * "Other measures" falls back to the plain blue, so an unlisted metric is drawn rather
 * than dropped — the same guard `groupRows` gives it.
 */
export function rampFor(metricId: string): string[] {
  const group = GROUPS.find((g) => g.metrics.includes(metricId));
  // A group added after the four ramps (Milestone 33's running costs had none until
  // Milestone 34) borrows one, rather than naming a ramp tokens.css never defined.
  const name = group ? (group.ramp ?? group.key) : "prices";
  return ["100", "250", "400", "550", "700"].map(
    (step) => `var(--seq-${name}-${step})`,
  );
}
