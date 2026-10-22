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
  title: "Where you can see the stars — Housing",
  description: "The darkest night skies over New Jersey's homes, from satellite night lights, and whether dark skies cost more.",
  path: "/stories/where-you-can-see-the-stars",
});

const MAP_W = 520;
/** Brightness bands, nW/cm²/sr: one hue, brighter is lighter, as the night looks. */
const BANDS = [{ to: 2, o: 0.08, label: "dark, under 2" }, { to: 8, o: 0.3, label: "2–8" }, { to: 25, o: 0.55, label: "8–25" }, { to: 60, o: 0.78, label: "25–60" }, { to: Infinity, o: 1, label: "60+, city glow" }];
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
const glow = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toString());

export default async function SeeTheStarsPage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, "lights_homes_radiance"]), storyShapes("municipality", MAP_W)]);
  const rel = relativePrices(towns);
  const byId = new Map(towns.map((t) => [t.id, t]));
  const measured = towns.filter((t) => t.values.lights_homes_radiance !== undefined);
  // Brightness on a ratio scale: the step from 1 to 2 changes the sky as much as 40 to 80.
  const points = measured.flatMap((t) => (rel.has(t.id) ? [{ id: t.id, name: t.name, x: Math.log10(Math.max(0.1, t.values.lights_homes_radiance!)), y: rel.get(t.id)!, slot: 4, tip: `${t.name}: ${glow(t.values.lights_homes_radiance!)} nW/cm²/sr` }] : []));
  const darkest = [...measured].sort((a, b) => a.values.lights_homes_radiance! - b.values.lights_homes_radiance!).slice(0, 12);
  const halving = points.length ? fittedChange(points, -Math.log10(2)) : 0;
  const band = (v: number) => BANDS.find((b) => v < b.to)!;
  return (
    <StoryShell
      title="Where you can see the stars"
      lede="New Jersey is one of the brightest states at night: from orbit, its northeast is a single glow. A satellite measures that glow every night; averaged over a year and laid over the homes, it says where the Milky Way is still overhead, and the chart asks whether a dark sky costs more."
      note={<>Night lights: Earth Observation Group, Payne Institute for Public Policy, Colorado School of Mines, VIIRS annual night lights, CC BY 4.0: average radiance for the year with background, fires and boats masked, about 460 metres a pixel, weighted by each census block&rsquo;s homes. Brightness seen from above, not a measured sky darkness, but the two move together. Prices: Zillow&rsquo;s typical home value, each town against its own county.</>}
    >
      {!points.length ? <p className="story-note">This story is waiting for the night-lights file, which is downloaded by hand.</p> : (
        <>
          <div className="story-two">
            <figure className="story-figure">
              <p className="ladder-key">{BANDS.map((b) => <span key={b.label}><i style={{ background: "var(--story-4)", opacity: b.o }} />{b.label}</span>)}</p>
              <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by the night-time brightness over their homes; the darkest are listed beside it.">
                {map.shapes.map((s) => {
                  const t = byId.get(s.id), v = t?.values.lights_homes_radiance;
                  return <path key={s.id} d={s.d} className={`town ${v === undefined ? "muted" : "s4"}`} fillOpacity={v === undefined ? 1 : band(v).o}><title>{t && v !== undefined ? `${t.name}: ${glow(v)} nW/cm²/sr` : s.name}</title></path>;
                })}
              </svg>
            </figure>
            <div>
              <h2 className="story-h">The darkest skies over homes</h2>
              <ul className="count-bars">
                {darkest.map((t) => (
                  <li key={t.id}>
                    <span><Link href={regionPath(t.id)}>{t.name}</Link></span>
                    <span className="bar-line"><i style={{ width: `${Math.min(100, (t.values.lights_homes_radiance! / darkest.at(-1)!.values.lights_homes_radiance!) * 100)}%`, background: "var(--story-4)" }} />{glow(t.values.lights_homes_radiance!)}</span>
                    <small>{t.countyName}</small>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <figure className="story-figure">
            <h2 className="story-h">{Math.abs(halving) < 0.05 ? "Does a dark sky cost more? Hardly" : `Each halving of the glow: ${pct(halving)} on price`}</h2>
            <StoryScatter
              points={points}
              xLabel="Night-time brightness over the town's homes, nW/cm²/sr"
              xFormat={(v) => glow(10 ** v)}
              xTicks={[0.5, 2, 8, 30, 100].map(Math.log10)}
              label="Scatter plot: each town's night-time brightness against how much dearer its homes are than its county's."
              trendLabel={(per) => `${pct(per(-Math.log10(2)))} each time the glow halves`}
            />
          </figure>
        </>
      )}
    </StoryShell>
  );
}
