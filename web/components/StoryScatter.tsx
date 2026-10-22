import { trend } from "@/lib/stories";

/** How much dearer homes are, per `step` of x, on the straight fit through the points. */
export function fittedChange(points: ScatterPoint[], step: number): number {
  return Math.exp(trend(points.map((p) => [p.x, p.y])).slope * step) - 1;
}

export type ScatterPoint = { id: number; name: string; x: number; y: number; slot?: number; tip?: string };

const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

/**
 * Towns against how much dearer their homes are than their own county's (`y`, a log
 * ratio), with a fitted line and its slope written on the chart. `x` is whatever the
 * story asks about. Named towns are labelled; the rest carry their name on hover.
 */
export function StoryScatter({
  points,
  xLabel,
  xFormat,
  xTicks,
  label,
  trendLabel,
  named = [],
}: {
  points: ScatterPoint[];
  xLabel: string;
  xFormat: (v: number) => string;
  xTicks: number[];
  label: string;
  /** What the line's slope means, from the fitted change in y across one step of x. */
  trendLabel?: (perStep: (step: number) => number) => string;
  named?: number[];
}) {
  const W = 880, H = 500, L = 76, R = 30, T = 34, B = 46;
  const [x0, x1] = [Math.min(...xTicks, ...points.map((p) => p.x)), Math.max(...xTicks, ...points.map((p) => p.x))];
  const span = Math.max(...points.map((p) => Math.abs(p.y))) * 1.05;
  const x = (v: number) => Math.round((L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R)) * 10) / 10;
  const y = (v: number) => Math.round((T + ((span - v) / (2 * span)) * (H - T - B)) * 10) / 10;
  const fit = trend(points.map((p) => [p.x, p.y]));
  const yTicks = [0.5, 0.75, 1, 1.5, 2, 3].map(Math.log).filter((v) => Math.abs(v) < span);
  const ya = fit.intercept + fit.slope * x0, yb = fit.intercept + fit.slope * x1;
  const perStep = (step: number) => Math.exp(fit.slope * step) - 1;
  const names = new Set(named);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <g className="grid" aria-hidden="true">
        {xTicks.map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} /><text x={x(t)} y={H - B + 18} textAnchor="middle">{xFormat(t)}</text></g>)}
        {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={Math.abs(v) < 1e-9 ? "zero" : undefined} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{Math.abs(v) < 1e-9 ? "county avg" : pct(Math.exp(v) - 1)}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">{xLabel} →</text>
        <text x={L} y={T - 14}>Homes dearer than the county ↑</text>
      </g>
      {points.map((p) => (
        <circle key={p.id} className={`dot s${p.slot ?? 1}`} cx={x(p.x)} cy={y(p.y)} r={4} fillOpacity={0.8}>
          <title>{p.tip ?? `${p.name}: ${xFormat(p.x)}, homes ${pct(Math.exp(p.y) - 1)} against the county`}</title>
        </circle>
      ))}
      <line className="trend-line" x1={x(x0)} y1={y(ya)} x2={x(x1)} y2={y(yb)} aria-hidden="true" />
      {trendLabel && <text className="zone-label" x={x(x1) - 6} y={y(yb) - 12} textAnchor="end" aria-hidden="true">{trendLabel(perStep)}</text>}
      {points.filter((p) => names.has(p.id)).map((p) => {
        // A name near the right edge reads leftward, so it is never cut off.
        const left = x(p.x) > W - 200;
        return <text key={p.id} className="place" x={x(p.x) + (left ? -7 : 7)} y={y(p.y) + 4} textAnchor={left ? "end" : "start"}>{p.name}</text>;
      })}
    </svg>
  );
}
