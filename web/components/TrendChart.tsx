"use client";

/**
 * Hand-rolled SVG line chart with a crosshair and tooltip.
 *
 * A client island: the page around it is server-rendered, and only the hover state
 * needs the browser. One series, so no legend — the title names it (dataviz rule: a
 * legend is for two or more).
 */

import { useState } from "react";

import { formatValue } from "@/lib/format";
import { linearScale, nearestIndex, paddedExtent } from "@/lib/scale";

type Point = { date: string; value: number };

type Props = {
  points: Point[];
  label: string;
  unit: string;
};

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 12, right: 16, bottom: 26, left: 62 };

export function TrendChart({ points, label, unit }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return <p className="muted">Not enough observations to plot.</p>;
  }

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
  const active = hover === null ? null : points[hover];

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="muted" style={{ marginBottom: "0.35rem" }}>
        {label}
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={`${label} over time. Values are in the table below.`}
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
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {formatValue(v, unit)}
            </text>
          </g>
        ))}

        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} />

        {[0, points.length - 1].map((i) => (
          <text
            key={i}
            x={x(times[i])}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize={11}
            fill="var(--text-muted)"
          >
            {points[i].date.slice(0, 7)}
          </text>
        ))}

        {active && (
          <g>
            <line
              x1={x(times[hover!])}
              x2={x(times[hover!])}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--text-muted)"
              strokeWidth={1}
            />
            {/* 2px surface ring so the marker stays legible over the line. */}
            <circle
              cx={x(times[hover!])}
              cy={y(active.value)}
              r={5}
              fill="var(--series-1)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      <p className="muted" style={{ minHeight: "1.3em", marginTop: 0 }}>
        {active
          ? `${active.date.slice(0, 7)} · ${formatValue(active.value, unit)}`
          : "Hover the chart for a value."}
      </p>
    </figure>
  );
}
