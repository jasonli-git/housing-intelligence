import type { Metadata } from "next";
import Link from "next/link";

import { AffordExplorer } from "@/components/AffordExplorer";
import type { Place } from "@/lib/afford";
import { api, nationalMortgageRate, type RankedRegion } from "@/lib/api";
import { project } from "@/lib/geo";
import { displayName } from "@/lib/names";
import { periodLabel } from "@/lib/periods";
import { searchEntries } from "@/lib/search";

export const metadata: Metadata = {
  title: "What can I afford? — Housing",
  description: "The New Jersey counties and municipalities where the typical home is within reach of an income.",
};

// The same box the New Jersey page projects its map into.
const MAP_WIDTH = 420;
const MAP_HEIGHT = 560;

/**
 * A metric's latest value per region at one level, from its value ranking. The window is
 * required by the endpoint and ignored for `basis=value`, which has no span.
 */
async function latest(metricId: string, level: string): Promise<Map<number, RankedRegion>> {
  const ranking = await api.rankings(metricId, level, "5y", 1000, "value");
  return new Map((ranking?.items ?? []).map((item) => [item.region_id, item]));
}

/**
 * "What can I afford here" (Milestone 17): an income in, the places within reach out.
 *
 * Every county's and municipality's typical home value, rent and tax bill ride in the
 * page — about 600 places, small enough to answer every change in the browser with no
 * request, and on one page rather than 1,134. The map is the New Jersey page's county
 * map, as the ROADMAP planned: Milestone 16's map carries it to municipalities.
 */
export default async function AffordPage() {
  const [geo, counties, towns, catalog, rate, ...series] = await Promise.all([
    api.geo("county"),
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
  const [homeC, taxC, rentC, homeM, taxM, rentM] = series;

  if (!geo || !counties || !towns || !rate) {
    return (
      <main className="shell">
        <h1 className="page-title">What can I afford?</h1>
        <p className="meta">
          The API is unreachable, so there is nothing to show. <Link href="/">Back to New Jersey</Link>.
        </p>
      </main>
    );
  }

  const value = (map: Map<number, RankedRegion>, id: number) => map.get(id)?.value ?? null;
  const details = new Map(
    searchEntries([...counties.items, ...towns.items]).map((entry) => [entry.id, entry.detail]),
  );
  const countyPlaces: Place[] = counties.items.map((c) => ({
    id: c.region_id,
    name: displayName(c),
    level: "county",
    detail: null,
    home: value(homeC, c.region_id),
    tax: value(taxC, c.region_id),
    rent: value(rentC, c.region_id),
  }));
  const townPlaces: Place[] = towns.items
    .map((t): Place => ({
      id: t.region_id,
      name: t.name,
      level: "municipality",
      detail: details.get(t.region_id) ?? null,
      home: value(homeM, t.region_id),
      tax: value(taxM, t.region_id),
      rent: value(rentM, t.region_id),
    }))
    .filter((p) => p.home !== null || p.rent !== null);

  const lastPeriod = (metricId: string) => {
    const period = catalog?.find((m) => m.metric_id === metricId)?.last_period;
    return period ? periodLabel(period, metricId) : "latest";
  };

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <p className="crumbs">
            <Link href="/">New Jersey</Link>
          </p>
          <h1 className="page-title">What can I afford?</h1>
          <p className="meta">
            Where the typical home is within reach of a household income — owned or rented —
            if housing takes at most 30% of it, the line HUD uses for cost burden.
          </p>
        </div>
      </header>
      <AffordExplorer
        map={project(geo.features, MAP_WIDTH, MAP_HEIGHT)}
        counties={countyPlaces}
        towns={townPlaces}
        rate={{ value: rate.value, asOf: periodLabel(rate.period_start) }}
        asOf={{
          home: lastPeriod("zhvi_sfr"),
          rent: lastPeriod("zori_all"),
          tax: lastPeriod("modiv_median_tax_bill"),
        }}
      />
    </main>
  );
}
