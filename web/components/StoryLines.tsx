/** A few yearly series on one shared axis, each a fixed story colour and labelled at its end. */
export function StoryLines({
  series,
  format,
  label,
  width = 880,
  height = 320,
}: {
  series: { label: string; slot: number; points: { year: number; value: number }[] }[];
  format: (v: number) => string;
  label: string;
  width?: number;
  height?: number;
}) {
  const L = 60, R = 170, T = 16, B = 30;
  const years = series.flatMap((s) => s.points.map((p) => p.year));
  const [y0, y1] = [Math.min(...years), Math.max(...years)];
  const top = Math.max(...series.flatMap((s) => s.points.map((p) => p.value))) * 1.08;
  const x = (yr: number) => Math.round((L + ((yr - y0) / Math.max(1, y1 - y0)) * (width - L - R)) * 10) / 10;
  const y = (v: number) => Math.round((height - B - (v / top) * (height - T - B)) * 10) / 10;
  // Round gridlines: a step of 1, 2 or 5 times a power of ten, about four to the top.
  const raw = top / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((k) => k >= raw)!;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  // End labels pushed apart so two series ending close together stay readable.
  const ends = series.map((s) => ({ s, y: y(s.points.at(-1)?.value ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 16);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <g className="grid" aria-hidden="true">
        {ticks.map((t) => <g key={t}><line x1={L} x2={width - R} y1={y(t)} y2={y(t)} /><text x={L - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>)}
        {[...new Set(years)].filter((yr) => yr % 2 === y0 % 2).map((yr) => <text key={yr} x={x(yr)} y={height - 8} textAnchor="middle">{yr}</text>)}
      </g>
      {series.map((s) => (
        <g key={s.label}>
          <path d={s.points.map((p, i) => `${i ? "L" : "M"}${x(p.year)} ${y(p.value)}`).join("")} fill="none" stroke={`var(--story-${s.slot})`} strokeWidth={2} />
          {s.points.map((p) => <circle key={p.year} cx={x(p.year)} cy={y(p.value)} r={3} fill={`var(--story-${s.slot})`}><title>{`${s.label}, ${p.year}: ${format(p.value)}`}</title></circle>)}
        </g>
      ))}
      {ends.map(({ s, y: ly }) => (
        <text key={s.label} className="label" x={width - R + 8} y={ly + 4}>{s.label} {s.points.at(-1) ? format(s.points.at(-1)!.value) : ""}</text>
      ))}
    </svg>
  );
}
