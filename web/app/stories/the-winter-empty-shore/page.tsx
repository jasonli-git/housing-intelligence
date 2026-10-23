import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyShapes, storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The winter-empty Shore — Housing",
  description: "The New Jersey towns where most homes are kept for seasonal use and stand empty much of the year.",
  path: "/stories/the-winter-empty-shore",
});

const MAP_W = 560;
const SHADES = [{ from: 0.5, o: 0.95, label: "Half or more" }, { from: 0.25, o: 0.6, label: "A quarter to half" }, { from: 0.1, o: 0.3, label: "A tenth to a quarter" }];
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function WinterEmptyShorePage() {
  const [towns, map] = await Promise.all([storyTowns(["acs_vacant_seasonal_share", "acs_vacancy_rate", "acs_housing_units"]), storyShapes("municipality", MAP_W)]);
  const rows = towns
    // The survey counts seasonal homes as a share of empty ones; times the vacancy rate, a share of all homes.
    .filter((t) => t.values.acs_vacant_seasonal_share !== undefined && t.values.acs_vacancy_rate !== undefined && t.values.acs_housing_units)
    .map((t) => {
      const share = t.values.acs_vacant_seasonal_share! * t.values.acs_vacancy_rate!;
      return { t, share, homes: t.values.acs_housing_units! * share };
    })
    .sort((a, b) => b.share - a.share);
  const byId = new Map(rows.map((r) => [r.t.id, r]));
  const total = rows.reduce((t, r) => t + r.homes, 0);
  const majority = rows.filter((r) => r.share >= 0.5);
  const shade = (s: number) => SHADES.find((x) => s >= x.from);
  const top = rows.slice(0, 20);
  return (
    <StoryShell
      title="The winter-empty Shore"
      lede={<>About {n(total)} New Jersey homes are kept for seasonal use: lived in for weeks a year and empty the rest. In {majority.length} towns they are the majority, so a winter street there is mostly dark windows. Nearly all of them sit on a thin line along the coast.</>}
      note={<>The Census Bureau&rsquo;s five-year American Community Survey: homes vacant because they are held for seasonal, recreational or occasional use, as a share of all homes (the survey&rsquo;s share of empty homes, times the vacancy rate). A survey of a few homes in a small town carries a wide margin of error; each town&rsquo;s page shows it.</>}
    >
      <div className="story-two">
        <figure className="story-figure" tabIndex={0}>
          <p className="ladder-key">{SHADES.map((s) => <span key={s.from}><i style={{ background: "var(--story-1)", opacity: s.o }} />{s.label} kept for the season</span>)}</p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by the share of homes kept for seasonal use. The highest are listed beside it.">
            {map.shapes.map((s) => {
              const r = byId.get(s.id), sh = r ? shade(r.share) : undefined;
              return <path key={s.id} d={s.d} className={`town ${sh ? "seq" : "muted"}`} fillOpacity={sh?.o ?? 1}><title>{r ? `${r.t.name}: ${pct(r.share)} seasonal` : s.name}</title></path>;
            })}
          </svg>
        </figure>
        <div>
          <h2 className="story-h">Most homes kept for the season</h2>
          <ul className="count-bars">
            {top.map((r) => (
              <li key={r.t.id}>
                <span><Link href={regionPath(r.t.id)}>{r.t.name}</Link></span>
                <span className="bar-line"><i style={{ width: `${Math.round(r.share * 1000) / 10}%`, background: "var(--story-1)" }} />{pct(r.share)}</span>
                <small>{n(r.homes)} of {n(r.t.values.acs_housing_units!)} homes · {r.t.countyName}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </StoryShell>
  );
}
