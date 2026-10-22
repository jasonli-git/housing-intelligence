/**
 * Visual stories (Director Note "Visualizing the data", 2026-10-22): the figures behind
 * each story, computed from published values when the site is built. Pure, so every
 * number a story states is testable without a network.
 */

/** The visual stories (Director Note "Visualizing the data", 2026-10-22). */
export const STORIES = [
  { href: "/stories/pricier-towns", title: "What goes with pricier towns", blurb: "Working from home, owning, detached houses, a train nearby: which traits go with higher home values, against similar towns in the same county." },
  { href: "/stories/price-ladder", title: "The price ladder", blurb: "Every town's starter home, typical home and recent sales on one scale, so the spread and the gaps show." },
  { href: "/stories/priciest-and-cheapest", title: "Priciest and cheapest in each county", blurb: "The most and least expensive town and ZIP code in every county, widest gap first." },
];

/** A town with the latest value of each measure the stories read. */
export type StoryTown = {
  id: number;
  name: string;
  county: number;
  countyName: string;
  values: Partial<Record<string, number>>;
};

/** A trait a town has or lacks, read from one measure against a fixed line. */
export type Trait = {
  key: string;
  label: string;
  /** What having it means, in a reader's words. */
  rule: string;
  metric: string;
  has: (value: number) => boolean;
};

export const TRAITS: Trait[] = [
  { key: "wfh", label: "Many work from home", rule: "20% or more of workers work from home", metric: "acs_work_from_home_share", has: (v) => v >= 0.2 },
  { key: "owners", label: "Mostly owner-occupied", rule: "85% or more of homes lived in by their owners", metric: "acs_homeownership_rate", has: (v) => v >= 0.85 },
  { key: "detached", label: "Mostly detached houses", rule: "85% or more of homes are single-family detached", metric: "acs_share_detached", has: (v) => v >= 0.85 },
  { key: "rail", label: "Near a train", rule: "half or more of homes within reach of a rail station", metric: "transit_rail_homes_share", has: (v) => v >= 0.5 },
  { key: "old", label: "Old housing stock", rule: "30% or more of homes built before 1940", metric: "acs_share_built_pre_1940", has: (v) => v >= 0.3 },
  { key: "nyc", label: "New York jobs", rule: "10% or more of residents' jobs are in New York City", metric: "lodes_work_nyc_share", has: (v) => v >= 0.1 },
  { key: "longcommute", label: "Long commutes", rule: "15% or more of workers commute an hour or more", metric: "acs_commute_60plus_share", has: (v) => v >= 0.15 },
  { key: "overdue", label: "Assessments overdue", rule: "assessed values under 85% of sale prices (the Director's Ratio)", metric: "nj_director_ratio", has: (v) => v < 85 },
  { key: "flood", label: "Flood exposure", rule: "10% or more of homes in a flood zone", metric: "fema_flood_homes_share", has: (v) => v >= 0.1 },
  { key: "transit", label: "Transit commuters", rule: "15% or more of workers commute by public transit", metric: "acs_commute_transit_share", has: (v) => v >= 0.15 },
  { key: "water", label: "Water violations", rule: "some homes on a water system with a health-based violation since 2015", metric: "water_homes_share_violation", has: (v) => v > 0 },
  { key: "burden", label: "Strained renters", rule: "55% or more of renters spend over 30% of income on housing", metric: "acs_renter_cost_burden", has: (v) => v >= 0.55 },
  { key: "apartments", label: "Big apartment buildings", rule: "20% or more of homes in buildings of 20+ units", metric: "acs_share_20plus_units", has: (v) => v >= 0.2 },
  { key: "sites", label: "Contaminated sites", rule: "5 or more open contaminated sites", metric: "njdep_sites_open", has: (v) => v >= 5 },
];

/** The measure every story prices places by: Zillow's typical home value. */
export const PRICE = "zhvi_sfr";

export type Premium = {
  trait: Trait;
  /** Towns with the trait, and towns measured for it. */
  towns: number;
  measured: number;
  /** How much pricier a town with the trait is than one without, in the same county. */
  premium: number;
  /** Up to three towns with the trait, priciest first. */
  examples: string[];
};

