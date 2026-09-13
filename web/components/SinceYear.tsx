"use client";

import { useId, useState } from "react";

import type { SinceLine } from "@/lib/since";

/**
 * "Since the year you moved here" (Milestone 17): pick a year, read each trend then and
 * now. Every year's lines are worked out on the server, so the page carries a few short
 * sentences per year rather than every monthly reading, and it reads correctly with no
 * script at its default year.
 */
export function SinceYear({
  years,
  initial,
  lines,
}: {
  years: number[];
  initial: number;
  lines: Record<number, SinceLine[]>;
}) {
  const [year, setYear] = useState(initial);
  const id = useId();

  return (
    <div className="since">
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
      <ul className="since-lines" aria-live="polite">
        {(lines[year] ?? []).map((line) => (
          <li key={line.metricId}>
            <span className="since-label">{line.label}</span> {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
