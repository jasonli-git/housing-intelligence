"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { COLUMNS, money, show, type AtlasTown, type Mode } from "./CountyAtlas";
import styles from "./state.module.css";

type Measure = Mode | "value";
const LEGEND: Record<Measure, string> = { sale: "Recent sale price", value: "Zillow home value", tax: "Effective tax rate", income: "Household income", commute: "Average commute", flood: "Homes in the 1% flood zone" };
const format = (id: Measure, v: number | null) => v === null ? "–" : id === "value" ? money(v) : show[id](v);

/** The state's opening: the whole map tied to a table of its counties, so each column ranks and recolours both. */
export function StateDashboard({ width, height, shapes, rows, children }: { width: number; height: number; shapes: { id: number; d: string }[]; rows: AtlasTown[]; children: ReactNode }) {
  const [measure, setMeasure] = useState<Measure>("sale");
  const [sort, setSort] = useState<{ key: Measure | "name"; down: boolean }>({ key: "sale", down: true });
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const active = hovered ?? picked;
  const county = rows.find((r) => r.id === active) ?? null;
  const columns = COLUMNS.filter((c) => rows.some((r) => r[c.id] !== null));
  const ranked = useMemo(() => rows.filter((r) => r[measure] !== null).sort((a, b) => b[measure]! - a[measure]!), [rows, measure]);
  // A county missing a figure sinks, whichever way the column runs.
  const ordered = useMemo(() => [...rows].sort((a, b) => {
    if (sort.key === "name") return a.name.localeCompare(b.name) * (sort.down ? -1 : 1);
    const x = a[sort.key], y = b[sort.key];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (x - y) * (sort.down ? -1 : 1);
  }), [rows, sort]);
  const peak = ranked[0]?.[measure] ?? 1;
  const shade = (id: number) => { const i = ranked.findIndex((r) => r.id === id); return i < 0 ? null : 1 - (i / Math.max(ranked.length - 1, 1)) * 0.82; };
  const byId = new Map(rows.map((r) => [r.id, r]));
  const choose = (key: Measure | "name") => { if (key !== "name") setMeasure(key); setSort(sort.key === key ? { key, down: !sort.down } : { key, down: key !== "name" }); };
  const arrow = (key: Measure | "name") => sort.key === key ? (sort.down ? " ↓" : " ↑") : "";
  const ariaSort = (key: Measure | "name") => sort.key === key ? (sort.down ? "descending" as const : "ascending" as const) : "none" as const;

  return <div className={styles.dashboard}>
    <div className={styles.left}>
      {children}
      <div className={styles.countyTable} tabIndex={0} role="region" aria-label="Counties in New Jersey" onMouseLeave={() => setHovered(null)}>
        <table>
          <thead><tr>
            <th scope="col" aria-sort={ariaSort("name")}><button type="button" onClick={() => choose("name")}>County{arrow("name")}</button></th>
            {columns.map((c) => <th key={c.id} scope="col" data-col={c.id} data-sorted={measure === c.id || undefined} aria-sort={ariaSort(c.id)}><button type="button" onClick={() => choose(c.id)}>{c.label}{arrow(c.id)}</button></th>)}
          </tr></thead>
          <tbody>{ordered.map((r) => <tr key={r.id} data-active={active === r.id || undefined} onMouseEnter={() => setHovered(r.id)}>
            <th scope="row"><Link href={r.href} prefetch={false} onFocus={() => setHovered(r.id)} onBlur={() => setHovered(null)}>{r.name}</Link></th>
            {columns.map((c) => { const v = r[c.id]; return <td key={c.id} data-col={c.id} data-sorted={measure === c.id || undefined}>{measure === c.id && v !== null && <i aria-hidden="true" style={{ width: `${(v / peak) * 100}%` }} />}<span>{format(c.id, v)}</span></td>; })}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    <div className={styles.right}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`New Jersey counties shaded by ${LEGEND[measure].toLowerCase()}.`} onMouseLeave={() => setHovered(null)}>
        {shapes.map((shape) => { const o = shade(shape.id), r = byId.get(shape.id); return <path key={shape.id} d={shape.d} data-active={active === shape.id || undefined} fillOpacity={o ?? 0.08} onMouseEnter={() => setHovered(shape.id)} onClick={() => setPicked(picked === shape.id ? null : shape.id)}><title>{r ? `${r.name}: ${r[measure] === null ? "no figure" : format(measure, r[measure])}` : ""}</title></path>; })}
      </svg>
      <p className={styles.legend}><b>{LEGEND[measure]}</b>{ranked.length > 1 && <span>{format(measure, ranked.at(-1)![measure])} to {format(measure, ranked[0][measure])}</span>}</p>
      <p className={styles.card} aria-live="polite">{county ? <><strong>{county.name}</strong> {format(measure, county[measure])} <Link href={county.href} prefetch={false}>Open</Link></> : "Point at a county, or select one to keep it."}</p>
    </div>
  </div>;
}
