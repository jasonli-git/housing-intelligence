import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import { PRICE, relativePrices, trend } from "@/lib/stories";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { artifactUrl } from "@/lib/api";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The long commute premium — Housing",
  description: "Why New Jersey towns with longer commutes have pricier homes, not cheaper ones.",
  path: "/stories/the-long-commute-premium",
});

const W = 880, H = 520, L = 70, R = 190, T = 30, B = 46;
/** A town where this share of working residents work in New York City counts as a New York commuter town. */
const NYC_LINE = 0.15;
const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

export default async function LongCommutePremiumPage() {
  const initial = await initialPlaceStory("commute");
  const towns = await storyTowns([PRICE, "acs_mean_commute_minutes", "lodes_work_nyc_share"]);
  const rel = relativePrices(towns);
  const pts = towns.flatMap((t) => (rel.has(t.id) && t.values.acs_mean_commute_minutes ? [{ t, x: t.values.acs_mean_commute_minutes, y: rel.get(t.id)!, nyc: (t.values.lodes_work_nyc_share ?? 0) >= NYC_LINE }] : []));
  const groups = [
    { key: "nyc", label: "New York commuter towns", slot: "s2", pts: pts.filter((p) => p.nyc) },
    { key: "rest", label: "Everywhere else", slot: "s1", pts: pts.filter((p) => !p.nyc) },
  ].map((g) => ({ ...g, fit: trend(g.pts.map((p) => [p.x, p.y])) }));
  const all = trend(pts.map((p) => [p.x, p.y]));
  const per10 = (slope: number) => Math.exp(slope * 10) - 1;
  const [x0, x1] = [Math.floor(Math.min(...pts.map((p) => p.x)) / 5) * 5, Math.ceil(Math.max(...pts.map((p) => p.x)) / 5) * 5];
  const span = Math.max(...pts.map((p) => Math.abs(p.y))) * 1.05;
  const x = (v: number) => Math.round((L + ((v - x0) / (x1 - x0)) * (W - L - R)) * 10) / 10;
  const y = (v: number) => Math.round((T + ((span - v) / (2 * span)) * (H - T - B)) * 10) / 10;
  const yTicks = [0.5, 0.75, 1, 1.5, 2, 3].map(Math.log).filter((v) => Math.abs(v) < span);
  return (
    <StoryShell
      title="The long commute premium"
      focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl} />}
      lede={<>You would expect a long commute to buy a cheaper house. In New Jersey it goes the other way: across all towns, each extra 10 minutes of commute goes with homes {pct(per10(all.slope))} dearer than the rest of their county. It is steepest in the orange towns, which send people into New York: {pct(per10(groups[0].fit.slope))} for every 10 minutes. But it holds everywhere else too, at {pct(per10(groups[1].fit.slope))}: a long commute is something buyers pay for, to live farther out.</>}
      note={<>Commute: the Census Bureau&rsquo;s mean travel time to work, one way. Price: Zillow&rsquo;s typical home value against the town&rsquo;s own county average. New York commuter towns: where {Math.round(NYC_LINE * 100)}% or more of working residents hold jobs in New York City (the Census Bureau&rsquo;s LEHD data). Lines are straight fits through each group; they describe, they do not explain.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <p className="ladder-key">{groups.map((g) => <span key={g.key}><i style={{ background: `var(--story-${g.slot.slice(1)})` }} />{g.label} ({g.pts.length})</span>)}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter plot: each town's mean commute against how much pricier or cheaper its homes are than its county's, coloured by whether it is a New York commuter town.">
          <g className="grid" aria-hidden="true">
            {Array.from({ length: (x1 - x0) / 5 + 1 }, (_, i) => x0 + i * 5).map((m) => <g key={m}><line x1={x(m)} x2={x(m)} y1={T} y2={H - B} /><text x={x(m)} y={H - B + 18} textAnchor="middle">{m} min</text></g>)}
            {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={Math.abs(v) < 1e-9 ? "zero" : undefined} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{Math.abs(v) < 1e-9 ? "county avg" : pct(Math.exp(v) - 1)}</text></g>)}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">Average commute, one way →</text>
            <text x={L} y={T - 12}>Homes dearer than the county ↑</text>
          </g>
          {pts.map((p) => (
            <circle key={p.t.id} className={`dot ${p.nyc ? "s2" : "s1"}`} cx={x(p.x)} cy={y(p.y)} r={4} fillOpacity={0.8}>
              <title>{`${p.t.name}: ${p.x.toFixed(0)} min, homes ${pct(Math.exp(p.y) - 1)} against ${p.t.countyName} County`}</title>
            </circle>
          ))}
          {groups.map((g) => {
            const xs = g.pts.map((p) => p.x), a = Math.min(...xs), b = Math.max(...xs);
            const ya = g.fit.intercept + g.fit.slope * a, yb = g.fit.intercept + g.fit.slope * b;
            return (
              <g key={g.key} aria-hidden="true">
                <line x1={x(a)} y1={y(ya)} x2={x(b)} y2={y(yb)} stroke={`var(--story-${g.slot.slice(1)})`} strokeWidth={3} />
                <text className="label" x={W - R + 10} y={y(yb) + 4}>{pct(per10(g.fit.slope))} per 10 min</text>
              </g>
            );
          })}
        </svg>
      </figure>
    </StoryShell>
  );
}
