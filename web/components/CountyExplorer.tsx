"use client";

import Link from "next/link";
import { type KeyboardEvent, useState } from "react";

import { Choropleth } from "@/components/Choropleth";
import { formatChange, formatMetric } from "@/lib/format";
import type { Projected } from "@/lib/geo";
import type { Section } from "@/lib/groups";
import { windowLabel } from "@/lib/periods";
import { WINDOWS, type WindowKey } from "@/lib/windows";

export type RankRow = {
  id: number;
  name: string;
  rank: number;
  of: number;
  change: number;
  latest: number | null;
};

export type Measure = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  windows: Partial<Record<WindowKey, { start: string | null; end: string | null; rows: RankRow[] }>>;
};

/**
 * The New Jersey page's map and ranking, over the measure and window the reader picks.
 *
 * Until Milestone 18 both were constants in the page's source — home values over five
 * years — so the site's front page could not be asked a second question. Every
 * published county ranking is embedded at build time, so switching is instant and needs
 * no request; a window a measure does not publish is disabled and says why, rather than
 * quietly showing a different one.
 *
 * Map and table are one view: pointing at a county in either outlines it on the map and
 * reads its figures above it. Keyboard readers move through the table, which links
 * every county; the map's own links are kept out of the tab order.
 */
export function CountyExplorer({
  map,
  sections,
  initial,
}: {
  map: Projected;
  sections: Section<Measure>[];
  initial: string;
}) {
  const measures = sections.flatMap((section) => section.rows);
  const [metricId, setMetricId] = useState(initial);
  const [windowKey, setWindowKey] = useState<WindowKey>("5y");
  const [hovered, setHovered] = useState<number | null>(null);

  const measure = measures.find((m) => m.metric_id === metricId) ?? measures[0];
  // Keep the reader's window choice, and show the nearest one this measure publishes.
  const key: WindowKey = measure.windows[windowKey]
    ? windowKey
    : WINDOWS.find((w) => measure.windows[w.key])!.key;
  const current = measure.windows[key]!;
  const rows = [...current.rows].sort((a, b) => a.rank - b.rank);
  const values = new Map(rows.map((row) => [row.id, row.change]));
  const phrase = WINDOWS.find((w) => w.key === key)!.phrase;
  const focus = hovered === null ? null : (rows.find((row) => row.id === hovered) ?? null);
  const latest = (value: number | null) =>
    value === null ? "—" : formatMetric(value, measure.unit, measure.metric_id);

  function onWindowKeys(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const enabled = WINDOWS.filter((w) => measure.windows[w.key]);
    const at = enabled.findIndex((w) => w.key === key);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    setWindowKey(next.key);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [WINDOWS.findIndex((w) => w.key === next.key)]?.focus();
  }

  return (
    <section className="explorer-section" aria-labelledby="explorer-heading">
      <div className="section-head">
        <p className="meta" id="explorer-heading">
          {measure.label}, change {phrase}, by county
          {current.start && current.end
            ? ` · ${windowLabel(current.start, current.end, measure.metric_id)}`
            : ""}
        </p>
        <div className="explorer-controls">
          <label className="control">
            <span className="control-label">Measure</span>
            <select value={measure.metric_id} onChange={(event) => setMetricId(event.target.value)}>
              {sections.map((section) => (
                <optgroup key={section.key} label={section.title}>
                  {section.rows.map((m) => (
                    <option key={m.metric_id} value={m.metric_id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="control">
            <span className="control-label" id="window-label">
              Change
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="window-label" onKeyDown={onWindowKeys}>
              {WINDOWS.map((w) => {
                const published = Boolean(measure.windows[w.key]);
                const checked = w.key === key;
                return (
                  <button
                    key={w.key}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked ? 0 : -1}
                    disabled={!published}
                    title={published ? undefined : "Not published for this measure"}
                    onClick={() => setWindowKey(w.key)}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="explorer">
        <div>
          <p className="readout" aria-live="polite">
            {focus ? (
              <>
                <b>{focus.name}</b> · {formatChange(focus.change)} · now {latest(focus.latest)} ·
                rank {focus.rank} of {focus.of}
              </>
            ) : (
              "Point at a county on the map or in the table to read its figures."
            )}
          </p>
          <Choropleth
            map={map}
            values={values}
            title={`${measure.label}, change ${phrase}`}
            format={formatChange}
            active={hovered}
            onHover={setHovered}
          />
        </div>
        <div>
          <p className="table-note">
            Rank 1 is the {measure.direction === "lower_is_better" ? "smallest" : "largest"} rise,
            following the measure’s own direction.
            {rows.length < map.shapes.length
              ? ` ${rows.length} of the ${map.shapes.length} counties have this measure.`
              : ""}
          </p>
          <div className="scroll-x">
            <table className="ranks">
              <thead>
                <tr>
                  <th scope="col" className="num pos">
                    #
                  </th>
                  <th scope="col">County</th>
                  <th scope="col" className="num">
                    Change
                  </th>
                  <th scope="col" className="num">
                    Latest
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === hovered ? "on" : undefined}
                    onMouseEnter={() => setHovered(row.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <td className="num pos">{row.rank}</td>
                    <td>
                      <Link
                        href={`/regions/${row.id}`}
                        onFocus={() => setHovered(row.id)}
                        onBlur={() => setHovered(null)}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="num">{formatChange(row.change)}</td>
                    <td className="num">{latest(row.latest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
