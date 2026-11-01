"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./atlas.module.css";

export type AtlasTown = { id: number; name: string; href: string; sale: number | null; value: number | null; tax: number | null; income: number | null; commute: number | null; flood: number | null };
type Mode = "sale" | "tax" | "income" | "commute" | "flood";

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const show: Record<Mode, (v: number) => string> = { sale: money, income: money, tax: (v) => `${v.toFixed(2)}%`, commute: (v) => `${Math.round(v)} min`, flood: (v) => `${(v * 100).toFixed(1)}%` };
const MODES: { id: Mode; label: string; legend: string }[] = [
  { id: "sale", label: "Prices", legend: "Recent sale price" }, { id: "tax", label: "Taxes", legend: "Effective tax rate" }, { id: "income", label: "Income", legend: "Household income" },
  { id: "commute", label: "Commute", legend: "Average commute" }, { id: "flood", label: "Flood", legend: "Homes in the 1% flood zone" },
];
const COLUMNS: { id: Mode | "value"; label: string }[] = [{ id: "sale", label: "Sale" }, { id: "value", label: "Zillow" }, { id: "tax", label: "Tax" }, { id: "income", label: "Income" }, { id: "commute", label: "Commute" }, { id: "flood", label: "Flood" }];

/** The county as a working map: one shape for every question, tied to a table of its towns. */
export function CountyAtlas({ name, width, height, shapes, towns }: { name: string; width: number; height: number; shapes: { id: number; d: string }[]; towns: AtlasTown[] }) {
  const [mode, setMode] = useState<Mode>("sale");
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: Mode | "value" | "name"; down: boolean }>({ key: "sale", down: true });
  const active = hovered ?? picked;
  const town = towns.find((t) => t.id === active) ?? null;
  const byId = useMemo(() => new Map(towns.map((t) => [t.id, t])), [towns]);
  const ordered = useMemo(() => towns.filter((t) => t[mode] !== null).sort((a, b) => a[mode]! - b[mode]!), [towns, mode]);
  // Shaded by rank, so one extreme town cannot wash out the rest of the county.
  const shade = (id: number) => { const i = ordered.findIndex((t) => t.id === id); return i < 0 ? null : 0.18 + (i / Math.max(ordered.length - 1, 1)) * 0.82; };
  const rows = useMemo(() => [...towns].sort((a, b) => {
    if (sort.key === "name") return a.name.localeCompare(b.name) * (sort.down ? -1 : 1);
    const x = a[sort.key], y = b[sort.key];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (x - y) * (sort.down ? -1 : 1);
  }), [towns, sort]);
  const legend = MODES.find((m) => m.id === mode)!;
  const choose = (key: typeof sort.key) => setSort(sort.key === key ? { key, down: !sort.down } : { key, down: key !== "name" });
  const cell = (t: AtlasTown, id: Mode | "value") => { const v = t[id]; return v === null ? "–" : id === "value" ? money(v) : show[id](v); };

  return <div className={styles.atlas} role="group" aria-label={`${name} map and towns`}>
    <div className={styles.mapSide}>
      <div role="group" aria-label="Map measure" className={styles.modes}>{MODES.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => { setMode(m.id); setSort({ key: m.id, down: true }); }}>{m.label}</button>)}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Towns in ${name} shaded by ${legend.legend.toLowerCase()}.`} onMouseLeave={() => setHovered(null)}>
        {shapes.map((shape) => { const o = shade(shape.id), t = byId.get(shape.id); return <path key={shape.id} d={shape.d} data-active={active === shape.id || undefined} fillOpacity={o ?? 0.08} onMouseEnter={() => setHovered(shape.id)} onClick={() => setPicked(picked === shape.id ? null : shape.id)}><title>{t ? `${t.name}: ${t[mode] === null ? "no figure" : show[mode](t[mode]!)}` : ""}</title></path>; })}
      </svg>
      {ordered.length > 1 && <p className={styles.legend}><span>{show[mode](ordered[0][mode]!)}</span><i aria-hidden="true" /><span>{show[mode](ordered.at(-1)![mode]!)}</span><b>{legend.legend}</b></p>}
      <div className={styles.card} aria-live="polite">{town ? <>
        <strong>{town.name}</strong>
        <dl>{COLUMNS.filter((c) => town[c.id] !== null).map((c) => <div key={c.id}><dt>{c.label}</dt><dd>{cell(town, c.id)}</dd></div>)}</dl>
        <Link href={town.href}>Open {town.name}</Link>
      </> : <p>Point at a town to see it here, or select one to keep it.</p>}</div>
    </div>
    <div className={styles.table} tabIndex={0} role="region" aria-label={`Towns in ${name}`}>
      <table>
        <thead><tr>
          <th scope="col" aria-sort={sort.key === "name" ? (sort.down ? "descending" : "ascending") : "none"}><button type="button" onClick={() => choose("name")}>Town{sort.key === "name" ? (sort.down ? " ↓" : " ↑") : ""}</button></th>
          {COLUMNS.map((c) => <th key={c.id} scope="col" aria-sort={sort.key === c.id ? (sort.down ? "descending" : "ascending") : "none"}><button type="button" onClick={() => choose(c.id)}>{c.label}{sort.key === c.id ? (sort.down ? " ↓" : " ↑") : ""}</button></th>)}
        </tr></thead>
        <tbody>{rows.map((t) => <tr key={t.id} data-active={active === t.id || undefined} onMouseEnter={() => setHovered(t.id)} onMouseLeave={() => setHovered(null)}>
          <th scope="row"><Link href={t.href} onFocus={() => setPicked(t.id)}>{t.name}</Link></th>
          {COLUMNS.map((c) => <td key={c.id}>{cell(t, c.id)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
