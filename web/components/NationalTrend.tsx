import { trendGeometry, type TrendPoint } from "@/lib/nationalBenchmarks";
import { compact } from "@/lib/nationalScoreboard";
import { periodLabel } from "@/lib/periods";
import { TrendEntrance } from "./TrendEntrance";

/** An aria-hidden echo of the same series; the full labelled plot lives in history. */
export function NationalTrendBackdrop({ points }: { points: readonly TrendPoint[] }) {
  const plot = trendGeometry(points);
  if (!plot) return null;
  return <svg className="national-score-trend" viewBox="38 0 258 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d={plot.path} />
    {plot.last && <circle cx={plot.last.x} cy={plot.last.y} r="2" />}
  </svg>;
}

/** Static real-data linework: no chart library, client fetch or decorative fake trend. */
export function NationalTrend({ points, label, metricId, frequency, unit = "percent" }: {
  points: readonly TrendPoint[]; label: string; metricId: string; frequency: string;
  /** How the scale reads: a rate or change in percent, or a level (Milestone 57). */
  unit?: "percent" | "count" | "days" | "months" | "index";
}) {
  const plot = trendGeometry(points);
  const fmt = (n: number) => unit === "percent" ? `${n.toFixed(2)}%` : unit === "count" ? compact(n) : unit === "days" ? `${Math.round(n)} days` : unit === "months" ? `${n.toFixed(1)} mo` : n.toFixed(1);
  if (!plot) return <p className="national-trend-unavailable">Not enough comparable history to plot.</p>;
  return <TrendEntrance><figure className="national-trend">
    <div className="national-trend-plot">
    <div className="national-trend-scale" aria-hidden="true"><span>{fmt(plot.max)}</span><span>{fmt(plot.min)}</span></div>
    <svg viewBox="38 0 258 80" preserveAspectRatio="none" role="img" aria-label={`${label}. ${frequency} observations, ${periodLabel(plot.from, metricId)} to ${periodLabel(plot.to, metricId)}. Plot range ${fmt(plot.min)} to ${fmt(plot.max)}; independently scaled. Gaps are not interpolated.`}>
      <line className="national-trend-guide" x1="42" x2="292" y1="16" y2="16" />
      <line className="national-trend-guide" x1="42" x2="292" y1="64" y2="64" />
      <path className="national-trend-line" pathLength="1" d={plot.path} />
      {points.map((p, i) => p.value !== null && Number.isFinite(p.value) ? <circle key={`${p.date}-${i}`} className="national-trend-dot" cx={42 + (Date.parse(p.date) - Date.parse(plot.from)) / (Date.parse(plot.to) - Date.parse(plot.from)) * 250} cy={plot.max === plot.min ? 40 : 64 - (p.value - plot.min) / (plot.max - plot.min) * 48} r="1.2"><title>{`${p.date}: ${fmt(p.value)}`}</title></circle> : null)}
      {plot.last && <circle className="national-trend-end" cx={plot.last.x} cy={plot.last.y} r="3" />}
    </svg>
    </div>
    <figcaption><span>{frequency}</span><span>{periodLabel(plot.from, metricId)} → {periodLabel(plot.to, metricId)}</span></figcaption>
  </figure></TrendEntrance>;
}
