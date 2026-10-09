type IndexReading = { value: number; period_start: string; period_end: string };

/** Exact same-month comparison; never substitute the closest available date. */
export function annualHomePriceChange(readings: readonly IndexReading[]) {
  const latest = [...readings].sort((a, b) => a.period_start.localeCompare(b.period_start)).at(-1);
  if (!latest) return null;
  const baselineDate = `${Number(latest.period_start.slice(0, 4)) - 1}${latest.period_start.slice(4)}`;
  const baseline = readings.find(r => r.period_start === baselineDate);
  if (!baseline || !Number.isFinite(baseline.value) || baseline.value <= 0 || !Number.isFinite(latest.value) || latest.value <= 0) return null;
  return { pct_change: (latest.value / baseline.value - 1) * 100, period_start: baseline.period_start, period_end: latest.period_end };
}
