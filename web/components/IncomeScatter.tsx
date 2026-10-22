"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatValue } from "@/lib/format";
import { regionPath } from "@/lib/placeRoutes";
import { ratioBand } from "@/lib/stories";

export type IncomePoint = { id: number; name: string; county: string; income: number; value: number };

const W = 880, H = 600, L = 84, R = 20, T = 20, B = 48;
const usd = (v: number) => formatValue(v, "usd");
const BAND = { under3: "s1", "3to5": "s3", over5: "s2" } as const;
const BAND_LABEL = { under3: "Under 3×", "3to5": "3× to 5×", over5: "Over 5×" } as const;

/**
 * Every town as a dot, household income across and home value up, both on ratio scales so
 * the 3× and 5× lines run parallel. A search lights up the towns matching it.
 */
export function IncomeScatter({ points }: { points: IncomePoint[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => (q ? new Set(points.filter((p) => p.name.toLowerCase().includes(q)).map((p) => p.id)) : null), [points, q]);
  const [x0, x1] = [Math.log(Math.min(...points.map((p) => p.income)) * 0.9), Math.log(Math.max(...points.map((p) => p.income)) * 1.1)];
  const [y0, y1] = [Math.log(Math.min(...points.map((p) => p.value)) * 0.9), Math.log(Math.max(...points.map((p) => p.value)) * 1.1)];
  const x = (v: number) => Math.round((L + ((Math.log(v) - x0) / (x1 - x0)) * (W - L - R)) * 10) / 10;
  const y = (v: number) => Math.round((H - B - ((Math.log(v) - y0) / (y1 - y0)) * (H - T - B)) * 10) / 10;
  const xTicks = [50_000, 100_000, 150_000, 250_000].filter((t) => Math.log(t) > x0 && Math.log(t) < x1);
  const yTicks = [200_000, 400_000, 800_000, 1_600_000, 3_200_000].filter((t) => Math.log(t) > y0 && Math.log(t) < y1);
  const line = (k: number) => {
    const a = Math.max(Math.exp(x0), Math.exp(y0) / k), b = Math.min(Math.exp(x1), Math.exp(y1) / k);
    return { x1: x(a), y1: y(a * k), x2: x(b), y2: y(b * k) };
  };
  const counts = { under3: 0, "3to5": 0, over5: 0 };
  for (const p of points) counts[ratioBand(p.income, p.value)]++;
  const found = hits ? points.filter((p) => hits.has(p.id)).slice(0, 12) : [];
  return (
    <>
      <div className="ladder-controls">
        <label>Find your town<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Town name" /></label>
        <p className="ladder-key">
          {(Object.keys(BAND) as (keyof typeof BAND)[]).map((b) => (
            <span key={b}><i style={{ background: `var(--story-${{ s1: 1, s2: 2, s3: 3 }[BAND[b]]})` }} />{BAND_LABEL[b]} income · {counts[b]} towns</span>
          ))}
        </p>
      </div>
      <figure className="story-figure">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter plot: each New Jersey town's median household income against its median home value, with lines where value is 3 and 5 times income.">
          <g className="grid" aria-hidden="true">
            {xTicks.map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} /><text x={x(t)} y={H - B + 18} textAnchor="middle">{usd(t)}</text></g>)}
            {yTicks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 6} y={y(t) + 4} textAnchor="end">{usd(t)}</text></g>)}
            <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle">Median household income</text>
            <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>Median home value</text>
          </g>
          {[3, 5].map((k) => {
            const l = line(k);
            return <g key={k} aria-hidden="true"><line className="ratio-line" {...l} /><text className="sub" x={l.x1 + 6} y={l.y1 - 8}>{k}× income</text></g>;
          })}
          {points.map((p) => {
            const hit = hits?.has(p.id);
            return (
              <circle key={p.id} cx={x(p.income)} cy={y(p.value)} r={hit ? 6 : 4} className={`dot ${BAND[ratioBand(p.income, p.value)]}${hits ? (hit ? " hit" : " dim") : ""}`}>
                <title>{`${p.name}, ${p.county}: income ${usd(p.income)}, home ${usd(p.value)}, ${(p.value / p.income).toFixed(1)}×`}</title>
              </circle>
            );
          })}
          {found.map((p) => <text key={p.id} className="place" x={x(p.income) + 8} y={y(p.value) + 4}>{p.name}</text>)}
        </svg>
      </figure>
      {hits && (
        <p className="story-note" role="status">
          {hits.size ? found.map((p, i) => (
            <span key={p.id}>{i ? "; " : ""}<Link href={regionPath(p.id)}>{p.name}</Link>: {(p.value / p.income).toFixed(1)}× ({usd(p.value)} against {usd(p.income)})</span>
          )) : "No town matches."}
        </p>
      )}
    </>
  );
}
