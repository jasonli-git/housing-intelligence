"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { regionPath } from "@/lib/placeRoutes";
import type { Part } from "@/components/StackedBars";

export type MixRow = { id: number; name: string; county: string; values: Partial<Record<string, number>> };

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

function Bar({ parts, values, label }: { parts: Part[]; values: MixRow["values"]; label: string }) {
  const total = parts.reduce((s, p) => s + (values[p.key] ?? 0), 0) || 1;
  return (
    <span className="stacked-bar" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${pct(values[p.key] ?? 0)}`).join(", ")}`}>
      {parts.map((p, i) => {
        const v = values[p.key];
        return v ? <i key={p.key} style={{ width: `${Math.round((v / total) * 10000) / 100}%`, background: `var(--story-${i + 1})` }} title={`${p.label}: ${pct(v)}`} /> : null;
      })}
    </span>
  );
}

/**
 * Every town's homes two ways at once: by age and by building type, each a bar of shares.
 * A county filter keeps the list short, and either bar can order it.
 */
export function HousingMix({ rows, counties, age, type, state }: { rows: MixRow[]; counties: string[]; age: Part[]; type: Part[]; state?: MixRow }) {
  const [county, setCounty] = useState("");
  const [order, setOrder] = useState<"old" | "new" | "detached" | "apartments">("old");
  const shown = useMemo(() => {
    const key = { old: age[0].key, new: age[age.length - 1].key, detached: type[0].key, apartments: type[type.length - 1].key }[order];
    return rows.filter((r) => !county || r.county === county).sort((a, b) => (b.values[key] ?? 0) - (a.values[key] ?? 0));
  }, [rows, county, order, age, type]);
  return (
    <>
      <div className="ladder-controls">
        <label>County
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="">All of New Jersey</option>
            {counties.map((c) => <option key={c} value={c}>{c} County</option>)}
          </select>
        </label>
        <label>Order by
          <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
            <option value="old">Oldest homes first</option>
            <option value="new">Newest homes first</option>
            <option value="detached">Most detached houses</option>
            <option value="apartments">Most big apartment buildings</option>
          </select>
        </label>
      </div>
      <div className="mix-keys">
        <p className="stacked-key"><b>Built</b>{age.map((p, i) => <span key={p.key}><i style={{ background: `var(--story-${i + 1})` }} />{p.label}</span>)}</p>
        <p className="stacked-key"><b>Kind of building</b>{type.map((p, i) => <span key={p.key}><i style={{ background: `var(--story-${i + 1})` }} />{p.label}</span>)}</p>
      </div>
      <p className="story-note" role="status">{shown.length} towns</p>
      <ul className="mix">
        <li className="ladder-axis" aria-hidden="true"><span>Town</span><span>When built: oldest → newest</span><span>Kind of building: houses → big buildings</span></li>
        {state && (
          <li className="mix-state">
            <span><b>All of New Jersey</b></span>
            <Bar parts={age} values={state.values} label="New Jersey, when built" />
            <Bar parts={type} values={state.values} label="New Jersey, kind of building" />
          </li>
        )}
        {shown.map((r) => (
          <li key={r.id}>
            <span><Link href={regionPath(r.id)}>{r.name}</Link>{!county && <small> · {r.county}</small>}</span>
            <Bar parts={age} values={r.values} label={`${r.name}, when built`} />
            <Bar parts={type} values={r.values} label={`${r.name}, kind of building`} />
          </li>
        ))}
      </ul>
    </>
  );
}
