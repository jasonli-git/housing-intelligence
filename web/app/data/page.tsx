import type { Metadata } from "next";

import { Crumbs } from "@/components/Crumbs";
import { DataExplorer } from "@/components/DataExplorer";
import { DataStory, type Coverage, type Example, type Update } from "@/components/DataStory";
import story from "@/components/DataStory.module.css";
import { Masthead } from "@/components/Masthead";
import { api, regionsWithData } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import { shapes } from "@/lib/storyMap";

export const metadata: Metadata = pageMetadata({
  title: "How the data is built — Housing",
  description: "How the site's data is organized, where it comes from, how it is transformed and what each figure means.",
  path: "/data",
});

/** MOCK (2026-11-13): the worked example, one real figure followed through the pipeline. */
const EXAMPLE = { region: 344, metric: "modiv_median_tax_bill", parcels: "modiv_residential_parcels" };

/** How the data is built (Milestone 59's Data explorer, as one page in the MOCK of 2026-11-13). */
export default async function DataPage() {
  const [catalog, regions, freshness, geo, packet] = await Promise.all([
    api.catalog(), regionsWithData(), api.freshness(), api.geo("municipality", "NJ", 0.0008), api.packet(EXAMPLE.region, "5y"),
  ]);
  const count = (level: string) => regions.filter((r) => r.level === level).length;
  const places = { towns: count("municipality"), counties: count("county"), zips: count("zip") };

  // The coverage map: every town shaded by how many values it holds. Towns Zillow tracks
  // carry its monthly history, which is most of the difference.
  const towns = regions.filter((r) => r.level === "municipality");
  const counted = await Promise.all(towns.map(async (t) => {
    const [count, townPacket] = await Promise.all([api.regionValueCount(t.region_id), api.packet(t.region_id, "5y")]);
    return { id: t.region_id, n: count?.total ?? 0, zillow: Boolean(townPacket?.levels.some((l) => l.metric_id === "zhvi_sfr")) };
  }));
  const held = new Map(counted.map((t) => [t.id, t.n]));
  const middle = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  const tracked = counted.filter((t) => t.zillow), untracked = counted.filter((t) => !t.zillow);
  const split = { zillowTowns: tracked.length, zillow: middle(tracked.map((t) => t.n)), other: middle(untracked.map((t) => t.n)) };
  const drawn = geo ? shapes(geo.features, 640) : null;
  const coverage: Coverage | null = drawn ? {
    width: drawn.projector.width, height: drawn.projector.height, split,
    towns: drawn.shapes.map((s, i) => ({ d: s.d, n: held.get(Number(geo!.features[i].properties.region_id)) ?? 0, name: String(geo!.features[i].properties.name ?? "") })),
  } : null;

  // The worked example's real values.
  const level = packet?.levels.find((l) => l.metric_id === EXAMPLE.metric);
  const source = packet?.sources.find((s) => s.source_id === level?.source_id);
  const example: Example | null = level && source && packet ? {
    place: packet.region.name, value: level.value, year: level.period_end.slice(0, 4), rank: level.rank, of: level.of,
    source: source.name, fetched: source.fetched_at?.slice(0, 10) ?? null,
    parcels: packet.levels.find((l) => l.metric_id === EXAMPLE.parcels)?.value ?? null,
    model: catalog?.models.find((m) => m.metrics.includes(EXAMPLE.metric))?.name ?? null,
    metric: EXAMPLE.metric, href: "/nj/hoboken/full#tax",
  } : null;

  // What arrived most recently, and what is due next.
  const updates: Update[] = (freshness?.sources ?? []).filter((s) => s.acquired_at)
    .sort((a, b) => b.acquired_at!.localeCompare(a.acquired_at!)).slice(0, 6)
    .map((s) => ({ name: s.name, publisher: s.publisher, at: s.acquired_at!.slice(0, 10), next: s.expected?.[0] ? `${s.expected[0].covers}, due ${s.expected[0].day}` : null }));

  return <>
    <Masthead affordability={{ kind: "route" }} />
    <main id="main-content" tabIndex={-1} className="shell">
      <Crumbs trail={[{ href: "/", label: "Home" }]} here="How the data is built" />
      {catalog ? <>
        <DataStory catalog={catalog} places={places} coverage={coverage} example={example} updates={updates} />
        {/* MOCK (2026-11-13): the original six tabs, kept whole for technical readers. */}
        <details className={story.developers}>
          <summary><b>For developers</b><span>The original Data explorer: dictionary, schema, lineage, profiling, warehouse and ERD</span></summary>
          <DataExplorer catalog={catalog} />
        </details>
      </> : <p className="meta">The catalog is unavailable, so there is nothing to show.</p>}
    </main>
  </>;
}
