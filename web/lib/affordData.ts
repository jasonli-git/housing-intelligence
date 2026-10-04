import type { Place } from "@/lib/afford";
import { api, nationalMortgageRate, type RankedRegion } from "@/lib/api";
import { displayName } from "@/lib/names";
import { periodLabel } from "@/lib/periods";
import { searchEntries } from "@/lib/search";
import { utilityTotal } from "./budgetScenario";

export type AffordData = {
  counties: Place[];
  towns: Place[];
  rate: { value: number; asOf: string };
  asOf: { home: string; rent: string; tax: string; insurance?: string; utilities?: string };
};

async function latest(metricId: string, level: string): Promise<Map<number, RankedRegion>> {
  const ranking = await api.rankings(metricId, level, "5y", 1000, "value");
  return new Map((ranking?.items ?? []).map((item) => [item.region_id, item]));
}

/** The one server-built affordability payload shared by `/` and the durable `/afford` URL. */
export async function affordData(): Promise<AffordData | null> {
  const [counties, towns, catalog, rate, ...series] = await Promise.all([
    api.regions("level=county&state=NJ&limit=50"),
    api.regions("level=municipality&state=NJ&limit=1000"),
    api.metrics(),
    nationalMortgageRate(),
    latest("zhvi_sfr", "county"),
    latest("modiv_median_tax_bill", "county"),
    latest("zori_all", "county"),
    latest("zhvi_sfr", "municipality"),
    latest("modiv_median_tax_bill", "municipality"),
    latest("zori_all", "municipality"),
  ]);
  if (!counties || !towns || !rate) return null;

  const [homeC, taxC, rentC, homeM, taxM, rentM] = series;
  // These ACS inputs are deliberately unranked. Read their annual survey series via
  // the existing comparison endpoint rather than inventing ranks or one request per town.
  // Each ACS survey has a fixed five-year span, so latest start is also latest end.
  const ids = [...counties.items, ...towns.items].map((region) => region.region_id);
  const chunks = Array.from({ length: Math.ceil(ids.length / 90) }, (_, i) => ids.slice(i * 90, (i + 1) * 90));
  const [insurance, electric, gas, water] = await Promise.all(
    ["acs_median_home_insurance", "acs_median_electricity", "acs_median_gas", "acs_median_water_sewer"].map(async (metric) => {
      const batches = await Promise.all(chunks.map((chunk) => api.costObservations(metric, chunk)));
      return new Map(batches.flatMap((batch) => (batch?.regions ?? []).flatMap((region) => {
        const last = region.series.at(-1);
        return last ? [[region.region_id, last.value] as const] : [];
      })));
    }),
  );
  const costValue = (map: Map<number, number>, id: number) => map.get(id) ?? null;
  const value = (map: Map<number, RankedRegion>, id: number) => map.get(id)?.value ?? null;
  const details = new Map(searchEntries([...counties.items, ...towns.items]).map((entry) => [entry.id, entry.detail]));
  const countyPlaces: Place[] = counties.items.map((county) => ({
    id: county.region_id, name: displayName(county), level: "county", parentId: null, detail: null,
    home: value(homeC, county.region_id), tax: value(taxC, county.region_id), rent: value(rentC, county.region_id),
    insurance: costValue(insurance, county.region_id), utilities: utilityTotal(costValue(electric, county.region_id), costValue(gas, county.region_id), costValue(water, county.region_id)),
  }));
  const townPlaces: Place[] = towns.items.map((town): Place => ({
    id: town.region_id, name: town.name, level: "municipality", parentId: town.parent_id, detail: details.get(town.region_id) ?? null,
    home: value(homeM, town.region_id), tax: value(taxM, town.region_id), rent: value(rentM, town.region_id),
    insurance: costValue(insurance, town.region_id), utilities: utilityTotal(costValue(electric, town.region_id), costValue(gas, town.region_id), costValue(water, town.region_id)),
  })); // Keep missing-data towns selectable; never substitute transaction prices in rankings.
  const lastPeriod = (metricId: string) => {
    const period = catalog?.find((metric) => metric.metric_id === metricId)?.last_period;
    return period ? periodLabel(period, metricId) : "latest";
  };
  return {
    counties: countyPlaces,
    towns: townPlaces,
    rate: { value: rate.value, asOf: periodLabel(rate.period_start) },
    asOf: {
      home: lastPeriod("zhvi_sfr"), rent: lastPeriod("zori_all"), tax: lastPeriod("modiv_median_tax_bill"),
      insurance: lastPeriod("acs_median_home_insurance"), utilities: lastPeriod("acs_median_electricity"),
    },
  };
}

/** The statewide payload pared down for one county profile's local affordability mode. */
export function affordabilityForCounty(data: AffordData, countyId: number): AffordData {
  return {
    ...data,
    counties: data.counties.filter((place) => place.id === countyId),
    towns: data.towns.filter((place) => place.parentId === countyId),
  };
}
