"use client";

import { type ReactNode, useId, useState } from "react";

import { TrendChart } from "@/components/TrendChart";
import { periodLabel } from "@/lib/periods";
import { openingYear, type Point, selectableYears, since, sinceLine, yearsNote } from "@/lib/since";

export type TrendSeries = {
  metricId: string;
  title: string;
  /** The series as a sentence names it: "home values". */
  short: string;
  unit: string;
  points: Point[];
  /** The values table, rendered on the server and passed through to the chart. */
  table: ReactNode;
};

/**
 * A region page's trends, read from a year the reader picks (Milestone 17, and the owner's
 * review of it): a dropdown and a slider over the same years, a line per trend saying then
 * against now, and each chart marking the reading it compares.
 *
 * A chart with no reading in the picked year is hidden rather than shown unmarked — its
 * line above still says why ("the series begins in 2019") — and returns as soon as a year
 * it covers is picked. The trends open where every chart has a reading (`openingYear`),
 * so none is missing before the reader has chosen anything.
 *
 * Everything is worked out in the browser from the points the charts already carry, so
 * the page ships no second copy of the answers.
 */
export function TrendsExplorer({ series }: { series: TrendSeries[] }) {
  const all = series.map((s) => s.points);
  const years = selectableYears(all); // newest first
  const ascending = [...years].reverse();
  const [year, setYear] = useState(() => openingYear(all, years));
  const id = useId();

  const readings = series.map((s) => ({ s, reading: years.length > 0 ? since(s.points, year) : null }));
  const charts = years.length > 0 ? readings.filter((r) => r.reading !== null) : readings;
  const note = yearsNote(series);

  return (
    <>
      {years.length > 0 && (
        <div className="since">
          <div className="since-controls">
            <label className="control" htmlFor={`${id}-year`}>
              <span className="control-label">Since the year you moved here</span>
              <select id={`${id}-year`} value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="range"
              className="since-slider"
              min={0}
              max={ascending.length - 1}
              step={1}
              value={Math.max(0, ascending.indexOf(year))}
              aria-label="Year, on a slider"
              aria-valuetext={String(year)}
              onChange={(event) => setYear(ascending[Number(event.target.value)])}
            />
            <span className="since-range" aria-hidden="true">
              {ascending[0]}–{ascending.at(-1)}
            </span>
          </div>
          {/* By the control it explains: why the years reach back to one series' start. */}
          {note && <p className="since-note">{note}</p>}
          <ul className="since-lines" aria-live="polite">
            {series.map((s) => {
              const line = sinceLine({ metricId: s.metricId, label: s.title, unit: s.unit, points: s.points }, year);
              return (
                <li key={s.metricId}>
                  <span className="since-label">{line.label}</span> {line.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="trends">
        {charts.map(({ s, reading }) => (
          <TrendChart
            key={s.metricId}
            points={s.points.map((p) => ({ date: p.period_end, value: p.value }))}
            title={s.title}
            unit={s.unit}
            metricId={s.metricId}
            marker={
              reading
                ? { date: reading.from.period_end, label: periodLabel(reading.from.period_end, s.metricId) }
                : null
            }
          >
            {s.table}
          </TrendChart>
        ))}
      </div>
    </>
  );
}
