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

export type Group = { key: string; title: string; metrics: readonly string[] };

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
      "hud_fmr_2br",
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
      "chas_renter_cost_burden",
      "chas_renter_severe_burden",
      "chas_owner_cost_burden",
      "modiv_median_tax_bill",
      "nj_effective_tax_rate",
      "nj_general_tax_rate",
      // Not an affordability measure, but the figure that explains why the two rates
      // above differ, and a reader looking at them is exactly who needs it.
      "nj_director_ratio",
      "mortgage_rate_30y",
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
  const name = group ? group.key : "prices";
  return ["100", "250", "400", "550", "700"].map(
    (step) => `var(--seq-${name}-${step})`,
  );
}
