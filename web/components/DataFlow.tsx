"use client";

import { useMemo } from "react";
import type { Flow } from "@/lib/dataCatalog";
import styles from "./DataExplorer.module.css";

const ROW = 46;
const WIDTH = 1000;

/** Columns of nodes joined by curves. On a phone the columns stack and the curves go. */
export function DataFlow({ flow, active, label, onSelect }: { flow: Flow; active: string; label: string; onSelect: (id: string) => void }) {
  const count = flow.columns.length;
  const gap = 90;
  const width = (WIDTH - gap * (count - 1)) / count;
  const rows = Math.max(...flow.columns.map((c) => c.nodes.length), 1);
  const height = rows * ROW;
  const places = useMemo(() => {
    const at = new Map<string, { x: number; y: number }>();
    flow.columns.forEach((column, c) => column.nodes.forEach((node, n) => {
      at.set(node.id, { x: c * (width + gap), y: (height - column.nodes.length * ROW) / 2 + n * ROW + ROW / 2 });
    }));
    return at;
  }, [flow, width, height]);
  const touched = (a: string, b: string) => a === active || b === active;
  return <div className={styles.flow} role="group" aria-label={label}>
    <div className={styles.flowHeads} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {flow.columns.map((column) => <span key={column.title}>{column.title}</span>)}
    </div>
    <div className={styles.flowBody} style={{ height }}>
      <svg className={styles.flowLines} viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {flow.edges.map(([a, b]) => {
          const from = places.get(a);
          const to = places.get(b);
          if (!from || !to || from.x === to.x) return null;
          const [left, right] = from.x < to.x ? [from, to] : [to, from];
          const x1 = left.x + width;
          const mid = (x1 + right.x) / 2;
          return <path key={`${a}>${b}`} data-on={touched(a, b) || undefined} vectorEffect="non-scaling-stroke"
            d={`M${x1} ${left.y}C${mid} ${left.y} ${mid} ${right.y} ${right.x} ${right.y}`} />;
        })}
      </svg>
      {flow.columns.map((column) => <div key={column.title} className={styles.flowColumn}>
        <h3>{column.title}</h3>
        {column.nodes.map((node) => {
          const place = places.get(node.id)!;
          return <button key={node.id} type="button" title={node.label} aria-pressed={node.id === active} onClick={() => onSelect(node.id)}
            style={{ "--x": `${place.x / WIDTH * 100}%`, "--y": `${place.y - 18}px`, "--w": `${width / WIDTH * 100}%` } as React.CSSProperties}>{node.label}</button>;
        })}
        {column.hidden ? <p>and {column.hidden} more</p> : null}
      </div>)}
    </div>
    {flow.columns.some((c) => c.hidden) && <p className={styles.note}>{flow.columns.map((c) => c.hidden ? `${c.hidden} more in ${c.title.toLowerCase()}` : "").filter(Boolean).join("; ")}. Choose a narrower starting point to see them.</p>}
  </div>;
}
