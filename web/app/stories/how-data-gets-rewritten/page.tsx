import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { api } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "How data gets rewritten — Housing",
  description: "Every time a source revised figures this site had already published, and by how much.",
  path: "/stories/how-data-gets-rewritten",
});

const W = 880, ROW = 34, LEFT = 330, RIGHT = 30, TOP = 30;
const n = (v: number) => v.toLocaleString("en-US");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
/** A measure's name cut to fit the label column. */
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function HowDataGetsRewrittenPage() {
  const report = await api.revisions();
  const batches = [...(report?.batches ?? [])].reverse();
  // One row per measure, in the order it first appeared; a corrected figure and a month
  // still filling in are kept apart, because only the first is the source changing its mind.
  const rows = new Map<string, { label: string; under_way: boolean }>();
  for (const b of batches) for (const g of b.groups) rows.set(`${g.metric_id}:${g.under_way}`, { label: g.label, under_way: g.under_way });
  const keys = [...rows.keys()];
  const H = TOP + keys.length * ROW + 10;
  const x = (i: number) => LEFT + (batches.length === 1 ? 0.5 : i / (batches.length - 1)) * (W - LEFT - RIGHT);
  const most = Math.max(1, ...batches.flatMap((b) => b.groups.map((g) => g.figures)));
  const r = (figures: number) => 3 + Math.sqrt(figures / most) * 16;
  const zillow = batches.flatMap((b) => b.groups.filter((g) => g.metric_id === "zhvi_sfr" && !g.under_way).map((g) => ({ on: b.revised_on, g })));
  const latestZillow = zillow.at(-1);
  return (
    <StoryShell
      title="How data gets rewritten"
      lede={<>Published figures are not final. Each time this site refreshes a source it keeps the old value of every figure that changed. Each circle is one refresh rewriting one measure: the bigger, the more figures it changed. {latestZillow ? <>On {day(latestZillow.on)} alone Zillow rewrote {n(latestZillow.g.figures)} past home values across {n(latestZillow.g.places)} places, by a median of {pct(latestZillow.g.median_change)}.</> : null}</>}
      note={<>Kept since {report?.recorded_since ? day(report.recorded_since.slice(0, 10)) : "the first refresh"}, {report?.total_batches ?? 0} refreshes in all. Rows marked &ldquo;filling in&rdquo; are periods that had not ended when they changed, such as a month in progress, which is expected; the others are a source correcting a period already closed. Each place&rsquo;s page lists its own revised figures. <Link href="/freshness">Source freshness</Link> shows when each source last changed.</>}
    >
      <figure className="story-figure">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline: each refresh, and how many figures in each measure it revised. The largest Zillow revisions are in the table below.">
          <g className="grid" aria-hidden="true">
            {batches.map((b, i) => <g key={b.revised_on}><line x1={x(i)} x2={x(i)} y1={TOP - 6} y2={H - 6} /><text x={x(i)} y={16} textAnchor="middle">{day(b.revised_on)}</text></g>)}
          </g>
          {keys.map((k, j) => {
            const row = rows.get(k)!;
            return <text key={k} className="label" x={LEFT - 14} y={TOP + j * ROW + ROW / 2 + 5} textAnchor="end">{fit(row.label, row.under_way ? 30 : 42)}{row.under_way ? " (filling in)" : ""}</text>;
          })}
          {batches.map((b, i) => b.groups.map((g) => {
            const j = keys.indexOf(`${g.metric_id}:${g.under_way}`);
            return (
              <circle key={`${b.revised_on}-${g.metric_id}-${g.under_way}`} cx={x(i)} cy={TOP + j * ROW + ROW / 2} r={r(g.figures)} className={`dot ${g.under_way ? "s3" : g.metric_id.startsWith("z") ? "s2" : "s1"}`} fillOpacity={0.8}>
                <title>{`${day(b.revised_on)}, ${g.label}: ${n(g.figures)} figures in ${n(g.places)} places, median change ${pct(g.median_change)}${g.method_change ? `. ${g.method_change}` : ""}`}</title>
              </circle>
            );
          }))}
        </svg>
        <p className="ladder-key">
          <span><i style={{ background: "var(--story-2)" }} />Zillow, corrected</span>
          <span><i style={{ background: "var(--story-1)" }} />Other sources, corrected</span>
          <span><i style={{ background: "var(--story-3)" }} />Filling in</span>
        </p>
      </figure>
      {latestZillow && (
        <>
          <h2 className="story-h">Zillow&rsquo;s largest rewrites, {day(latestZillow.on)}</h2>
          <table className="story-table">
            <thead><tr><th scope="col">Place</th><th scope="col">Period</th><th scope="col" className="num">Was</th><th scope="col" className="num">Now</th><th scope="col" className="num">Change</th></tr></thead>
            <tbody>
              {latestZillow.g.largest.map((p) => (
                <tr key={`${p.region_id}-${p.period_start}`}>
                  <th scope="row">{p.has_page ? <Link href={regionPath(p.region_id)}>{p.name}</Link> : p.name}{p.county ? <small> {p.county}</small> : null}</th>
                  <td>{p.period_end.slice(0, 7)}{p.periods > 1 ? <small> and {p.periods - 1} more</small> : null}</td>
                  <td className="num">{p.old_value === null ? "—" : formatValue(p.old_value, "usd")}</td>
                  <td className="num">{p.new_value === null ? "—" : formatValue(p.new_value, "usd")}</td>
                  <td className="num">{pct(p.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="story-note">Zillow&rsquo;s home value index is smoothed and seasonally adjusted, so each new month&rsquo;s sales nudge the months before it. In {zillow.length} refreshes Zillow revised {n(zillow.reduce((t, z) => t + z.g.figures, 0))} figures in all.</p>
        </>
      )}
    </StoryShell>
  );
}
