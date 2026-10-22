import type { ReactNode } from "react";

export type Part = { key: string; label: string };

/**
 * Rows of stacked bars on one shared scale, each part a fixed story colour in the order
 * given, so a part keeps its colour whatever rows are shown. Plain markup, usable from a
 * server page or a client filter alike.
 */
export function StackedBars({
  parts,
  rows,
  max,
  shares = false,
  ticks,
  heads = ["", ""],
  format,
  label,
}: {
  parts: Part[];
  rows: { id: string | number; name: ReactNode; aside?: ReactNode; values: Partial<Record<string, number>>; total?: string }[];
  /** The scale's top; the largest row total when left out. */
  max?: number;
  /** Each row scaled to its own total, so the bars compare shares rather than sizes. */
  shares?: boolean;
  /** A scale across the top: values on the bar's scale (shares 0 to 1 when `shares`), and their labels. */
  ticks?: { at: number; label: string }[];
  /** Headings for the name and total columns of the scale row. */
  heads?: [string, string];
  format: (v: number) => string;
  label: string;
}) {
  const top = max ?? Math.max(1e-9, ...rows.map((r) => parts.reduce((s, p) => s + (r.values[p.key] ?? 0), 0)));
  const sum = (r: { values: Partial<Record<string, number>> }) => parts.reduce((s, p) => s + (r.values[p.key] ?? 0), 0);
  const pct = (v: number, of = top) => `${Math.round((v / (of || 1)) * 10000) / 100}%`;
  return (
    <figure className="stacked" aria-label={label}>
      <p className="stacked-key">
        {parts.map((p, i) => <span key={p.key}><i style={{ background: `var(--story-${i + 1})` }} />{p.label}</span>)}
      </p>
      <ul>
        {ticks && (
          <li className="ladder-axis" aria-hidden="true">
            <span>{heads[0]}</span>
            <span className="ladder-track">{ticks.map((t) => <b key={t.label} style={{ left: shares ? pct(t.at, 1) : pct(t.at) }}>{t.label}</b>)}</span>
            <span className="num">{heads[1]}</span>
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id}>
            <span className="stacked-name">{r.name}{r.aside && <small> · {r.aside}</small>}</span>
            <span className="stacked-bar">
              {ticks?.map((t) => <span key={t.label} className="grid-tick" style={{ left: shares ? pct(t.at, 1) : pct(t.at) }} aria-hidden="true" />)}
              {parts.map((p, i) => {
                const v = r.values[p.key];
                return v ? <i key={p.key} style={{ width: shares ? pct(v, sum(r)) : pct(v), background: `var(--story-${i + 1})` }} title={`${p.label}: ${format(v)}`} /> : null;
              })}
            </span>
            {r.total !== undefined && <span className="num">{r.total}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}
