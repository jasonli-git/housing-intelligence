"use client";

/**
 * Hand-rolled SVG line chart with a crosshair, sized to sit three abreast.
 *
 * A client island: the page around it is server-rendered, and only the hover state
 * needs the browser. One series, so no legend — the title names it (dataviz rule: a
 * legend is for two or more). At rest the readout gives the latest value, so the chart
 * says something before anyone points at it; the table beside it is the accessible
 * fallback and satisfies the relief rule for palette steps below 3:1.
 *
 * Since Milestone 17 it can mark one reading — the year the reader picked above the
 * charts — with a dashed rule and a hollow dot, kept apart from the filled latest dot, and
 * the readout at rest reads from that reading to the latest. Points are dated by the end
 * of their period and labelled the way the tables label them, so an ACS estimate for
 * 2019–2023 sits at, and reads as, 2023 — not at 2019, where its period starts.
 */

import { type ReactNode, useState } from "react";

import { formatMetric } from "@/lib/format";
import { periodLabel } from "@/lib/periods";
import { linearScale, nearestIndex, paddedExtent } from "@/lib/scale";

type Point = { date: string; value: number };

type Props = {
  /** Each reading, dated by the end of its period. */
  points: Point[];
  title: string;
  unit: string;
  metricId: string;
  /** A reading to mark, by its `date`, with the label the readout and the rule carry. */
  marker?: { date: string; label: string } | null;
  /** The values table, rendered on the server and passed through. */
  children?: ReactNode;
};

const WIDTH = 360;
const HEIGHT = 170;
const PAD = { top: 10, right: 10, bottom: 22, left: 62 };

export function TrendChart({ points, title, unit, metricId, marker = null, children }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const format = (value: number) => formatMetric(value, unit, metricId);
  const when = (date: string) => periodLabel(date, metricId);
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
  const last = points.length - 1;
  const shown = hover ?? last;
  const active = points[shown];
  const markAt = marker ? points.findIndex((p) => p.date === marker.date) : -1;
  const markX = markAt >= 0 ? x(times[markAt]) : 0;

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

        {[0, last].map((i) => (
          <text
            key={i}
            x={x(times[i])}
            y={HEIGHT - 6}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize={10.5}
            fill="var(--text-muted)"
          >
            {when(points[i].date)}
          </text>
        ))}

        {/* The picked year, under the crosshair and the latest dot so neither is hidden. */}
        {markAt >= 0 && marker && (
          <g aria-hidden="true">
            <line
              x1={markX}
              x2={markX}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--text-secondary)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={markX}
              cy={y(points[markAt].value)}
              r={4}
              fill="var(--surface-1)"
              stroke="var(--series-1)"
              strokeWidth={2}
            />
            <text
              x={markX + (markX > WIDTH / 2 ? -5 : 5)}
              y={PAD.top + 9}
              textAnchor={markX > WIDTH / 2 ? "end" : "start"}
              fontSize={10.5}
              fill="var(--text-secondary)"
            >
              {marker.label}
            </text>
          </g>
        )}

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
        {hover !== null
          ? `${when(active.date)} · ${format(active.value)}`
          : markAt >= 0 && marker
            ? `${marker.label} · ${format(points[markAt].value)} → latest · ${format(points[last].value)}`
            : `Latest · ${format(points[last].value)}`}
      </p>
      {children}
    </figure>
  );
}
