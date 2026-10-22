import type { Premium } from "@/lib/stories";

const W = 880;
const H = 800;
const CX = W / 2;
const GUTTER = 130;
const TOP = 70;
const BOTTOM = H - 40;

const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

/**
 * What goes with pricier towns: each trait a bubble, up the page by its premium against
 * towns without it in the same county, sized by how many towns have it. Labels alternate
 * sides and are pushed apart where they would collide, joined to their bubble by a line.
 */
export function StoryPremiums({ premiums }: { premiums: Premium[] }) {
  const highest = Math.max(0.1, ...premiums.map((p) => p.premium));
  const lowest = Math.min(-0.1, ...premiums.map((p) => p.premium));
  const top = Math.ceil(highest * 10) / 10;
  const bottom = Math.floor(lowest * 10) / 10;
  const y = (p: number) => TOP + ((top - p) / (top - bottom)) * (BOTTOM - TOP);
  const radius = (towns: number) => 4 + Math.sqrt(towns) * 1.3;
  const ticks: number[] = [];
  for (let t = bottom; t <= top + 1e-9; t += 0.1) ticks.push(Math.round(t * 10) / 10);

  // Bubbles sit on the centre line; one that would overlap steps sideways toward its label.
  const placed: { p: Premium; x: number; y: number; r: number }[] = [];
  premiums.forEach((p, i) => {
    const r = radius(p.towns);
    const by = y(p.premium);
    let x = CX;
    for (let step = 1; placed.some((q) => Math.hypot(q.x - x, q.y - by) < q.r + r + 2) && step < 12; step++) {
      // Toward its own label's side, so the leader never crosses another bubble.
      x = CX + (i % 2 ? -1 : 1) * step * (r + 3);
    }
    placed.push({ p, x, y: by, r });
  });
  // Labels: right for even, left for odd, at least 36px apart on each side.
  const last = { left: -Infinity, right: -Infinity };
  const labels = placed.map((b, i) => {
    const side: "left" | "right" = i % 2 ? "left" : "right";
    const ly = Math.max(b.y, last[side] + 36);
    last[side] = ly;
    return { ...b, side, ly };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bubble chart: each town trait placed by how much pricier towns with it are than similar towns without it. The figures are in the table below.">
      <g className="grid" aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={40} x2={W - 20} y1={y(t)} y2={y(t)} className={t === 0 ? "zero" : undefined} />
            <text x={40} y={y(t) - 6}>{t === 0 ? "0" : pct(t)}</text>
          </g>
        ))}
      </g>
      {/* The chart's own key: what up means, what zero means, what size means. */}
      <g aria-hidden="true">
        <text className="sub" x={40} y={TOP - 22}>↑ Towns with the trait cost more than towns without it, same county</text>
        <text className="sub" x={40} y={BOTTOM + 30}>↓ Towns with the trait cost less</text>
        <text className="sub" x={W - 20} y={y(0) - 6} textAnchor="end">No difference</text>
        {[25, 100, 250].map((n, i) => {
          const r = radius(n), cx = 130 + i * 62;
          return <g key={n}><circle cx={cx} cy={TOP + 50 - r} r={r} fill="none" className="leader" /><text className="sub" x={cx} y={TOP + 66} textAnchor="middle">{n} towns</text></g>;
        })}
      </g>
      {labels.map((b) => {
        // Labels stand clear of the whole cluster, so no bubble covers one.
        const lx = b.side === "right" ? CX + GUTTER : CX - GUTTER;
        return (
          <g key={b.p.trait.key}>
            <path className="leader" d={`M${b.x + (b.side === "right" ? b.r : -b.r)} ${b.y} L${lx + (b.side === "right" ? -6 : 6)} ${b.ly - 5}`} aria-hidden="true" />
            <circle cx={b.x} cy={b.y} r={b.r} className={b.p.premium >= 0 ? "up" : "down"} fillOpacity={0.85} />
            <text className="label" x={lx} y={b.ly - 2} textAnchor={b.side === "right" ? "start" : "end"}>
              {b.p.trait.label} {pct(b.p.premium)}
            </text>
            <text className="sub" x={lx} y={b.ly + 14} textAnchor={b.side === "right" ? "start" : "end"}>
              {b.p.towns} towns
            </text>
          </g>
        );
      })}
    </svg>
  );
}
