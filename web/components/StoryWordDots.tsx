import type { WordPremium } from "@/lib/stories";

const W = 880;
const LABEL = 150;
const VALUE = 64;
const ROW = 30;
const TOP = 34;
// The axis is on a ratio scale, so half-price and double-price sit the same distance from
// zero; a town beyond its ends is drawn at the edge.
const LOW = Math.log(0.4), HIGH = Math.log(2.5);
const TICKS = [-0.5, -0.25, 0, 0.5, 1];

const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p * 100))}%`;

/**
 * What's in a name: one row per word, a faint dot for each town carrying it and a ringed dot
 * for the group, each placed by how much pricier or cheaper than its county. The towns'
 * own dots show how far a small group's figure rests on one or two of them. Drawn as dots
 * rather than bars so it does not look like What goes with pricier towns (2026-11-06).
 */
export function StoryWordDots({ words }: { words: WordPremium[] }) {
  const x0 = LABEL, x1 = W - VALUE;
  const x = (p: number) => x0 + ((Math.min(HIGH, Math.max(LOW, Math.log(1 + p))) - LOW) / (HIGH - LOW)) * (x1 - x0);
  const H = TOP + words.length * ROW + 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dot chart: each word in town names, with a dot for each town carrying it and a ringed dot for the group, by how much pricier or cheaper than the town's county. The towns are listed below.">
      <g className="grid" aria-hidden="true">
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={H - 26} className={t === 0 ? "zero" : undefined} />
            <text x={x(t)} y={H - 8} textAnchor="middle">{t === 0 ? "County average" : pct(t)}</text>
          </g>
        ))}
        <text className="sub" x={x(0) - 8} y={TOP - 16} textAnchor="end">← cheaper</text>
        <text className="sub" x={x(0) + 8} y={TOP - 16}>pricier →</text>
      </g>
      {words.map((w, i) => {
        const y = TOP + i * ROW + ROW / 2;
        return (
          <g key={w.word}>
            <title>{w.word}: {w.towns.map((t) => t.name).join(", ")}</title>
            <line className="leader" x1={x0} x2={x1} y1={y} y2={y} strokeOpacity={0.35} aria-hidden="true" />
            <text className="label" x={x0 - 12} y={y + 5} textAnchor="end">{w.word} <tspan className="sub">{w.towns.length}</tspan></text>
            {w.each.map((p, j) => <circle key={j} cx={x(p)} cy={y} r={3.5} className="town-dot" />)}
            <circle cx={x(w.premium)} cy={y} r={7} className={w.premium >= 0 ? "up" : "down"} stroke="var(--surface-1, #fff)" strokeWidth={2} />
            <text className="label" x={W} y={y + 5} textAnchor="end">{pct(w.premium)}</text>
          </g>
        );
      })}
    </svg>
  );
}
