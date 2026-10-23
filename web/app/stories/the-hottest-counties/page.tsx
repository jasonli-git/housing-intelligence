import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { latestFor, seriesFor, storyCounties } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The hottest counties — Housing",
  description: "How many days a summer each New Jersey county now passes 90°F, against the thirty years from 1951, and where the shade is.",
  path: "/stories/the-hottest-counties",
});

const HEAT = "nclimgrid_days_over_90", SHADE = "tree_canopy_homes_share";
const THEN: [number, number] = [1951, 1980], NOW: [number, number] = [1996, 2025];
const W = 880, H = 520, T = 30, B = 40, X0 = 260, X1 = 620;

export default async function HottestCountiesPage() {
  const counties = await storyCounties();
  const ids = [...counties.keys()];
  const [series, shade] = await Promise.all([seriesFor(HEAT, ids), latestFor([SHADE], "county", ids)]);
  const mean = (s: { year: number; value: number }[], [a, b]: [number, number]) => {
    const xs = s.filter((o) => o.year >= a && o.year <= b).map((o) => o.value);
    return xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : NaN;
  };
  const rows = [...series].map(([id, s]) => ({ id, name: counties.get(id) ?? "", then: mean(s, THEN), now: mean(s, NOW), canopy: shade.get(id)?.[SHADE] })).filter((r) => Number.isFinite(r.then) && Number.isFinite(r.now));
  const top = Math.ceil(Math.max(1, ...rows.flatMap((r) => [r.then, r.now])) / 5) * 5;
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const rise = rows.reduce((a, r) => a + (r.now - r.then), 0) / (rows.length || 1);
  const hottest = [...rows].sort((a, b) => b.now - a.now)[0];
  const coolest = [...rows].sort((a, b) => a.now - b.now)[0];
  const medianShade = [...rows.map((r) => r.canopy ?? 0)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0;
  // Labels on each side, nudged apart so 21 names do not overprint.
  const spread = (vals: { id: number; v: number }[]) => {
    const sorted = [...vals].sort((a, b) => y(a.v) - y(b.v));
    const out = new Map<number, number>();
    let last = -Infinity;
    for (const s of sorted) { const p = Math.max(y(s.v), last + 13); out.set(s.id, p); last = p; }
    return out;
  };
  const leftY = spread(rows.map((r) => ({ id: r.id, v: r.then }))), rightY = spread(rows.map((r) => ({ id: r.id, v: r.now })));
  return (
    <StoryShell
      title="The hottest counties"
      lede={<>Each line is a county: on the left, how many days a summer its average high passed 90°F from {THEN[0]} to {THEN[1]}; on the right, from {NOW[0]} to {NOW[1]}. Every line climbs, by {rise.toFixed(1)} days on average. {hottest?.name} is now the hottest, {hottest?.now.toFixed(0)} days a summer; {coolest?.name} the coolest. Green lines are counties whose homes stand under more tree canopy than the typical county&rsquo;s.</>}
      note={<>NOAA&rsquo;s nClimGrid-Daily maximum temperature, gridded from weather stations and averaged over each county&rsquo;s area, May to September; a day counts when the county average reached 90°F (32.2°C). A county average runs cooler than its hottest paved blocks, so these are a floor on how often a town felt it. Shade: tree canopy at the county&rsquo;s homes, from the Forest Service&rsquo;s canopy map; a county&rsquo;s canopy is today&rsquo;s, set beside its heat, not shown to cause it.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <p className="ladder-key"><span><i style={{ background: "var(--story-3)" }} />More shade than the typical county</span><span><i style={{ background: "var(--story-2)" }} />Less</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Slope chart: days over 90°F a summer for each New Jersey county, ${THEN[0]}–${THEN[1]} against ${NOW[0]}–${NOW[1]}; every county rises.`}>
          <g className="grid" aria-hidden="true">
            {Array.from({ length: top / 5 + 1 }, (_, i) => i * 5).map((v) => <g key={v}><line x1={X0} x2={X1} y1={y(v)} y2={y(v)} /><text x={X0 - 150} y={y(v) + 4}>{v} days</text></g>)}
            <text x={X0} y={H - 12} textAnchor="middle">{THEN[0]}–{THEN[1]}</text>
            <text x={X1} y={H - 12} textAnchor="middle">{NOW[0]}–{NOW[1]}</text>
          </g>
          {rows.map((r) => {
            const shady = (r.canopy ?? 0) > medianShade;
            const cls = shady ? "s3" : "s2";
            return (
              <g key={r.id}>
                <line x1={X0} x2={X1} y1={y(r.then)} y2={y(r.now)} className={`flow ${cls}`} strokeWidth={2} stroke={`var(--story-${shady ? 3 : 2})`}><title>{`${r.name}: ${r.then.toFixed(1)} → ${r.now.toFixed(1)} days`}</title></line>
                <circle cx={X0} cy={y(r.then)} r={3} className={cls} />
                <circle cx={X1} cy={y(r.now)} r={3} className={cls} />
                <text className="sub" x={X0 - 8} y={leftY.get(r.id)! + 4} textAnchor="end">{r.name} {r.then.toFixed(0)}</text>
                <text className="sub" x={X1 + 8} y={rightY.get(r.id)! + 4}>{r.now.toFixed(0)} {r.name}</text>
              </g>
            );
          })}
        </svg>
      </figure>
    </StoryShell>
  );
}
