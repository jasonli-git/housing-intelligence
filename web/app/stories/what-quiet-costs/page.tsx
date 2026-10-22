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
  title: "What quiet costs — Housing",
  description: "How many New Jersey homes sit in the noise of highways, trains and planes, and whether quiet towns cost more.",
  path: "/stories/what-quiet-costs",
});

const MAP_W = 520;
const SHADES = [{ to: 0.1, o: 0.18, label: "under 10%" }, { to: 0.25, o: 0.42, label: "10–25%" }, { to: 0.5, o: 0.68, label: "25–50%" }, { to: Infinity, o: 0.95, label: "half or more" }];
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;
const share = (v: number) => `${Math.round(v * 100)}%`;

export default async function WhatQuietCostsPage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, "noise_homes_share_55db", "noise_homes_share_65db"]), storyShapes("municipality", MAP_W)]);
  const rel = relativePrices(towns);
  const byId = new Map(towns.map((t) => [t.id, t]));
  const measured = towns.filter((t) => t.values.noise_homes_share_55db !== undefined);
  const points = measured.flatMap((t) => (rel.has(t.id) ? [{ id: t.id, name: t.name, x: t.values.noise_homes_share_55db!, y: rel.get(t.id)!, slot: 2 }] : []));
  const loudest = [...measured].sort((a, b) => b.values.noise_homes_share_55db! - a.values.noise_homes_share_55db!).slice(0, 12);
  const per10 = points.length ? fittedChange(points, 0.1) : 0;
  const shade = (v: number) => SHADES.find((s) => v < s.to)!;
  return (
    <StoryShell
      title="What quiet costs"
      lede="Every highway, rail line and flight path casts a shadow of sound. The federal transportation noise model maps it across the country; here it is laid over New Jersey's homes, town by town, and set against what homes cost."
      note={<>Noise: the Bureau of Transportation Statistics&rsquo; National Transportation Noise Map, 2022/2023 (road 2023, rail and aviation 2022), together: the modelled 24-hour average level, dB(A). BTS says the model is simplified and not for judging one location; it is used here to compare towns. 55 dB is the level the EPA long named for outdoor activity. Weighted by each census block&rsquo;s homes. Prices: Zillow&rsquo;s typical home value, each town against its own county.</>}
    >
      {!points.length ? <p className="story-note">This story is waiting for the noise map, which is downloaded by hand.</p> : (
        <>
          <div className="story-two">
            <figure className="story-figure">
              <p className="ladder-key">{SHADES.map((s) => <span key={s.label}><i style={{ background: "var(--story-2)", opacity: s.o }} />{s.label} of homes at 55 dB+</span>)}</p>
              <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by the share of homes in transportation noise of 55 dB or more.">
                {map.shapes.map((s) => {
                  const t = byId.get(s.id), v = t?.values.noise_homes_share_55db;
                  return <path key={s.id} d={s.d} className={`town ${v === undefined ? "muted" : "s2"}`} fillOpacity={v === undefined ? 1 : shade(v).o}><title>{t && v !== undefined ? `${t.name}: ${share(v)} of homes at 55 dB or more` : s.name}</title></path>;
                })}
              </svg>
            </figure>
            <div>
              <h2 className="story-h">The loudest towns to live in</h2>
              <ul className="count-bars">
                {loudest.map((t) => (
                  <li key={t.id}>
                    <span><Link href={regionPath(t.id)}>{t.name}</Link></span>
                    <span className="stacked-bar" role="img" aria-label={`${share(t.values.noise_homes_share_55db!)} at 55 dB or more, ${share(t.values.noise_homes_share_65db ?? 0)} at 65`}>
                      <i style={{ width: share(t.values.noise_homes_share_65db ?? 0), background: "var(--story-7)" }} />
                      <i style={{ width: share(t.values.noise_homes_share_55db! - (t.values.noise_homes_share_65db ?? 0)), background: "var(--story-2)" }} />
                    </span>
                    <small>{share(t.values.noise_homes_share_55db!)} at 55 dB+ · {share(t.values.noise_homes_share_65db ?? 0)} at 65 dB+ · {t.countyName}</small>
                  </li>
                ))}
              </ul>
              <p className="ladder-key"><span><i style={{ background: "var(--story-7)" }} />65 dB or more, a busy road close by</span><span><i style={{ background: "var(--story-2)" }} />55–65 dB</span></p>
            </div>
          </div>
          <figure className="story-figure">
            <h2 className="story-h">{Math.abs(per10) < 0.05 ? "Does quiet cost more? Hardly" : per10 < 0 ? `Quiet costs: each 10 points more homes in noise, ${pct(per10)}` : `Louder towns cost more: ${pct(per10)} per 10 points of homes in noise`}</h2>
            <StoryScatter
              points={points}
              xLabel="Share of homes in noise of 55 dB or more"
              xFormat={share}
              xTicks={[0, 0.25, 0.5, 0.75, 1]}
              label="Scatter plot: each town's share of homes in transportation noise against how much dearer its homes are than its county's."
              trendLabel={(per) => `${pct(per(0.1))} per 10 points`}
            />
          </figure>
        </>
      )}
    </StoryShell>
  );
}
