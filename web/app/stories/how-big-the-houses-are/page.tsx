import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyCounties, storyPoints, storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "How big the houses really are — Housing",
  description: "The size of New Jersey's houses seen from above: every county's spread of building footprints, and the towns with the biggest and smallest.",
  path: "/stories/how-big-the-houses-are",
});

const W = 880, L = 150, R = 30, RIDGE = 24, OVERLAP = 2.4, MAX = 5000;
const SIZE = "msft_median_footprint_sqft";
const sqft = (v: number) => `${Math.round(v).toLocaleString("en-US")} sq ft`;

export default async function HowBigPage() {
  const [{ points }, counties, towns] = await Promise.all([storyPoints("how-big-the-houses-are"), storyCounties(), storyTowns([SIZE])]);
  const byCounty = new Map<number, Map<number, number>>();
  for (const p of points) {
    if (p.region_id === null || +p.x > MAX) continue;
    const m = byCounty.get(p.region_id) ?? new Map<number, number>();
    m.set(+p.x, p.y);
    byCounty.set(p.region_id, m);
  }
  const median = (m: Map<number, number>) => {
    const bins = [...m].sort((a, b) => a[0] - b[0]);
    const total = bins.reduce((a, [, n]) => a + n, 0);
    let run = 0;
    for (const [b, n] of bins) { run += n; if (run >= total / 2) return b + 100; }
    return 0;
  };
  const rows = [...byCounty].map(([id, m]) => ({ id, name: counties.get(id) ?? "", m, mid: median(m) })).sort((a, b) => b.mid - a.mid);
  const x = (v: number) => L + ((v - 400) / (MAX - 400)) * (W - L - R);
  const H = 30 + rows.length * RIDGE + RIDGE * OVERLAP + 26;
  const ridge = (m: Map<number, number>, base: number) => {
    const peak = Math.max(1, ...m.values());
    const bins = [...m].sort((a, b) => a[0] - b[0]);
    return `M${x(400)},${base} ` + bins.map(([b, n]) => `L${x(b + 100).toFixed(1)},${(base - (n / peak) * RIDGE * OVERLAP).toFixed(1)}`).join(" ") + ` L${x(MAX)},${base} Z`;
  };
  const sized = towns.filter((t) => t.values[SIZE] !== undefined).sort((a, b) => b.values[SIZE]! - a.values[SIZE]!);
  return (
    <StoryShell
      title="How big the houses really are"
      lede={<>Seen from above, a house is its roof. Each ridge is a county&rsquo;s house-sized buildings, from a 400-square-foot cottage to a 5,000-square-foot estate, piled up by size: a ridge leaning right is a county of big houses. {rows[0]?.name}&rsquo;s typical footprint is {sqft(rows[0]?.mid ?? 0)}; {rows.at(-1)?.name}&rsquo;s {sqft(rows.at(-1)?.mid ?? 0)}. Town by town, {sized[0]?.name}&rsquo;s houses are the biggest and {sized.at(-1)?.name}&rsquo;s the smallest.</>}
      note={<>Microsoft&rsquo;s US Building Footprints, traced from aerial imagery by a neural network, available under the Open Database License; the figures here are offered under the same licence. A footprint is the roof outline, so an attached garage or porch is part of it and a two-storey house counts once; rows of attached houses can trace as one long shape and fall out above 6,000 square feet. Buildings between 400 and 6,000 square feet are taken as house-sized, which takes in some shops and leaves out most sheds. Each ridge is scaled to its own peak.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ridgeline chart: for each county, how many of its house-sized buildings fall in each footprint size, largest-footprint county at the top.">
          <g className="grid" aria-hidden="true">
            {[1000, 2000, 3000, 4000, 5000].map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={20} y2={H - 22} /><text x={x(v)} y={H - 6} textAnchor="middle">{v.toLocaleString("en-US")} sq ft</text></g>)}
          </g>
          {rows.map((r, i) => {
            const base = 30 + RIDGE * OVERLAP + i * RIDGE;
            return (
              <g key={r.id}>
                <path d={ridge(r.m, base)} className="s1" fillOpacity={0.8} stroke="var(--surface-1)" strokeWidth={1.2}><title>{`${r.name}: typical footprint ${sqft(r.mid)}`}</title></path>
                <text className="sub" x={L - 8} y={base - 4} textAnchor="end">{r.name}</text>
                <circle cx={x(r.mid)} cy={base - 2} r={2.5} className="label" />
              </g>
            );
          })}
        </svg>
        <p className="story-note">The dot on each ridge is the county&rsquo;s median footprint.</p>
      </figure>
      <div className="story-two">
        <div>
          <h2 className="story-h">Biggest houses</h2>
          <ul className="count-bars">{sized.slice(0, 8).map((t) => <li key={t.id}><span><Link href={regionPath(t.id)}>{t.name}</Link><small> · {t.countyName}</small></span><span className="bar-line"><i style={{ width: `${(t.values[SIZE]! / sized[0].values[SIZE]!) * 100}%`, background: "var(--story-1)" }} />{sqft(t.values[SIZE]!)}</span></li>)}</ul>
        </div>
        <div>
          <h2 className="story-h">Smallest houses</h2>
          <ul className="count-bars">{sized.slice(-8).reverse().map((t) => <li key={t.id}><span><Link href={regionPath(t.id)}>{t.name}</Link><small> · {t.countyName}</small></span><span className="bar-line"><i style={{ width: `${(t.values[SIZE]! / sized[0].values[SIZE]!) * 100}%`, background: "var(--story-2)" }} />{sqft(t.values[SIZE]!)}</span></li>)}</ul>
        </div>
      </div>
    </StoryShell>
  );
}
