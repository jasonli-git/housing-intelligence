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

export const OTHER: Omit<Group, "metrics"> = { key: "other", title: "Other measures" };

export type Section<T> = { key: string; title: string; rows: T[] };

/** Rows sorted into sections in page order; an empty section is left out. */
export function groupRows<T extends { metric_id: string }>(rows: T[]): Section<T>[] {
  const sections: Section<T>[] = GROUPS.map((g) => ({ key: g.key, title: g.title, rows: [] }));
  const other: Section<T> = { ...OTHER, rows: [] };
  const position = new Map<string, [number, number]>();
  GROUPS.forEach((g, gi) => g.metrics.forEach((m, mi) => position.set(m, [gi, mi])));

  for (const row of rows) {
    const at = position.get(row.metric_id);
    (at ? sections[at[0]] : other).rows.push(row);
  }
  for (const section of sections) {
    section.rows.sort((a, b) => position.get(a.metric_id)![1] - position.get(b.metric_id)![1]);
  }
  return [...sections, other].filter((s) => s.rows.length > 0);
}
