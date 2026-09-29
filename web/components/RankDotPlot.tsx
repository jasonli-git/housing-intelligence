"use client";

import { useState } from "react";

import { clusterRanks, type ClusterRank, type RankCluster } from "@/lib/chartInsights";
import { groupRows } from "@/lib/groups";
import { ordinal, rankPosition, rankWords, type RankBasis } from "@/lib/ranks";

type Range = { best: number | null; worst: number | null };

/** A compact rank overview whose marks disclose their exact meaning on hover or tap. */
export function RankDotPlot({
  title,
  basis,
  rows,
  peerLabel,
  ranges,
}: {
  title: string;
  basis: RankBasis;
  rows: ClusterRank[];
  peerLabel: string;
  ranges: Record<string, Range>;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  if (rows.length === 0) return null;
  const sections = groupRows(rows);
  const width = 660;
  const left = 164;
  const right = 22;
  const top = 44;
  const rowHeight = 58;
  const plotWidth = width - left - right;
  const height = top + sections.length * rowHeight + 18;
  const plots = sections.map((section) => ({
    ...section,
    clusters: clusterRanks(section.rows, plotWidth),
  }));
  const activeKey = hovered ?? pinned;
  const active = plots.flatMap((section) => section.clusters.map((cluster) => ({
    key: `${section.key}:${cluster.rows.map((row) => row.metric_id).join(",")}`,
    cluster,
  }))).find((entry) => entry.key === activeKey)?.cluster ?? null;
  const x = (position: number) => left + position * plotWidth;
  const rangeFor = (row: ClusterRank) => {
    const range = ranges[row.metric_id];
    return range && range.best !== null && range.worst !== null &&
      range.best >= 1 && range.worst <= row.of && range.best < range.worst
      ? { best: range.best, worst: range.worst }
      : null;
  };

  return (
    <figure className="rank-plot rank-plot-interactive">
      <figcaption>
        <strong>{title}</strong>
        <span>{rows.length} ranked measures</span>
      </figcaption>
      <p>{basis === "change" ? "Ranked by size of five-year change." : "Ranked by latest reported value."}</p>
      <div className="rank-plot-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${title}: interactive rank marks from rank 1 to the last rank. Inspect a dot for its measure and any plausible range.`}>
          <text className="rank-plot-end" x={left} y={20}>Rank 1</text>
          <text className="rank-plot-end" x={width - right} y={20} textAnchor="end">Last rank</text>
          {plots.map((section, sectionIndex) => {
            const y = top + sectionIndex * rowHeight;
            return (
              <g key={section.key}>
                <text className="rank-plot-label" x={8} y={y + 4}>{section.title}</text>
                <line className="rank-plot-track" x1={left} x2={width - right} y1={y} y2={y} />
                <line className="rank-plot-middle" x1={left + plotWidth / 2} x2={left + plotWidth / 2} y1={y - 15} y2={y + 15} />
                {section.clusters.map((cluster: RankCluster) => {
                  const key = `${section.key}:${cluster.rows.map((row) => row.metric_id).join(",")}`;
                  const selected = activeKey === key;
                  const description = cluster.rows.length === 1
                    ? `${cluster.rows[0].label}, rank ${cluster.rows[0].rank} of ${cluster.rows[0].of}`
                    : `${cluster.rows.length} nearby measures: ${cluster.rows.map((row) => row.label).join(", ")}`;
                  return (
                    <g key={key}>
                      {selected && cluster.rows.map((row, index) => {
                        const range = rangeFor(row);
                        return range && (
                          <line
                            key={row.metric_id}
                            className="rank-plot-range"
                            x1={x(rankPosition(range.best, row.of))}
                            x2={x(rankPosition(range.worst, row.of))}
                            y1={y + (index - (cluster.rows.length - 1) / 2) * 5}
                            y2={y + (index - (cluster.rows.length - 1) / 2) * 5}
                            pointerEvents="none"
                          />
                        );
                      })}
                      <circle className={`rank-plot-dot rank-plot-dot-${section.key}${selected ? " is-active" : ""}`} cx={x(cluster.position)} cy={y} r={cluster.rows.length > 1 ? 10 : 6} pointerEvents="none" />
                      {cluster.rows.length > 1 && <text className="rank-plot-cluster-count" x={x(cluster.position)} y={y + 3.5} textAnchor="middle" pointerEvents="none">{cluster.rows.length}</text>}
                      <circle
                        className="rank-plot-hit"
                        cx={x(cluster.position)}
                        cy={y}
                        r={14}
                        fill="transparent"
                        role="button"
                        tabIndex={0}
                        aria-label={description}
                        aria-pressed={pinned === key}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== "touch") setHovered(key);
                        }}
                        onPointerLeave={(event) => {
                          if (event.pointerType !== "touch") setHovered(null);
                        }}
                        onFocus={() => setHovered(key)}
                        onBlur={() => setHovered(null)}
                        onClick={() => setPinned((current) => current === key ? null : key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPinned((current) => current === key ? null : key);
                          }
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="rank-plot-swipe">Swipe sideways to inspect the full plot.</p>
      <div className="rank-plot-inspector" aria-live="polite">
        {active ? (
          <>
            <div className="rank-inspector-heading">
              <strong>{active.rows.length === 1 ? active.rows[0].label : `${active.rows.length} measures near this position`}</strong>
              {pinned && <button type="button" onClick={() => setPinned(null)}>Clear selection</button>}
            </div>
            <ul>
              {active.rows.map((row) => {
                const range = rangeFor(row);
                return (
                  <li key={row.metric_id}>
                    {active.rows.length > 1 && <b>{row.label}</b>}
                    <span>{rankWords(row.rank, row.of, basis, row.direction)} among {peerLabel}.</span>
                    {range && <em>Sampling uncertainty: plausible rank {ordinal(range.best)}–{ordinal(range.worst)}.</em>}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p>Hover, focus, or tap a dot to see the measure and exact rank. Numbered dots group nearby measures.</p>
        )}
      </div>
    </figure>
  );
}
