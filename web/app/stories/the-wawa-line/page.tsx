import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyShapes, storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The Wawa line — Housing",
  description: "Where Wawa gives way to QuickChek across New Jersey, and what homes cost on each side.",
  path: "/stories/the-wawa-line",
});

const MAP_W = 560;
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

export default async function WawaLinePage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, "osm_wawa_count", "osm_quickchek_count"]), storyShapes("municipality", MAP_W)]);
  const byId = new Map(towns.map((t) => [t.id, t]));
  const centres = new Map(map.shapes.map((s) => [s.id, s.centre]));
  const side = (t: (typeof towns)[number]) => {
    const w = t.values.osm_wawa_count ?? 0, q = t.values.osm_quickchek_count ?? 0;
    return w && !q ? "wawa" : q && !w ? "quickchek" : w && q ? "both" : null;
  };
  // The line itself: in each band of the map from south to north, Wawa's share of the two
  // chains' stores. Bands are rows of the map, so north is up as on the map beside it.
  const BANDS = 14;
  const height = map.projector.height;
  const bands = Array.from({ length: BANDS }, (_, i) => ({ i, wawa: 0, quickchek: 0, counties: new Map<string, number>() }));
  for (const t of towns) {
    const c = centres.get(t.id);
    if (!c) continue;
    const b = bands[Math.min(BANDS - 1, Math.floor((c[1] / height) * BANDS))];
    b.wawa += t.values.osm_wawa_count ?? 0;
    b.quickchek += t.values.osm_quickchek_count ?? 0;
    b.counties.set(t.countyName, (b.counties.get(t.countyName) ?? 0) + 1);
  }
  // A band is named by the county most of its towns are in.
  const bandName = (b: (typeof bands)[number]) => [...b.counties].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "";
  // Where the share first falls below half going north: the line, as a map height.
  const crossing = [...bands].reverse().find((b) => b.wawa + b.quickchek > 0 && b.quickchek > b.wawa);
  const lineY = crossing ? Math.round(((crossing.i + 1) / BANDS) * height) : null;
  // Prices on each side, each town against its own county, in counties with both kinds.
  const rel = relativePrices(towns);
  const counties = new Set(towns.filter((t) => side(t) === "wawa").map((t) => t.county));
  const mixed = new Set(towns.filter((t) => side(t) === "quickchek" && counties.has(t.county)).map((t) => t.county));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const group = (k: string) => towns.filter((t) => side(t) === k && mixed.has(t.county) && rel.has(t.id));
  const wawaTowns = group("wawa"), qcTowns = group("quickchek");
  const gap = Math.exp(mean(qcTowns.map((t) => rel.get(t.id)!)) - mean(wawaTowns.map((t) => rel.get(t.id)!))) - 1;
  const total = { wawa: towns.reduce((a, t) => a + (t.values.osm_wawa_count ?? 0), 0), quickchek: towns.reduce((a, t) => a + (t.values.osm_quickchek_count ?? 0), 0) };
  const slot = { wawa: "s2", quickchek: "s1", both: "s3" } as const;
  return (
    <StoryShell
      title="The Wawa line"
      lede={<>Ask where North Jersey ends and South Jersey begins and you get an argument. The convenience stores answer it: {total.wawa} Wawas fill the south, {total.quickchek} QuickCheks the north, and the line where one gives way to the other runs across the middle of the state. And the price of a home? In the {mixed.size} counties the line cuts through, {Math.abs(gap) < 0.05 ? <>QuickChek towns and Wawa towns cost about the same ({pct(gap)}): the line divides habits, not wealth.</> : <>QuickChek towns&rsquo; homes run {pct(gap)} against Wawa towns&rsquo; in the same county.</>}</>}
      note={<>Stores: OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License; the counts here are offered under the same licence. A store mapped twice, its shop and its pumps, is counted once. Volunteer-mapped, so a store nobody added is missing. Prices: Zillow&rsquo;s typical home value, each town against its own county&rsquo;s average, compared only in counties holding both kinds of town.</>}
    >
      <div className="story-two">
        <figure className="story-figure" tabIndex={0}>
          <p className="ladder-key"><span><i style={{ background: "var(--story-2)" }} />Wawa only</span><span><i style={{ background: "var(--story-1)" }} />QuickChek only</span><span><i style={{ background: "var(--story-3)" }} />Both</span></p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${height}`} role="img" aria-label="Map of New Jersey's towns coloured by whether they have Wawa stores, QuickChek stores, both or neither, with the line where QuickChek takes over.">
            {map.shapes.map((s) => {
              const t = byId.get(s.id), k = t ? side(t) : null;
              return <path key={s.id} d={s.d} className={`town ${k ? slot[k] : "muted"}`} fillOpacity={k ? 0.85 : 1}><title>{t ? `${t.name}: ${t.values.osm_wawa_count ?? 0} Wawa, ${t.values.osm_quickchek_count ?? 0} QuickChek` : s.name}</title></path>;
            })}
            {lineY !== null && (
              <g aria-hidden="true">
                <line x1={0} x2={MAP_W} y1={lineY} y2={lineY} className="ratio-line" strokeWidth={2} />
                <text className="place" x={8} y={lineY - 8}>QuickChek country ↑</text>
                <text className="place" x={8} y={lineY + 18}>Wawa country ↓</text>
              </g>
            )}
          </svg>
        </figure>
        <div>
          <h2 className="story-h">Wawa&rsquo;s share, south to north</h2>
          <p className="story-note">Each bar is a band across the map, at the height of the band beside it: Wawa&rsquo;s share of the two chains&rsquo; stores there.</p>
          <ul className="count-bars">
            {bands.filter((b) => b.wawa + b.quickchek > 0).map((b) => {
              const share = b.wawa / (b.wawa + b.quickchek);
              return (
                <li key={b.i}>
                  <span>{bandName(b)}<small> {b.i === 0 ? "· north" : b.i === BANDS - 1 ? "· south" : ""}</small></span>
                  <span className="stacked-bar" role="img" aria-label={`${Math.round(share * 100)}% Wawa`}>
                    {b.wawa ? <i style={{ width: `${share * 100}%`, background: "var(--story-2)" }} /> : null}
                    {b.quickchek ? <i style={{ width: `${(1 - share) * 100}%`, background: "var(--story-1)" }} /> : null}
                  </span>
                  <small>{b.wawa} Wawa · {b.quickchek} QuickChek</small>
                </li>
              );
            })}
          </ul>
          <h2 className="story-h">Either side, same county</h2>
          <p className="story-note">{qcTowns.length} QuickChek-only towns against {wawaTowns.length} Wawa-only towns, in {[...mixed].length} counties the line crosses. Pricier on the QuickChek side: {[...qcTowns].sort((a, b) => rel.get(b.id)! - rel.get(a.id)!).slice(0, 3).map((t, i) => <span key={t.id}>{i ? ", " : ""}<Link href={regionPath(t.id)}>{t.name}</Link></span>)}.</p>
        </div>
      </div>
    </StoryShell>
  );
}
