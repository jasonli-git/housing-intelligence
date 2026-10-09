import { trendGeometry, type TrendPoint } from "@/lib/nationalBenchmarks";
import { periodLabel } from "@/lib/periods";

/** Static real-data linework: no chart library, client fetch or decorative fake trend. */
export function NationalTrend({ points, label, metricId, frequency }: {
  points: readonly TrendPoint[]; label: string; metricId: string; frequency: string;
}) {
  const plot = trendGeometry(points);
  if (!plot) return <p className="national-trend-unavailable">Not enough comparable history to plot.</p>;
  return <figure className="national-trend">
    <div className="national-trend-plot">
    <div className="national-trend-scale" aria-hidden="true"><span>{plot.max.toFixed(2)}%</span><span>{plot.min.toFixed(2)}%</span></div>
    <svg viewBox="38 0 258 80" preserveAspectRatio="none" role="img" aria-label={`${label}. ${frequency} observations, ${periodLabel(plot.from, metricId)} to ${periodLabel(plot.to, metricId)}. Plot range ${plot.min.toFixed(2)} to ${plot.max.toFixed(2)} percent; independently scaled. Gaps are not interpolated.`}>
      <line className="national-trend-guide" x1="42" x2="292" y1="16" y2="16" />
      <line className="national-trend-guide" x1="42" x2="292" y1="64" y2="64" />
      <path className="national-trend-line" d={plot.path} />
      {points.map((p, i) => p.value !== null && Number.isFinite(p.value) ? <circle key={`${p.date}-${i}`} className="national-trend-dot" cx={42 + (Date.parse(p.date) - Date.parse(plot.from)) / (Date.parse(plot.to) - Date.parse(plot.from)) * 250} cy={plot.max === plot.min ? 40 : 64 - (p.value - plot.min) / (plot.max - plot.min) * 48} r="1.2"><title>{`${p.date}: ${p.value.toFixed(2)}%`}</title></circle> : null)}
      {plot.last && <circle className="national-trend-end" cx={plot.last.x} cy={plot.last.y} r="3" />}
    </svg>
    </div>
    <figcaption><span>{frequency}</span><span>{periodLabel(plot.from, metricId)} → {periodLabel(plot.to, metricId)}</span></figcaption>
  </figure>;
}
