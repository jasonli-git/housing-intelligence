import type { CSSProperties } from "react";

import { indexedComparison, type IndexedInput } from "@/lib/chartInsights";
import { periodLabel } from "@/lib/periods";

const WIDTH = 840;
const HEIGHT = 290;
const PAD = { top: 18, right: 22, bottom: 32, left: 54 };

const colour: Record<string, string> = {
  zhvi_sfr: "var(--series-1)",
  zori_all: "var(--series-2)",
  acs_median_hh_income: "var(--series-3)",
};

/** One common 100-point baseline; ends stay at each publisher's actual latest date. */
export function IndexedComparison({ series }: { series: IndexedInput[] }) {
  const comparison = indexedComparison(series);
  if (!comparison) return null;
  const { baselineYear, lines } = comparison;
  const all = lines.flatMap((line) => line.points);
  const sharedEndYear = Math.min(...lines.map((line) => Number(line.points.at(-1)!.date.slice(0, 4))));
  const latestYear = Math.max(...lines.map((line) => Number(line.points.at(-1)!.date.slice(0, 4))));
  const times = all.map((point) => Date.parse(point.date));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const numbers = all.map((point) => point.index);
  const low = Math.floor((Math.min(100, ...numbers) - 5) / 10) * 10;
  const high = Math.ceil((Math.max(100, ...numbers) + 5) / 10) * 10;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + ((Date.parse(date) - minTime) / (maxTime - minTime)) * plotWidth;
  const y = (index: number) => PAD.top + ((high - index) / (high - low)) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, i) => low + ((high - low) * i) / 4);
  const captionId = "indexed-comparison-title";

  return (
    <figure className="indexed-comparison" aria-labelledby={captionId}>
      <figcaption>
        <span className="chart-kicker">Same starting line</span>
        <strong id={captionId}>How have housing costs and income moved?</strong>
        <span>Each series starts at 100 from its last {baselineYear} reading. Compare through {sharedEndYear}{latestYear > sharedEndYear ? `; later readings continue to ${latestYear} only where published.` : "."}</span>
      </figcaption>
      <div className="indexed-chart-scroll" tabIndex={0} role="region" aria-label="Indexed housing costs and income chart, scroll horizontally">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Indexed home value, rent, and income trends from ${baselineYear}. Exact dated values are in the trend tables below.`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
              <text x={PAD.left - 9} y={y(tick) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="11">{Math.round(tick)}</text>
            </g>
          ))}
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(100)} y2={y(100)} stroke="var(--text-muted)" strokeDasharray="4 5" />
          {lines.map((line) => {
            const last = line.points.at(-1)!;
            const path = line.points.map((point, index) =>
              `${index === 0 ? "M" : "L"}${x(point.date).toFixed(1)},${y(point.index).toFixed(1)}`,
            ).join(" ");
            return (
              <g key={line.metricId}>
                <path d={path} fill="none" stroke={colour[line.metricId] ?? "var(--text-primary)"} strokeWidth="2.5" strokeDasharray={line.metricId === "acs_median_hh_income" ? "5 4" : undefined} />
                <circle cx={x(last.date)} cy={y(last.index)} r="4.5" fill={colour[line.metricId] ?? "var(--text-primary)"} stroke="var(--surface-card)" strokeWidth="2">
                  <title>{`${line.label}: ${last.index.toFixed(0)} on the ${baselineYear} = 100 scale, as of ${periodLabel(last.date, line.metricId)}`}</title>
                </circle>
              </g>
            );
          })}
          <text x={PAD.left} y={HEIGHT - 5} fill="var(--text-muted)" fontSize="11">{baselineYear}</text>
          <text x={WIDTH - PAD.right} y={HEIGHT - 5} textAnchor="end" fill="var(--text-muted)" fontSize="11">{new Date(maxTime).getUTCFullYear()}</text>
        </svg>
      </div>
      <ul className="indexed-legend" aria-label="Latest indexed readings">
        {lines.map((line) => {
          const last = line.points.at(-1)!;
          return (
            <li key={line.metricId} style={{ "--chart-colour": colour[line.metricId] ?? "var(--text-primary)" } as CSSProperties}>
              <span className="indexed-legend-name">{line.label}</span>
              <strong>{last.index.toFixed(0)}</strong>
              <small>as of {periodLabel(last.date, line.metricId)}</small>
            </li>
          );
        })}
      </ul>
      <p className="chart-method-note">An index compares change, not dollar amounts. Home values describe single-family houses; rent covers all rental types. Income is an ACS five-year estimate updated annually, not a current-month reading.</p>
    </figure>
  );
}
