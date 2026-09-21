"use client";

import Link from "next/link";
import { type KeyboardEvent, useState } from "react";

import { type DetailLevel, type Focus, GlobeMap } from "@/components/GlobeMap";
import { TownRanks } from "@/components/TownRanks";
import { useMapFile } from "@/components/useMapFile";
import { readingsFor } from "@/lib/mapdata";
import { definitionOf } from "@/lib/definitions";
import { formatChange, formatMetric } from "@/lib/format";
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
  windows: Partial<
    Record<
      WindowKey,
      { start: string | null; end: string | null; rows: RankRow[] }
    >
  >;
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
 * and the ranking sits in a card of its own, the county names in text color rather than
 * a generic link blue, each row ending in "›".
 */
export function CountyExplorer({
  frame,
  counties,
  sections,
  initial,
}: {
  /** The box the map is drawn in. New Jersey is taller than it is wide. */
  frame: { width: number; height: number };
  /** How many counties the state has, for "19 of the 21 have this measure". */
  counties: number;
  sections: Section<Measure>[];
  initial: string;
}) {
  const measures = sections.flatMap((section) => section.rows);
  const [metricId, setMetricId] = useState(initial);
  const [windowKey, setWindowKey] = useState<WindowKey>("5y");
  // The outlined region, and whether the reader chose it. Pointing at a row is a
  // choice, so the map mutes everything else for it; the crosshair rests on something
  // the whole time the map is open, so it only outlines (ROADMAP).
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  // What the map's crosshair is over and which level it is drawing. A region on the
  // level in view also lights its row; a state under the crosshair has no row to light.
  const [centre, setCentre] = useState<Focus | null>(null);
  const [level, setLevel] = useState<DetailLevel>("county");
  const onView = (next: { level: DetailLevel; focus: Focus | null }) => {
    setCentre(next.focus);
    setLevel(next.level);
    setHovered(
      next.focus && next.focus.level !== "state" ? Number(next.focus.id) : null,
    );
  };
  // The map and the ranking read the same file, so it is fetched once and owned here.
  const { file, layers, failed } = useMapFile();

  const measure = measures.find((m) => m.metric_id === metricId) ?? measures[0];
  // Keep the reader's window choice, and show the nearest one this measure publishes.
  const key: WindowKey = measure.windows[windowKey]
    ? windowKey
    : WINDOWS.find((w) => measure.windows[w.key])!.key;
  const current = measure.windows[key]!;
  const rows = [...current.rows].sort((a, b) => a.rank - b.rank);
  const phrase = WINDOWS.find((w) => w.key === key)!.phrase;
  const marked = picked ?? hovered;
  const focus =
    marked === null ? null : (rows.find((row) => row.id === marked) ?? null);
  // A town pointed at in the municipal ranking. It answers to no county row, so without
  // this the readout would keep showing whatever the crosshair happens to rest on while
  // the reader is plainly pointing somewhere else.
  const markedTown =
    marked === null || focus !== null || !file
      ? null
      : (file.municipality.outlines.find(
          (town) => Number(town.id) === marked,
        ) ?? null);
  const definition = definitionOf(measure.metric_id);
  const notes = windowNote(key, measure.metric_id, measure.windows);
  const windowName = WINDOWS.find((w) => w.key === key)!.label;
  const latest = (value: number | null) =>
    value === null ? "—" : formatMetric(value, measure.unit, measure.metric_id);
  const latestOf = (value: number) =>
    formatMetric(value, measure.unit, measure.metric_id);
  // The same figures the map is drawing, so the ranking beside it and the readout above
  // it can never quote a different quantity (`readingsFor`).
  const basis = readingsFor(file, measure.metric_id, key);
  // A region's reading of one measure, from the map's own figures. "Not published"
  // rather than a dash: a municipality missing from a measure is the ordinary case here
  // — 176 of 564 have no Zillow value — and a dash reads like a rendering fault.
  const reading = (id: number) => {
    const value = basis.values[String(id)];
    if (value === undefined) return "not published";
    return basis.kind === "change" ? formatChange(value) : latestOf(value);
  };

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
        <div className="nj-measure-shortcuts" aria-label="Popular measures">
          {[
            ["zhvi_sfr", "Home values"],
            ["zori_all", "Rents"],
            ["price_to_income", "Affordability"],
            ["permits_total_units", "New housing"],
          ].filter(([id]) => measures.some((measure) => measure.metric_id === id)).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={measure.metric_id === id} onClick={() => setMetricId(id)}>{label}</button>
          ))}
        </div>
        <div className="measure-intro">
          <div>
            <p className="measure-eyebrow">On the map</p>
            <h2 className="measure-name" id="explorer-heading">
              {measure.label}
            </h2>
            {definition && (
              <p className="measure-def">
                {definition.what}{" "}
                <span className="measure-why">{definition.why}</span>
              </p>
            )}
            <p className="measure-window">
              Change {phrase}, by county
              {current.start && current.end
                ? ` · ${windowLabel(current.start, current.end, measure.metric_id)}`
                : ""}
            </p>
          </div>
          {/* What a reader needs to read the chosen window, beside the measure it qualifies
              and only while that window is chosen; set apart as a note, not more definition. */}
          {notes.length > 0 && (
            <aside
              className="window-aside"
              aria-label={`About “${windowName}”`}
            >
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
            <select
              value={measure.metric_id}
              onChange={(event) => setMetricId(event.target.value)}
            >
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
            <div
              className="seg"
              role="radiogroup"
              aria-labelledby="window-label"
              onKeyDown={onWindowKeys}
            >
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
                    title={
                      published ? undefined : "Not published for this measure"
                    }
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
          {/* Whatever the crosshair is over. Empty until the map has loaded, and the
              line keeps its height so the map does not jump when it fills. A county
              also carries its rank; a town or another state carries what it can. */}
          <p className="readout" aria-live="polite">
            {focus ? (
              <>
                <b>{focus.name}</b> · {formatChange(focus.change)} · now{" "}
                {latest(focus.latest)} ·{" "}
                {rankWords(
                  focus.rank,
                  focus.of,
                  "change",
                  measure.direction,
                  phrase,
                )}
              </>
            ) : markedTown ? (
              <>
                <b>{markedTown.label ?? markedTown.name}</b> · {measure.label}
                {basis.kind === "change" ? `, ${phrase}` : ""}:{" "}
                {reading(Number(markedTown.id))}
              </>
            ) : (
              centre && (
                <>
                  <b>{centre.name}</b> ·{" "}
                  {centre.level === "state"
                    ? "outside New Jersey, so no figures are published for it"
                    : centre.value === null
                      ? `no ${measure.label.toLowerCase()} published here`
                      : `${measure.label}${basis.kind === "change" ? `, ${phrase}` : ""}: ` +
                        reading(Number(centre.id))}
                </>
              )
            )}
          </p>
          <GlobeMap
            appearance="atlas"
            width={frame.width}
            height={frame.height}
            metric={measure.metric_id}
            windowKey={key}
            metricLabel={measure.label}
            windowPhrase={phrase}
            format={(value) =>
              formatMetric(value, measure.unit, measure.metric_id)
            }
            formatChange={formatChange}
            file={file}
            layers={layers}
            failed={failed}
            active={picked ?? hovered}
            mute={picked !== null}
            onView={onView}
          />
        </div>
        <div className="rank-card">
          <div className="nj-rank-head">
            <h3>{level === "municipality" ? "Municipalities" : "County comparison"}</h3>
            <span>{level === "municipality" ? "In this view" : `${rows.length} of ${counties} counties`}</span>
          </div>
          {level === "municipality" && file ? (
            // The map is drawing towns, so the ranking lists towns: there is no
            // published municipal ranking on this page, and the map's own figures
            // are what keep the two one view (#152).
            <TownRanks
              file={file}
              measure={{
                readings: basis.values,
                label: measure.label,
                basis:
                  basis.kind === "change"
                    ? `change ${phrase}`
                    : `${measure.label.toLowerCase()} today`,
                direction: measure.direction,
                format: basis.kind === "change" ? formatChange : latestOf,
              }}
              hovered={marked}
              onHover={setPicked}
            />
          ) : (
            <>
              <p className="table-note">
                Ranked by change {phrase}, not by level: rank 1 is the{" "}
                {measure.direction === "lower_is_better"
                  ? "smallest"
                  : "largest"}{" "}
                rise, following the measure’s own direction.
                {rows.length < counties
                  ? ` ${rows.length} of the ${counties} counties have this measure.`
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
                        className={row.id === marked ? "on" : undefined}
                        onMouseEnter={() => setPicked(row.id)}
                        onMouseLeave={() => setPicked(null)}
                      >
                        <td className="num pos">{row.rank}</td>
                        <td>
                          <Link
                            href={`/regions/${row.id}`}
                            onFocus={() => setPicked(row.id)}
                            onBlur={() => setPicked(null)}
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="num">{formatChange(row.change)}</td>
                        <td className="num">{latest(row.latest)}</td>
                        <td className="go">
                          {/* A second way in at the row's end, out of the tab order: the name
                            is the keyboard's link. */}
                          <Link
                            href={`/regions/${row.id}`}
                            tabIndex={-1}
                            aria-hidden="true"
                          >
                            ›
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
