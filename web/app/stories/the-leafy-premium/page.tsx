import type { Metadata } from "next";
import Link from "next/link";

import { fittedChange, StoryScatter } from "@/components/StoryScatter";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyShapes, storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The leafy premium — Housing",
  description: "How much of the ground under New Jersey's homes is shaded by trees, and whether shade goes with price.",
  path: "/stories/the-leafy-premium",
});

const MAP_W = 520;
const SHADES = [0.12, 0.3, 0.5, 0.7, 0.92];
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
/** The chart's own headline, from the fit: no claim the line does not make. */
const headline = (per10: number) => (Math.abs(per10) < 0.05 ? "Shade barely moves the price" : `Shadier towns cost ${per10 > 0 ? "more" : "less"}: ${pct(per10)} per 10 points of canopy`);

export default async function LeafyPremiumPage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, "tree_canopy_homes_share"]), storyShapes("municipality", MAP_W)]);
  const rel = relativePrices(towns);
  const byId = new Map(towns.map((t) => [t.id, t]));
  const points = towns.flatMap((t) => (rel.has(t.id) && t.values.tree_canopy_homes_share !== undefined ? [{ id: t.id, name: t.name, x: t.values.tree_canopy_homes_share, y: rel.get(t.id)!, slot: 3 }] : []));
  const sorted = [...points].sort((a, b) => b.x - a.x);
  // The bare end is named; the shady end sits under the trend label and is listed above.
  const named = sorted.slice(-2).map((p) => p.id);
  const fifth = (v: number) => Math.min(4, Math.floor(v / 0.15));
  return (
    <StoryShell
      title="The leafy premium"
      lede={<>Look down on New Jersey from a satellite and some towns&rsquo; homes sit under a green roof, others on bare pavement. The map shades each town by how much of the ground at its homes is under tree canopy; the chart asks whether the shade comes with a price.</>}
      note={<>Canopy: USDA Forest Service, NLCD Percent Tree Canopy CONUS, from Landsat, read at about 100 metres and weighted by each census block&rsquo;s homes, so it is the shade where people live rather than across a town&rsquo;s woods. Prices: Zillow&rsquo;s typical home value, each town against its own county. The line is a straight fit and describes rather than explains: leafy towns are also older, larger-lotted suburbs.</>}
    >
      <div className="story-two">
        <figure className="story-figure">
          <p className="ladder-key">{SHADES.map((o, i) => <span key={o}><i style={{ background: "var(--story-3)", opacity: o }} />{i === 4 ? "60%+" : `${i * 15}–${(i + 1) * 15}%`}</span>)}</p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by the share of ground under tree canopy at their homes.">
            {map.shapes.map((s) => {
              const t = byId.get(s.id), v = t?.values.tree_canopy_homes_share;
              return <path key={s.id} d={s.d} className={`town ${v === undefined ? "muted" : "s3"}`} fillOpacity={v === undefined ? 1 : SHADES[fifth(v)]}><title>{t && v !== undefined ? `${t.name}: ${Math.round(v * 100)}% canopy at homes` : s.name}</title></path>;
            })}
          </svg>
        </figure>
        <div>
          {[{ h: "Shadiest homes", list: sorted.slice(0, 10) }, { h: "Least shade", list: sorted.slice(-10).reverse() }].map((g) => (
            <div key={g.h}>
              <h2 className="story-h">{g.h}</h2>
              <ul className="count-bars">
                {g.list.map((p) => (
                  <li key={p.id}><span><Link href={regionPath(p.id)}>{p.name}</Link></span><span className="bar-line"><i style={{ width: `${Math.round(p.x * 1000) / 10}%`, background: "var(--story-3)" }} />{Math.round(p.x * 100)}%</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <figure className="story-figure">
        <h2 className="story-h">{headline(fittedChange(points, 0.1))}</h2>
        <StoryScatter
          points={points}
          xLabel="Ground under tree canopy at homes"
          xFormat={(v) => `${Math.round(v * 100)}%`}
          xTicks={[0, 0.2, 0.4, 0.6, 0.8]}
          label="Scatter plot: each town's tree canopy at its homes against how much dearer its homes are than its county's."
          trendLabel={(per) => `${pct(per(0.1))} per 10 points of canopy`}
          named={named}
        />
      </figure>
    </StoryShell>
  );
}
