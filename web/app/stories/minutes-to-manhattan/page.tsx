import type { Metadata } from "next";

import { StoryScatter } from "@/components/StoryScatter";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyShapes, storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Minutes to Manhattan — Housing",
  description: "The fastest scheduled morning ride to Manhattan from every New Jersey town, by NJ Transit train or bus, and what a minute saved costs.",
  path: "/stories/minutes-to-manhattan",
});

const RAIL = "njt_rail_minutes_to_manhattan", BUS = "njt_bus_minutes_to_manhattan";
const MAP_W = 560;
const BANDS = [
  { under: 30, label: "Under 30 min", slot: "s2", opacity: 1 },
  { under: 45, label: "30–45", slot: "s2", opacity: 0.7 },
  { under: 60, label: "45–60", slot: "s2", opacity: 0.45 },
  { under: 90, label: "60–90", slot: "s2", opacity: 0.22 },
] as const;
const signed = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

export default async function MinutesToManhattanPage() {
  const [towns, map] = await Promise.all([storyTowns([PRICE, RAIL, BUS]), storyShapes("municipality", MAP_W)]);
  const minutes = (t: (typeof towns)[number]) => {
    const xs = [t.values[RAIL], t.values[BUS]].filter((v): v is number => v !== undefined);
    return xs.length ? Math.min(...xs) : null;
  };
  const byId = new Map(towns.map((t) => [t.id, t]));
  const rel = relativePrices(towns);
  const reach = towns.filter((t) => minutes(t) !== null);
  const points = reach.flatMap((t) => (rel.has(t.id) && minutes(t)! <= 120 ? [{ id: t.id, name: t.name, x: minutes(t)!, y: rel.get(t.id)!, slot: 2 }] : []));
  const under45 = reach.filter((t) => minutes(t)! < 45).length;
  const fastest = [...reach].sort((a, b) => minutes(a)! - minutes(b)!).slice(0, 3);
  const band = (m: number | null) => (m === null ? null : BANDS.find((b) => m < b.under) ?? null);
  return (
    <StoryShell
      title="Minutes to Manhattan"
      lede={<>The fastest scheduled weekday-morning ride to Manhattan from every New Jersey town with a NJ Transit train station or bus stop that gets there directly: the darker the town, the shorter the ride. {under45} towns are under three quarters of an hour; {fastest.map((t) => `${t.name} (${Math.round(minutes(t)!)} min)`).join(", ")} are the closest. Below, what the time is worth: each town&rsquo;s homes against its own county&rsquo;s, by its minutes to the city.</>}
      note={<>NJ Transit&rsquo;s published rail and bus timetables (GTFS), scheduled times on one ordinary Wednesday, not real ones: trips reaching New York Penn Station or the Port Authority Bus Terminal between 6 and 10 a.m. A train ending at Hoboken or Secaucus Junction counts with 20 or 15 minutes added for the onward PATH or train. A town&rsquo;s figure is the fastest ride from any stop inside it, not from every home; the drive to the station is not counted, and ferries, PATH from its own stations and private buses are not included. Data obtained from NJ Transit, which does not endorse this site. Price: Zillow&rsquo;s typical home value against the town&rsquo;s county.</>}
    >
      <div className="story-two">
        <figure className="story-figure" tabIndex={0}>
          <p className="ladder-key">{BANDS.map((b) => <span key={b.label}><i style={{ background: "var(--story-2)", opacity: b.opacity }} />{b.label}</span>)}<span><i className="typical" style={{ opacity: 0.2 }} />No direct ride</span></p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by the fastest scheduled morning ride to Manhattan, darkest along the rail lines nearest the city.">
            {map.shapes.map((s) => {
              const t = byId.get(s.id), m = t ? minutes(t) : null, b = band(m);
              return <path key={s.id} d={s.d} className={`town ${b ? b.slot : "muted"}`} fillOpacity={b ? b.opacity : 1}><title>{t ? `${t.name}: ${m === null ? "no direct ride" : `${Math.round(m)} min`}` : s.name}</title></path>;
            })}
          </svg>
        </figure>
        <figure className="story-figure" tabIndex={0}>
          <h2 className="story-h">What a minute is worth</h2>
          <StoryScatter
            points={points}
            xLabel="Minutes to Manhattan, fastest scheduled ride"
            xFormat={(v) => `${Math.round(v)} min`}
            xTicks={[20, 40, 60, 80, 100, 120]}
            label="Scatter plot: each town's fastest scheduled ride to Manhattan against how much dearer its homes are than its county's average."
            trendLabel={(per) => `${signed(per(-10))} for every 10 minutes nearer`}
            named={fastest.map((t) => t.id)}
          />
        </figure>
      </div>
    </StoryShell>
  );
}
