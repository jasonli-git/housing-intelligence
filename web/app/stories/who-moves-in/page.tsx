import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { api } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyCounties, storyShapes } from "@/lib/storyData";
import { arc } from "@/lib/storyMap";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Who’s moving in — Housing",
  description: "Households moving between New Jersey's counties and in from New York and Philadelphia, and how their incomes compare with those who stayed.",
  path: "/stories/who-moves-in",
});

const usd = (v: number) => formatValue(v, "usd");
const MAP_W = 520;
/** Flows smaller than this many households are left off the map, which would otherwise be a tangle. */
const SHOWN = 600;
const NYC = /^(Kings|New York|Bronx|Queens|Richmond) County, NY$/;
const PHILADELPHIA = "Philadelphia County, PA";

export default async function WhoMovesInPage() {
  const [counties, map] = await Promise.all([storyCounties(), storyShapes("county", MAP_W)]);
  const moves = await Promise.all([...counties.keys()].map((id) => api.migration(id)));
  const centres = new Map(map.shapes.map((s) => [s.id, s.centre]));
  const nyc = map.projector.point([-73.98, 40.72]), philadelphia = map.projector.point([-75.16, 39.95]);
  // Arrivals only: county A's departures to B are B's arrivals from A, so both would draw it twice.
  const flows = moves.flatMap((m) => {
    if (!m) return [];
    const to = centres.get(m.county_id);
    if (!to) return [];
    const fromNyc = m.arrivals.filter((a) => NYC.test(a.name)).reduce((s, a) => s + a.returns, 0);
    return [
      ...m.arrivals.flatMap((a) => (a.region_id && centres.has(a.region_id) ? [{ kind: "s1", from: centres.get(a.region_id)!, to, returns: a.returns, what: `${a.name} to ${m.county_name}` }] : [])),
      ...(fromNyc ? [{ kind: "s2", from: nyc, to, returns: fromNyc, what: `New York City to ${m.county_name}` }] : []),
      ...m.arrivals.filter((a) => a.name === PHILADELPHIA).map((a) => ({ kind: "s3", from: philadelphia, to, returns: a.returns, what: `Philadelphia to ${m.county_name}` })),
    ];
  }).filter((f) => f.returns >= SHOWN).sort((a, b) => a.returns - b.returns);
  const year = moves.find((m) => m?.flows_year)?.flows_year;
  const rows = moves.flatMap((m) => {
    const last = m?.years.at(-1);
    return m && last?.inflow_income && last.stayer_income ? [{ id: m.county_id, name: m.county_name, year: last.year, arrivals: last.inflow_income, stayers: last.stayer_income, leavers: last.outflow_income, net: last.net_per_1000 }] : [];
  }).sort((a, b) => b.arrivals / b.stayers - a.arrivals / a.stayers);
  // A shared scale from just under the lowest income to just over the highest, so the gaps show.
  const all = rows.flatMap((r) => [r.arrivals, r.stayers, ...(r.leavers ? [r.leavers] : [])]);
  const lo = Math.min(...all) * 0.9, hi = Math.max(...all) * 1.05;
  const at = (v: number) => Math.round(((v - lo) / (hi - lo)) * 1000) / 10;
  return (
    <StoryShell
      title="Who’s moving in"
      lede="Each arc is households moving into a county in one year: from another New Jersey county, from New York City, or from Philadelphia. Below, whether the households arriving earn more than the ones who stayed."
      note={<>Moves: the IRS&rsquo;s county-to-county migration data, counted in tax returns (roughly households) that changed county between filing years, {year ? `${year - 1} to ${year}` : "latest year"}. Flows under {SHOWN.toLocaleString("en-US")} returns are left off the map. Incomes: adjusted gross income per return. The IRS suppresses flows of fewer than 20 returns.</>}
    >
      <div className="story-two">
        <figure className="story-figure">
          <svg viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's counties with arcs for the largest flows of households moving in. The counties' figures are in the chart beside it.">
            {map.shapes.map((s) => <path key={s.id} d={s.d} className="county"><title>{counties.get(s.id)}</title></path>)}
            {flows.map((f, i) => (
              <path key={i} d={arc(f.from, f.to)} className={`flow ${f.kind}`} strokeWidth={Math.max(1, Math.sqrt(f.returns) / 9)} strokeOpacity={0.7}>
                <title>{`${f.what}: ${f.returns.toLocaleString("en-US")} households`}</title>
              </path>
            ))}
            <text className="place" x={nyc[0] - 4} y={nyc[1] - 8} textAnchor="end">New York City</text>
            <text className="place" x={philadelphia[0] + 6} y={philadelphia[1] + 4}>Philadelphia</text>
          </svg>
          <p className="ladder-key">
            <span><i style={{ background: "var(--story-1)" }} />From another NJ county</span>
            <span><i style={{ background: "var(--story-2)" }} />From New York City</span>
            <span><i style={{ background: "var(--story-3)" }} />From Philadelphia</span>
          </p>
        </figure>
        <div>
          <h2 className="story-h">Arrivals against those who stayed</h2>
          <p className="ladder-key">
            <span><i style={{ background: "var(--story-1)" }} />Arriving</span>
            <span><i className="typical" />Stayed</span>
            <span><i style={{ background: "var(--story-2)" }} />Leaving</span>
          </p>
          <ul className="ladder">
            {rows.map((r) => (
              <li key={r.id}>
                <span><Link href={regionPath(r.id)}>{r.name}</Link></span>
                <span className="ladder-track" role="img" aria-label={`${r.name}: arriving ${usd(r.arrivals)}, stayed ${usd(r.stayers)}${r.leavers ? `, leaving ${usd(r.leavers)}` : ""}`}>
                  <span className="span" style={{ left: `${Math.min(at(r.arrivals), at(r.stayers))}%`, width: `${Math.abs(at(r.arrivals) - at(r.stayers))}%` }} />
                  {r.leavers ? <i style={{ left: `${at(r.leavers)}%`, background: "var(--story-2)" }} /> : null}
                  <i className="typical" style={{ left: `${at(r.stayers)}%` }} />
                  <i style={{ left: `${at(r.arrivals)}%`, background: "var(--story-1)" }} />
                </span>
                <span className="num">{r.arrivals >= r.stayers ? "+" : "−"}{Math.abs(Math.round((r.arrivals / r.stayers - 1) * 100))}%</span>
              </li>
            ))}
          </ul>
          <p className="story-note">Ordered by how much more arrivals earn than stayers, {rows[0]?.year}.</p>
        </div>
      </div>
    </StoryShell>
  );
}
