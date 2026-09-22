import type { Place } from "@/lib/afford";
import { api, nationalMortgageRate, type RankedRegion } from "@/lib/api";
import { displayName } from "@/lib/names";
import { periodLabel } from "@/lib/periods";
import { searchEntries } from "@/lib/search";

export type AffordData = {
  counties: Place[];
  towns: Place[];
  rate: { value: number; asOf: string };
  asOf: { home: string; rent: string; tax: string };
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
  const value = (map: Map<number, RankedRegion>, id: number) => map.get(id)?.value ?? null;
  const details = new Map(searchEntries([...counties.items, ...towns.items]).map((entry) => [entry.id, entry.detail]));
  const countyPlaces: Place[] = counties.items.map((county) => ({
    id: county.region_id, name: displayName(county), level: "county", parentId: null, detail: null,
    home: value(homeC, county.region_id), tax: value(taxC, county.region_id), rent: value(rentC, county.region_id),
  }));
  const townPlaces: Place[] = towns.items.map((town): Place => ({
    id: town.region_id, name: town.name, level: "municipality", parentId: town.parent_id, detail: details.get(town.region_id) ?? null,
    home: value(homeM, town.region_id), tax: value(taxM, town.region_id), rent: value(rentM, town.region_id),
  })).filter((place) => place.home !== null || place.rent !== null);
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
