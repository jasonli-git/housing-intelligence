"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { MODES, PlaceTable, show, type AtlasTown, type Mode } from "./CountyAtlas";
import styles from "./state.module.css";

const ROW = 27;
const Measure = createContext<{ mode: Mode; setMode: (mode: Mode) => void }>({ mode: "sale", setMode: () => {} });

/** One measure for the page, so the hero's choice also sorts the county table. */
export function StateMeasure({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("sale");
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <Measure.Provider value={value}>{children}</Measure.Provider>;
}

export function StateTable({ rows }: { rows: AtlasTown[] }) {
  const { mode } = useContext(Measure);
  return <PlaceTable key={mode} name="New Jersey" unit="County" towns={rows} start={mode} />;
}

/** The state's opening: the whole map beside its counties, ranked, and re-ranked by measure. */
export function StateDashboard({ width, height, shapes, rows, children }: { width: number; height: number; shapes: { id: number; d: string }[]; rows: AtlasTown[]; children: ReactNode }) {
  const { mode, setMode } = useContext(Measure);
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const active = hovered ?? picked;
  const county = rows.find((r) => r.id === active) ?? null;
  const modes = MODES.filter((m) => rows.some((r) => r[m.id] !== null));
  const legend = MODES.find((m) => m.id === mode)!;
  const ranked = useMemo(() => rows.filter((r) => r[mode] !== null).sort((a, b) => b[mode]! - a[mode]!), [rows, mode]);
  const place = useMemo(() => new Map([...ranked, ...rows.filter((r) => r[mode] === null)].map((r, i) => [r.id, i])), [ranked, rows, mode]);
  const peak = ranked[0]?.[mode] ?? 1;
  const shade = (id: number) => { const i = ranked.findIndex((r) => r.id === id); return i < 0 ? null : 1 - (i / Math.max(ranked.length - 1, 1)) * 0.82; };
  const byId = new Map(rows.map((r) => [r.id, r]));

  return <div className={styles.dashboard}>
    <div className={styles.left}>
      {children}
      <div role="group" aria-label="Rank counties by" className={styles.modes}>{modes.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>
      <div className={styles.bars} style={{ height: rows.length * ROW }} onMouseLeave={() => setHovered(null)}>
        {rows.map((r) => { const v = r[mode]; return <Link key={r.id} href={r.href} prefetch={false} className={styles.bar} data-active={active === r.id || undefined} style={{ transform: `translateY(${place.get(r.id)! * ROW}px)` }} onMouseEnter={() => setHovered(r.id)} onFocus={() => setHovered(r.id)} onBlur={() => setHovered(null)}>
          <span>{r.name}</span><i><b style={{ width: `${v === null ? 0 : (v / peak) * 100}%` }} /></i><strong>{v === null ? "–" : show[mode](v)}</strong>
        </Link>; })}
      </div>
    </div>
    <div className={styles.right}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`New Jersey counties shaded by ${legend.legend.toLowerCase()}.`} onMouseLeave={() => setHovered(null)}>
        {shapes.map((shape) => { const o = shade(shape.id), r = byId.get(shape.id); return <path key={shape.id} d={shape.d} data-active={active === shape.id || undefined} fillOpacity={o ?? 0.08} onMouseEnter={() => setHovered(shape.id)} onClick={() => setPicked(picked === shape.id ? null : shape.id)}><title>{r ? `${r.name}: ${r[mode] === null ? "no figure" : show[mode](r[mode]!)}` : ""}</title></path>; })}
      </svg>
      <p className={styles.legend}><b>{legend.legend}</b>{ranked.length > 1 && <span>{show[mode](ranked.at(-1)![mode]!)} to {show[mode](ranked[0][mode]!)}</span>}</p>
      <p className={styles.card} aria-live="polite">{county ? <><strong>{county.name}</strong> {county[mode] === null ? "no figure" : show[mode](county[mode]!)} <Link href={county.href} prefetch={false}>Open</Link></> : "Point at a county, or select one to keep it."}</p>
    </div>
  </div>;
}
