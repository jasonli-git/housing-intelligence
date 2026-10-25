type IndexReading = { value: number; period_start: string; period_end: string };
export type TrendPoint = { date: string; value: number | null };

/** Time-proportional x coordinates, independent y scale, and no line across gaps. */
export function trendGeometry(points: readonly TrendPoint[]) {
  const valid = points.filter((p): p is TrendPoint & { value: number } => p.value !== null && Number.isFinite(p.value));
  if (valid.length < 2) return null;
  const min = Math.min(...valid.map(p => p.value));
  const max = Math.max(...valid.map(p => p.value));
  const from = Date.parse(points[0].date), to = Date.parse(points.at(-1)!.date);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  let connected = false;
  const plotted = points.map(point => {
    if (point.value === null || !Number.isFinite(point.value)) { connected = false; return null; }
    const x = 42 + (Date.parse(point.date) - from) / (to - from) * 250;
    const y = max === min ? 40 : 64 - (point.value - min) / (max - min) * 48;
    const command = `${connected ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    connected = true;
    return { x, y, command };
  });
  return { min, max, path: plotted.filter(p => p !== null).map(p => p.command).join(" "), last: plotted.at(-1), from: points[0].date, to: points.at(-1)!.date };
}

/** Exact same-month comparison; never substitute the closest available date. */
export function annualHomePriceChange(readings: readonly IndexReading[]) {
  const latest = [...readings].sort((a, b) => a.period_start.localeCompare(b.period_start)).at(-1);
  if (!latest) return null;
  const baselineDate = `${Number(latest.period_start.slice(0, 4)) - 1}${latest.period_start.slice(4)}`;
  const baseline = readings.find(r => r.period_start === baselineDate);
  if (!baseline || !Number.isFinite(baseline.value) || baseline.value <= 0 || !Number.isFinite(latest.value) || latest.value <= 0) return null;
  return { pct_change: (latest.value / baseline.value - 1) * 100, period_start: baseline.period_start, period_end: latest.period_end };
}
