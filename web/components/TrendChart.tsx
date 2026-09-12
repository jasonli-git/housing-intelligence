"use client";

/**
 * Hand-rolled SVG line chart with a crosshair, sized to sit three abreast.
 *
 * A client island: the page around it is server-rendered, and only the hover state
 * needs the browser. One series, so no legend — the title names it (dataviz rule: a
 * legend is for two or more). At rest the readout gives the latest value, so the chart
 * says something before anyone points at it; the table beside it is the accessible
 * fallback and satisfies the relief rule for palette steps below 3:1.
 */

import { type ReactNode, useState } from "react";

import { formatMetric } from "@/lib/format";
import { linearScale, nearestIndex, paddedExtent } from "@/lib/scale";

type Point = { date: string; value: number };

type Props = {
  points: Point[];
  title: string;
  unit: string;
  metricId: string;
  /** The values table, rendered on the server and passed through. */
  children?: ReactNode;
};

const WIDTH = 360;
const HEIGHT = 170;
const PAD = { top: 10, right: 10, bottom: 22, left: 62 };

export function TrendChart({ points, title, unit, metricId, children }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const format = (value: number) => formatMetric(value, unit, metricId);
  const times = points.map((p) => new Date(p.date).getTime());
  const values = points.map((p) => p.value);
  const [minT, maxT] = [Math.min(...times), Math.max(...times)];
  const [minV, maxV] = paddedExtent(values);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = linearScale([minT, maxT], [PAD.left, PAD.left + plotW]);
  // Range reversed: SVG y grows downward, the value axis grows upward.
  const y = linearScale([minV, maxV], [PAD.top + plotH, PAD.top]);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join("");
  const ticks = [minV, (minV + maxV) / 2, maxV];
  const shown = hover ?? points.length - 1;
  const active = points[shown];

  return (
    <figure className="trend">
      <figcaption className="trend-title">{title}</figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title} over time. Values are in the table below.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * WIDTH;
          const t = minT + ((px - PAD.left) / plotW) * (maxT - minT);
          setHover(nearestIndex(times, t));
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            {/* Recessive grid: present enough to read a value against, never competing
                with the data. */}
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10.5} fill="var(--text-muted)">
              {format(v)}
            </text>
          </g>
        ))}

        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} />

        {[0, points.length - 1].map((i) => (
          <text
            key={i}
            x={x(times[i])}
            y={HEIGHT - 6}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize={10.5}
            fill="var(--text-muted)"
          >
            {points[i].date.slice(0, 7)}
          </text>
        ))}

        <line
          x1={x(times[shown])}
          x2={x(times[shown])}
          y1={PAD.top}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--text-muted)"
          strokeWidth={1}
          opacity={hover === null ? 0 : 1}
        />
        {/* 2px surface ring so the marker stays legible over the line. */}
        <circle
          cx={x(times[shown])}
          cy={y(active.value)}
          r={4.5}
          fill="var(--series-1)"
          stroke="var(--surface-1)"
          strokeWidth={2}
        />
      </svg>
      <p className="trend-readout">
        {hover === null ? "Latest" : active.date.slice(0, 7)} · {format(active.value)}
      </p>
      {children}
    </figure>
  );
}
