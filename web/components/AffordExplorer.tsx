"use client";

import Link from "next/link";
import { type KeyboardEvent, useId, useState } from "react";

import { type Mode, monthlyBudget, type Place, type Reached, reach } from "@/lib/afford";
import { DEFAULT_DOWN, DOWN_PAYMENTS, leftOut } from "@/lib/cost";
import { formatValue } from "@/lib/format";
import type { Projected } from "@/lib/geo";

const DEFAULT_INCOME = "100000";
// The municipalities listed before "Show all": enough to answer, short enough to scan.
const FIRST_TOWNS = 25;

const MODES: { key: Mode; label: string }[] = [
  { key: "own", label: "Own" },
  { key: "rent", label: "Rent" },
];

function money(value: number): string {
  return formatValue(value, "usd");
}

function share(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function listed(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * Within reach or not, and nothing between. The New Jersey page's choropleth shades by
 * quantile, which is right for ranking a measure and wrong here: a county a few dollars
 * over the line would share a colour with one a few dollars under it. Two states and a
 * third for "no figure", as Milestone 16's highlight-and-mute proposes.
 */
function ReachMap({ map, rows }: { map: Projected; rows: Map<number, Reached> }) {
  const fill = (id: number) => {
    const row = rows.get(id);
    if (!row) return "var(--surface-2)";
    return row.within ? "var(--seq-550)" : "var(--seq-100)";
  };
  return (
    <figure className="map">
      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        role="img"
        aria-label="Counties where the typical home is within reach. The table beside the map carries the same figures."
      >
        {map.shapes.map((shape) => {
          const row = rows.get(shape.id);
          const tooltip = row
            ? `${shape.name}: ${money(row.monthly)}/mo, ${share(row.share)} of income — ${row.within ? "within reach" : "beyond reach"}`
            : `${shape.name}: no figure`;
          return (
            <a key={shape.id} href={`/regions/${shape.id}`} tabIndex={-1}>
              <path d={shape.d} className="county" fill={fill(shape.id)}>
                <title>{tooltip}</title>
              </path>
            </a>
          );
        })}
      </svg>
      <div className="legend" aria-hidden="true">
        <span>
          <i className="swatch" style={{ background: "var(--seq-550)" }} />
          within reach
        </span>
        <span>
          <i className="swatch" style={{ background: "var(--seq-100)" }} />
          beyond reach
        </span>
        <span>
          <i className="swatch" style={{ background: "var(--surface-2)" }} />
          no figure
        </span>
      </div>
    </figure>
  );
}

/**
 * The affordability page's controls and answers: an income, owning or renting, a down
 * payment, and every county and municipality marked within reach or not (Milestone 17).
 * All of it is computed in the browser from figures the page carries.
 */
export function AffordExplorer({
  map,
  counties,
  towns,
  rate,
  asOf,
}: {
  map: Projected;
  counties: Place[];
  towns: Place[];
  rate: { value: number; asOf: string };
  asOf: { home: string; rent: string; tax: string };
}) {
  const [incomeText, setIncomeText] = useState(DEFAULT_INCOME);
  const [mode, setMode] = useState<Mode>("own");
  const [down, setDown] = useState<number>(DEFAULT_DOWN);
  const [allTowns, setAllTowns] = useState(false);
  const id = useId();

  const income = Number(incomeText.replace(/[^0-9.]/g, "")) || 0;
  const options = { mode, income, downPct: down, ratePct: rate.value };
  const countyRows = income > 0 ? reach(counties, options) : [];
  const townRows = income > 0 ? reach(towns, options) : [];
  const townsWithin = townRows.filter((row) => row.within);
  const countiesWithin = countyRows.filter((row) => row.within).length;
  const shownTowns = allTowns ? townsWithin : townsWithin.slice(0, FIRST_TOWNS);
  const home = mode === "own" ? "owning the typical single-family home" : "renting the typical home";

  function onModeKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = mode === "own" ? "rent" : "own";
    setMode(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next === "own" ? 0 : 1]?.focus();
  }

  return (
    <section className="afford" aria-labelledby={`${id}-summary`}>
      <div className="afford-controls">
        <label className="control" htmlFor={`${id}-income`}>
          <span className="control-label">Household income, a year before tax</span>
          <span className="money-input">
            <span aria-hidden="true">$</span>
            <input
              id={`${id}-income`}
              inputMode="numeric"
              autoComplete="off"
              value={incomeText}
              onChange={(event) => setIncomeText(event.target.value)}
            />
          </span>
        </label>
        <div className="control">
          <span className="control-label" id={`${id}-mode`}>
            To
          </span>
          <div className="seg" role="radiogroup" aria-labelledby={`${id}-mode`} onKeyDown={onModeKeys}>
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                tabIndex={mode === m.key ? 0 : -1}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {mode === "own" && (
          <label className="control" htmlFor={`${id}-down`}>
            <span className="control-label">Down payment</span>
            <select id={`${id}-down`} value={down} onChange={(event) => setDown(Number(event.target.value))}>
              {DOWN_PAYMENTS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}%
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="afford-summary" id={`${id}-summary`} aria-live="polite">
        {income > 0 ? (
          <>
            30% of {money(income)} a year is <b>{money(monthlyBudget(income))} a month</b>. At that,{" "}
            {home} is within reach in <b>{countiesWithin}</b> of {countyRows.length} counties and{" "}
            <b>{townsWithin.length}</b> of {townRows.length} municipalities.
          </>
        ) : (
          "Enter a yearly household income to see where the typical home is within reach."
        )}
      </p>

      <div className="explorer">
        <ReachMap map={map} rows={new Map(countyRows.map((row) => [row.place.id, row]))} />
        <div className="scroll-x">
          <table className="ranks">
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col" className="num">
                  A month
                </th>
                <th scope="col" className="num">
                  Of income
                </th>
                <th scope="col">
                  <span className="visually-hidden">Within reach</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {countyRows.map((row) => (
                <tr key={row.place.id} className={row.within ? "within" : undefined}>
                  <td>
                    <Link href={`/regions/${row.place.id}`}>{row.place.name}</Link>
                  </td>
                  <td className="num">{money(row.monthly)}</td>
                  <td className="num">{share(row.share)}</td>
                  <td className="reach-mark">{row.within ? "within reach" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {income > 0 && (
        <section className="section" aria-labelledby={`${id}-towns`}>
          <h2 id={`${id}-towns`}>Municipalities within reach</h2>
          {townsWithin.length === 0 ? (
            <p className="meta">
              None of the {townRows.length} municipalities with figures is within reach at this
              income.
              {townRows[0] &&
                ` The least expensive is ${townRows[0].place.name}, at ${money(townRows[0].monthly)} a month — ${share(townRows[0].share)} of it.`}
            </p>
          ) : (
            <>
              <div className="scroll-x">
                <table className="ranks towns">
                  <thead>
                    <tr>
                      <th scope="col">Municipality</th>
                      <th scope="col" className="num">
                        A month
                      </th>
                      <th scope="col" className="num">
                        Of income
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownTowns.map((row) => (
                      <tr key={row.place.id}>
                        <td>
                          <Link href={`/regions/${row.place.id}`}>{row.place.name}</Link>
                          {row.place.detail && <span className="result-detail"> {row.place.detail}</span>}
                        </td>
                        <td className="num">{money(row.monthly)}</td>
                        <td className="num">{share(row.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {townsWithin.length > FIRST_TOWNS && (
                <button type="button" className="button" onClick={() => setAllTowns((all) => !all)}>
                  {allTowns ? `Show the first ${FIRST_TOWNS}` : `Show all ${townsWithin.length}`}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <p className="table-note afford-notes">
        {mode === "own" ? (
          <>
            Owning: Zillow’s typical single-family home value ({asOf.home}), a 30-year fixed loan
            at {rate.value.toFixed(2)}% (the national average, {rate.asOf}) with {down}% down, and
            the typical property tax bill from New Jersey’s assessment records ({asOf.tax}). Left
            out: {listed(leftOut(down))}. Places without a Zillow value or a matched tax bill are
            not counted.
          </>
        ) : (
          <>
            Renting: Zillow’s observed rent ({asOf.rent}), which covers every kind of rental home
            and is published for fewer places than home values. Places without it are not counted.
          </>
        )}{" "}
        Computed from these figures by fixed rules; not a quote, and not written by AI.
      </p>
    </section>
  );
}
