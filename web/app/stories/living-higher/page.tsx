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
  title: "Living higher — Housing",
  description: "How high above the sea New Jersey's homes stand, which towns sit lowest, and whether height costs more.",
  path: "/stories/living-higher",
});

const MAP_W = 520;
/** Height bands for the map, in feet; one hue, darker is higher. */
const BANDS = [{ to: 10, o: 0.12, label: "under 10 ft" }, { to: 50, o: 0.3, label: "10–50" }, { to: 200, o: 0.5, label: "50–200" }, { to: 500, o: 0.72, label: "200–500" }, { to: Infinity, o: 0.95, label: "500 ft+" }];
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
const ft = (v: number) => `${Math.round(v).toLocaleString("en-US")} ft`;

export default async function LivingHigherPage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, "elevation_homes_feet", "elevation_low_homes_share", "acs_housing_units"]), storyShapes("municipality", MAP_W)]);
  const rel = relativePrices(towns);
  const byId = new Map(towns.map((t) => [t.id, t]));
  // Height on a ratio scale: the step from 10 to 20 feet matters as much as 400 to 800.
  const points = towns.flatMap((t) => (rel.has(t.id) && t.values.elevation_homes_feet ? [{ id: t.id, name: t.name, x: Math.log10(Math.max(1, t.values.elevation_homes_feet)), y: rel.get(t.id)!, slot: 1, tip: `${t.name}: homes at ${ft(t.values.elevation_homes_feet)}` }] : []));
  const lowest = towns.filter((t) => (t.values.elevation_low_homes_share ?? 0) > 0).sort((a, b) => b.values.elevation_low_homes_share! - a.values.elevation_low_homes_share!).slice(0, 15);
  const highest = [...towns].filter((t) => t.values.elevation_homes_feet).sort((a, b) => b.values.elevation_homes_feet! - a.values.elevation_homes_feet!)[0];
  const lowHomes = towns.reduce((t, x) => t + (x.values.elevation_low_homes_share ?? 0) * (x.values.acs_housing_units ?? 0), 0);
  const band = (v: number) => BANDS.find((b) => v < b.to)!;
  return (
    <StoryShell
      title="Living higher"
      lede={<>New Jersey&rsquo;s homes run from the edge of the tide to {highest ? `${ft(highest.values.elevation_homes_feet!)} in ${highest.name}` : "the Kittatinny ridge"}. About {(Math.round(lowHomes / 1000) * 1000).toLocaleString("en-US")} of them stand less than 10 feet above the sea. The chart asks whether height, so often sold as a view, comes at a price.</>}
      note={<>Height: USGS&rsquo;s 3D Elevation Program, bare earth, read at about 100 metres at each census block holding homes, weighted by its homes. Ground height, not flood risk: a seawall, a dune or a raised first floor is not in it, and the site&rsquo;s flood measures on each town&rsquo;s page are the ones to read for that. Prices: Zillow&rsquo;s typical home value, each town against its own county.</>}
    >
      <div className="story-two">
        <figure className="story-figure">
          <p className="ladder-key">{BANDS.map((b) => <span key={b.label}><i style={{ background: "var(--story-1)", opacity: b.o }} />{b.label}</span>)}</p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by the height above sea level of their homes.">
            {map.shapes.map((s) => {
              const t = byId.get(s.id), v = t?.values.elevation_homes_feet;
              return <path key={s.id} d={s.d} className={`town ${v === undefined ? "muted" : "s1"}`} fillOpacity={v === undefined ? 1 : band(v).o}><title>{t && v !== undefined ? `${t.name}: homes at ${ft(v)}` : s.name}</title></path>;
            })}
          </svg>
        </figure>
        <div>
          <h2 className="story-h">Most homes under 10 feet</h2>
          <ul className="count-bars">
            {lowest.map((t) => (
              <li key={t.id}>
                <span><Link href={regionPath(t.id)}>{t.name}</Link></span>
                <span className="bar-line"><i style={{ width: `${Math.round(t.values.elevation_low_homes_share! * 1000) / 10}%`, background: "var(--story-2)" }} />{Math.round(t.values.elevation_low_homes_share! * 100)}%</span>
                <small>{t.countyName}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figure className="story-figure">
        <h2 className="story-h">{Math.abs(fittedChange(points, Math.log10(2))) < 0.05 ? "Does height cost more? Barely, if at all" : `Each doubling of height: ${pct(fittedChange(points, Math.log10(2)))} on price`}</h2>
        <StoryScatter
          points={points}
          xLabel="Height of the town's homes above sea level"
          xFormat={(v) => ft(10 ** v)}
          xTicks={[10, 30, 100, 300, 1000].map(Math.log10)}
          label="Scatter plot: each town's height above sea level at its homes against how much dearer its homes are than its county's."
          trendLabel={(per) => `${pct(per(Math.log10(2)))} each time height doubles`}
        />
      </figure>
    </StoryShell>
  );
}
