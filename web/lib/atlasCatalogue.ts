/**
 * Which measures the atlas offers, and how (owner, 2026-11-09). The atlas's catalogue had
 * grown to 76 measures, many of them near-twins; a reader browsing for something to look
 * at met the same question asked three ways. Here the atlas, and only the atlas, trims
 * them: place pages and the API still carry every measure, and a shared link to a measure
 * kept out of the catalogue still opens it.
 *
 * - `VARIANTS`: one question, several readings, behind a switch on the card — whose home
 *   value, which size of home's rent, which flood area. The catalogue shows one tile for
 *   the set.
 * - `LEFT_OUT`: kept out of the catalogue, because another measure answers the reader's
 *   question better (a duplicate source, a split of a total, a technical rate) or the
 *   figure is too small to map (homes without plumbing). `null` leaves it out everywhere;
 *   a measure id leaves it out wherever that measure is published at the same level.
 */

export type Variant = { id: string; label: string; note?: string };
export type VariantSet = { name: string; members: Variant[] };

export const VARIANTS: VariantSet[] = [
  // Zillow's is current but covers 388 of New Jersey's 564 towns, the Census survey's
  // covers 560 but is owners' own estimates over five years (owner, 2026-11-09).
  { name: "Whose home value", members: [{ id: "zhvi_sfr", label: "Zillow", note: "current" }, { id: "acs_median_home_value", label: "Census", note: "every town" }] },
  {
    name: "Size of home",
    members: [
      { id: "acs_median_gross_rent", label: "All" },
      { id: "acs_median_rent_studio", label: "Studio" },
      { id: "acs_median_rent_1br", label: "1 bed" },
      { id: "acs_median_rent_2br", label: "2 beds" },
      { id: "acs_median_rent_3br", label: "3 beds" },
      { id: "acs_median_rent_4br", label: "4+ beds" },
    ],
  },
  {
    name: "Which flood area",
    members: [
      { id: "fema_flood_homes_share", label: "1% zone", note: "FEMA's 1% annual chance" },
      { id: "fema_flood_homes_share_moderate", label: "0.2% zone", note: "FEMA's 0.2% annual chance" },
      { id: "njdep_tidal_homes_share", label: "Tidal", note: "New Jersey's climate-adjusted tidal flood area" },
    ],
  },
];

export const LEFT_OUT: Record<string, string | null> = {
  // The Census estimate where the annual one is published; the survey alone covers ZIP codes.
  acs_population: "pep_population",
  // HUD's cost burdens re-tabulate the Census survey's, which also covers ZIP codes.
  chas_renter_cost_burden: null,
  chas_renter_severe_burden: null,
  chas_owner_cost_burden: null,
  // Parts of a total the catalogue keeps.
  acs_k8_private_share: null,
  acs_hs_private_share: null,
  acs_rent_lower_quartile: null,
  acs_rent_upper_quartile: null,
  // The effective rate is the one a homeowner pays; these are how it is worked out.
  nj_director_ratio: null,
  nj_general_tax_rate: null,
  // A fraction of a percent nearly everywhere: on a map, the survey's error.
  acs_lacking_plumbing_share: null,
  acs_lacking_kitchen_share: null,
  // Parcel counts, and the parcels' year built, which the Census survey's answers for homes.
  modiv_residential_parcels: null,
  modiv_vacant_land_share: null,
  modiv_median_year_built: "acs_median_year_built",
};

export function variantSetOf(metric: string): VariantSet | undefined {
  return VARIANTS.find((set) => set.members.some((m) => m.id === metric));
}

/**
 * The measures the catalogue shows from those published at a level: a variant set by its
 * first member published there, and nothing left out.
 */
export function catalogueIds(published: string[]): string[] {
  const has = new Set(published);
  return published.filter((id) => {
    if (id in LEFT_OUT) {
      const instead = LEFT_OUT[id];
      if (instead === null || has.has(instead)) return false;
    }
    const set = variantSetOf(id);
    return !set || set.members.find((m) => has.has(m.id))?.id === id;
  });
}

/**
 * A shortcut to the measures most readers come for (owner, 2026-11-09), so nobody has to
 * search a catalogue to find them. Named the way a reader would ask, each shown only where
 * the layer has it. A tile stands for its measure's whole variant set.
 */
export const SUGGESTED: { id: string; label: string }[] = [
  { id: "zhvi_sfr", label: "Home prices" },
  { id: "acs_median_gross_rent", label: "Rent" },
  { id: "modiv_median_tax_bill", label: "Property taxes" },
  { id: "price_to_income", label: "Affordability" },
  { id: "acs_median_hh_income", label: "Incomes" },
  { id: "acs_mean_commute_minutes", label: "Commute" },
  { id: "fema_flood_homes_share", label: "Flood risk" },
  { id: "transit_rail_homes_share", label: "Near a train" },
  { id: "acs_median_year_built", label: "Age of homes" },
  { id: "irs_net_migration_per_1000", label: "Moving in" },
];

/** A suggestion's ids: the measure and the rest of its variant set. */
export function suggestionIds(id: string): string[] {
  return variantSetOf(id)?.members.map((m) => m.id) ?? [id];
}
