"use client";

import Link from "next/link";
import { type KeyboardEvent, useState } from "react";

import { Choropleth } from "@/components/Choropleth";
import { definitionOf } from "@/lib/definitions";
import { formatChange, formatMetric } from "@/lib/format";
import type { Projected } from "@/lib/geo";
import type { Section } from "@/lib/groups";
import { windowLabel } from "@/lib/periods";
import { rankWords } from "@/lib/ranks";
import { WINDOWS, type WindowKey, windowNote } from "@/lib/windows";

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
 *
 * Since Milestone 23 the measure is introduced in a card with the controls that change
 * it — its name, what it is and why it matters (`lib/definitions.ts`), and the window —
 * and the ranking sits in a card of its own, the county names in text colour rather than
 * a generic link blue, each row ending in "›".
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
  const definition = definitionOf(measure.metric_id);
  const notes = windowNote(key, measure.metric_id, measure.windows);
  const windowName = WINDOWS.find((w) => w.key === key)!.label;
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
      <div className="measure-card">
        <div className="measure-intro">
          <div>
            <p className="measure-eyebrow">On the map</p>
            <h2 className="measure-name" id="explorer-heading">
              {measure.label}
            </h2>
            {definition && (
              <p className="measure-def">
                {definition.what} <span className="measure-why">{definition.why}</span>
              </p>
            )}
            <p className="measure-window">
              Change {phrase}, by county
              {current.start && current.end ? ` · ${windowLabel(current.start, current.end, measure.metric_id)}` : ""}
            </p>
          </div>
          {/* What a reader needs to read the chosen window, beside the measure it qualifies
              and only while that window is chosen; set apart as a note, not more definition. */}
          {notes.length > 0 && (
            <aside className="window-aside" aria-label={`About “${windowName}”`}>
              <p className="window-aside-label">About “{windowName}”</p>
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </aside>
          )}
        </div>
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
        <div className="map-panel">
          {/* Empty until a county is pointed at; the line keeps its height so the map
              does not jump when it fills. */}
          <p className="readout" aria-live="polite">
            {focus && (
              <>
                <b>{focus.name}</b> · {formatChange(focus.change)} · now {latest(focus.latest)} ·{" "}
                {rankWords(focus.rank, focus.of, "change", measure.direction, phrase)}
              </>
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
        <div className="rank-card">
          <p className="table-note">
            Ranked by change {phrase}, not by level: rank 1 is the{" "}
            {measure.direction === "lower_is_better" ? "smallest" : "largest"} rise, following
            the measure’s own direction.
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
                  <th scope="col" className="go">
                    <span className="visually-hidden">Open</span>
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
                    <td className="go">
                      {/* A second way in at the row's end, out of the tab order: the name
                          is the keyboard's link. */}
                      <Link href={`/regions/${row.id}`} tabIndex={-1} aria-hidden="true">
                        ›
                      </Link>
                    </td>
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
