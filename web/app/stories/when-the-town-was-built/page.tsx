import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyCounties, storyPoints } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "When the town was built — Housing",
  description: "When each New Jersey county's houses still standing were built, decade by decade, as a ridgeline.",
  path: "/stories/when-the-town-was-built",
});

const W = 880, L = 150, R = 60, RIDGE = 26, OVERLAP = 2.2, FROM = 1800, TO = 2020;

export default async function WhenBuiltPage() {
  const [{ points }, counties] = await Promise.all([storyPoints("when-the-town-was-built"), storyCounties()]);
  const byRegion = new Map<number, Map<number, number>>();
  let state: Map<number, number> | undefined;
  for (const p of points) {
    const decade = Math.max(FROM - 10, Math.min(TO, +p.x));
    if (p.region_id === null) continue;
    const m = byRegion.get(p.region_id) ?? new Map<number, number>();
    m.set(decade, (m.get(decade) ?? 0) + p.y);
    byRegion.set(p.region_id, m);
  }
  // The state's row is the one region that is not a county.
  for (const [id, m] of byRegion) if (!counties.has(id)) state = m;
  const decades = Array.from({ length: (TO - FROM) / 10 + 2 }, (_, i) => FROM - 10 + i * 10);
  const median = (m: Map<number, number>) => {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    let run = 0;
    for (const d of decades) { run += m.get(d) ?? 0; if (run >= total / 2) return d; }
    return TO;
  };
  const rows = [...byRegion].filter(([id]) => counties.has(id)).map(([id, m]) => ({ id, name: counties.get(id)!, m, mid: median(m), homes: [...m.values()].reduce((a, b) => a + b, 0) })).sort((a, b) => a.mid - b.mid || b.homes - a.homes);
  const x = (d: number) => L + ((d - (FROM - 10)) / (TO - FROM + 10)) * (W - L - R);
  const H = 30 + rows.length * RIDGE + RIDGE * OVERLAP + 24;
  const ridge = (m: Map<number, number>, base: number) => {
    const peak = Math.max(1, ...m.values());
    const pts = decades.map((d) => [x(d + 5), base - ((m.get(d) ?? 0) / peak) * RIDGE * OVERLAP] as const);
    return `M${x(FROM - 10)},${base} ` + pts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ") + ` L${x(TO + 10)},${base} Z`;
  };
  const oldest = rows[0], newest = rows.at(-1);
  return (
    <StoryShell
      title="When the town was built"
      lede={<>Each ridge is a county&rsquo;s houses still standing, piled up by the decade they were built: a ridge that peaks early is a county the 1920s finished, one that peaks late was farmland until the Parkway came. {oldest?.name} is the oldest, half its houses built by the {oldest?.mid}s; {newest?.name} the newest, half built only by the {newest?.mid}s.{state ? <> Statewide, the 1950s built more of today&rsquo;s houses than any other decade.</> : null}</>}
      note={<>MOD-IV, the state&rsquo;s property tax list: one-to-four-family houses (class 2) with a year of construction, counted by decade. Each ridge is scaled to its own peak, so it shows when, not how many. Only houses still standing are counted, so older decades are what survived, and an assessor&rsquo;s year for an old house is often an estimate. Houses built before 1800 are gathered at the left edge.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ridgeline chart: for each county, the share of its standing houses built in each decade, oldest county at the top.">
          <g className="grid" aria-hidden="true">
            {[1800, 1850, 1900, 1950, 2000].map((d) => <g key={d}><line x1={x(d)} x2={x(d)} y1={20} y2={H - 22} /><text x={x(d)} y={H - 6} textAnchor="middle">{d === 1800 ? "before 1800 · 1800" : d}</text></g>)}
          </g>
          {rows.map((r, i) => {
            const base = 30 + RIDGE * OVERLAP + i * RIDGE;
            return (
              <g key={r.id}>
                <path d={ridge(r.m, base)} className="s1" fillOpacity={0.8} stroke="var(--surface-1)" strokeWidth={1.2}><title>{`${r.name}: half its ${r.homes.toLocaleString("en-US")} houses built by the ${r.mid}s`}</title></path>
                <text className="sub" x={L - 8} y={base - 4} textAnchor="end">{r.name}</text>
                <circle cx={x(r.mid + 5)} cy={base - 2} r={2.5} className="label" />
              </g>
            );
          })}
        </svg>
        <p className="story-note">The dot on each ridge marks the decade by which half the county&rsquo;s standing houses had been built.</p>
      </figure>
    </StoryShell>
  );
}