/**
 * Each trait's premium: towns are compared only with towns in their own county, so the
 * trait is not standing in for "Bergen against Cumberland". A town's relative price is its
 * log value against its county's mean log value; a trait's premium is the gap between the
 * mean relative price of towns with it and towns without, as a percentage.
 * Descriptive, not causal: a trait goes with pricier towns, it does not make them so.
 */
export function traitPremiums(towns: StoryTown[], traits: Trait[] = TRAITS): Premium[] {
  const priced = towns.filter((t) => (t.values[PRICE] ?? 0) > 0);
  const byCounty = new Map<number, number[]>();
  for (const t of priced) byCounty.set(t.county, [...(byCounty.get(t.county) ?? []), Math.log(t.values[PRICE]!)]);
  const countyMean = new Map([...byCounty].map(([c, logs]) => [c, logs.reduce((a, b) => a + b, 0) / logs.length]));
  const relative = (t: StoryTown) => Math.log(t.values[PRICE]!) - countyMean.get(t.county)!;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return traits
    .map((trait) => {
      const measured = priced.filter((t) => t.values[trait.metric] !== undefined);
      const yes = measured.filter((t) => trait.has(t.values[trait.metric]!));
      const no = measured.filter((t) => !trait.has(t.values[trait.metric]!));
      if (yes.length < 5 || no.length < 5) return null;
      return {
        trait,
        towns: yes.length,
        measured: measured.length,
        premium: Math.exp(mean(yes.map(relative)) - mean(no.map(relative))) - 1,
        examples: [...yes].sort((a, b) => b.values[PRICE]! - a.values[PRICE]!).slice(0, 3).map((t) => t.name),
      };
    })
    .filter((p): p is Premium => p !== null)
    .sort((a, b) => b.premium - a.premium);
}

export type LadderRow = { id: number; name: string; countyName: string; starter: number | null; typical: number; sale: number | null };

/** Every priced town's three prices, priciest typical home first. */
export function ladder(towns: StoryTown[]): LadderRow[] {
  return towns
    .filter((t) => (t.values[PRICE] ?? 0) > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      countyName: t.countyName,
      starter: t.values.zhvi_bottom_tier ?? null,
      typical: t.values[PRICE]!,
      sale: t.values.sr1a_median_sale_price ?? null,
    }))
    .sort((a, b) => b.typical - a.typical);
}

export type Place = { id: number; name: string; value: number };
export type CountyExtremes = { county: number; countyName: string; priciest: Place; cheapest: Place; zipPriciest: Place | null; zipCheapest: Place | null; spread: number };

/** Each county's priciest and cheapest town and ZIP code by typical home value, widest gap first. */
export function extremes(towns: StoryTown[], zips: (Place & { county: number | null })[], counties: Map<number, string>): CountyExtremes[] {
  const out: CountyExtremes[] = [];
  for (const [county, countyName] of counties) {
    const here = towns.filter((t) => t.county === county && (t.values[PRICE] ?? 0) > 0).map((t) => ({ id: t.id, name: t.name, value: t.values[PRICE]! }));
    if (here.length < 2) continue;
    here.sort((a, b) => b.value - a.value);
    const z = zips.filter((p) => p.county === county).sort((a, b) => b.value - a.value);
    out.push({
      county,
      countyName,
      priciest: here[0],
      cheapest: here[here.length - 1],
      zipPriciest: z[0] ?? null,
      zipCheapest: z.length > 1 ? z[z.length - 1] : null,
      spread: here[0].value / here[here.length - 1].value,
    });
  }
  return out.sort((a, b) => b.spread - a.spread);
}

/** The centre of an outline's rings, as the mean of its points: enough to place a ZIP code. */
export function centre(rings: number[][]): [number, number] {
  let x = 0, y = 0, n = 0;
  for (const ring of rings) for (let i = 0; i + 1 < ring.length; i += 2) { x += ring[i]; y += ring[i + 1]; n++; }
  return n ? [x / n, y / n] : [NaN, NaN];
}

/** Whether a point is inside any of an outline's rings (even-odd). */
export function inside([px, py]: [number, number], rings: number[][]): boolean {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i + 1 < ring.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}
