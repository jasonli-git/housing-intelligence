"use client";

import Link from "next/link";
import { useState } from "react";

import type { MapFile } from "@/lib/mapdata";

/** How many towns are listed before the reader asks for the rest, as `/afford` does. */
const FIRST_PAGE = 25;

type Channel = {
  /** region_id -> the figure the map is drawing there, from `readingsFor`. */
  readings: Record<string, number>;
  /** The measure's name, and how the figures read: "change over five years". */
  label: string;
  basis: string;
  direction: string;
  format: (value: number) => string;
};

/**
 * The 564 municipalities, ranked by whatever the map is raising into blocks.
 *
 * The county ranking beside the map comes from `region_rankings`, published per measure,
 * per window and per level. There is no municipal equivalent on this page and there
 * should not be: 564 towns across 29 measures and six windows is a page of its own, and
 * embedding it would undo the weight this milestone spent (#161). So the table lists
 * what the map is drawing, from the same `map.json` the map reads — which is also what
 * keeps map and table one view at every zoom (#152).
 *
 * Ranked by whatever the map is drawing — change over the chosen window, or the latest
 * level where a measure publishes no change — so the two are one view at every zoom.
 * The heading names which: the mistake Milestone 17 was built to stop is a rank whose
 * basis goes unnamed.
 */
export function TownRanks({
  file,
  measure,
  hovered,
  onHover,
}: {
  file: MapFile;
  measure: Channel;
  hovered: number | null;
  onHover: (id: number | null) => void;
}) {
  const [all, setAll] = useState(false);

  const readings = measure.readings;
  const towns = file.municipality.outlines;
  const rows = towns
    .map((town) => ({
      id: Number(town.id),
      name: town.label ?? town.name,
      value: readings[String(town.id)],
    }))
    .filter(
      (row): row is typeof row & { value: number } => row.value !== undefined,
    )
    // Rank 1 is the top of the measure's own direction, as the county ranking's is:
    // the largest figure, unless a smaller one is the better end.
    .sort((a, b) =>
      measure.direction === "lower_is_better"
        ? a.value - b.value
        : b.value - a.value,
    );

  const shown = all ? rows : rows.slice(0, FIRST_PAGE);

  return (
    <>
      <p className="table-note">
        Ranked by {measure.basis}, the same figures the map is drawing: rank 1
        is the {measure.direction === "lower_is_better" ? "lowest" : "highest"},
        following the measure’s own direction.{" "}
        {rows.length < towns.length
          ? `${rows.length} of the ${towns.length} municipalities have this measure. `
          : `All ${towns.length} municipalities have this measure. `}
      </p>
      <div className="scroll-x">
        <table className="ranks">
          <thead>
            <tr>
              <th scope="col" className="num pos">
                #
              </th>
              <th scope="col">Municipality</th>
              <th scope="col" className="num">
                {measure.label}
              </th>
              <th scope="col" className="go">
                <span className="visually-hidden">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr
                key={row.id}
                className={row.id === hovered ? "on" : undefined}
                onMouseEnter={() => onHover(row.id)}
                onMouseLeave={() => onHover(null)}
              >
                <td className="num pos">{index + 1}</td>
                <td>
                  <Link
                    href={`/regions/${row.id}`}
                    onFocus={() => onHover(row.id)}
                    onBlur={() => onHover(null)}
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="num">{measure.format(row.value)}</td>
                <td className="go">
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
      {rows.length > FIRST_PAGE && (
        <button
          type="button"
          className="button"
          onClick={() => setAll((shown) => !shown)}
        >
          {all ? `Show the first ${FIRST_PAGE}` : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
