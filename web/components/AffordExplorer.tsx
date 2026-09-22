"use client";

import Link from "next/link";
import { Fragment, type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";

import { PlacePicker } from "@/components/PlacePicker";
import {
  checkPlace,
  type Mode,
  monthlyBudget,
  type Place,
  type Reached,
  reach,
} from "@/lib/afford";
import { DEFAULT_DOWN, DOWN_PAYMENTS, incomeFor, leftOut } from "@/lib/cost";
import { formatValue } from "@/lib/format";
import { type Focus, GlobeMap } from "@/components/GlobeMap";
import { useMapFile } from "@/components/useMapFile";
import type { SearchEntry } from "@/lib/search";

const DEFAULT_INCOME = "100000";
// The municipalities listed before "Show all": enough to answer, short enough to scan.
const FIRST_TOWNS = 25;

// The box the map is drawn in, as the New Jersey page's is.
const MAP_WIDTH = 540;
const MAP_HEIGHT = 580;

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
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The three states the map paints, and what each one means. */
const REACH_KEY: readonly [string, string][] = [
  ["var(--seq-550)", "within reach"],
  ["var(--tick)", "beyond reach"],
  ["var(--nodata)", "no figure"],
];

/** One side of "can I afford this place?": its monthly cost, its share of income, the verdict. */
function CheckCell({
  label,
  row,
  missing,
}: {
  label: string;
  row: Reached | null;
  missing: string;
}) {
  if (!row) {
    return (
      <div className="check-cell">
        <span className="label">{label}</span>
        <p className="check-missing">{missing}</p>
      </div>
    );
  }
  return (
    <div className="check-cell">
      <span className="label">{label}</span>
      <b className="check-figure">
        {money(row.monthly)}
        <span>/mo</span>
      </b>
      <span className="check-share">
        {share(row.share)} of your income{" "}
        <span className={row.within ? "status within" : "status beyond"}>
          {row.within ? "Within reach" : "Beyond reach"}
        </span>
      </span>
      <span className="check-need">
        It takes {money(incomeFor(row.monthly))} a year to keep it at 30%.
      </span>
    </div>
  );
}

/**
 * The affordability page's controls and answers: an income, owning or renting, a down
 * payment, and every county and municipality marked within reach or not (Milestone 17).
 * All of it is computed in the browser from figures the page carries.
 *
 * Since Milestone 23 it also answers for one place — "can I afford this place?", a place
 * and an income together — and reads `?income=` and `?place=` from its address when it
 * loads, so the New Jersey page's call to action and a region page can open it filled in.
 */
export function AffordExplorer({
  counties,
  towns,
  rate,
  asOf,
  appearance = "classic",
  scope,
}: {
  counties: Place[];
  towns: Place[];
  rate: { value: number; asOf: string };
  asOf: { home: string; rent: string; tax: string };
  appearance?: "classic" | "atlas";
  scope?: { countyId: number; countyName: string };
}) {
  const [incomeText, setIncomeText] = useState(DEFAULT_INCOME);
  const [mode, setMode] = useState<Mode>("own");
  const [down, setDown] = useState<number>(DEFAULT_DOWN);
  const [allTowns, setAllTowns] = useState(false);
  // A county profile has already answered "which place?". Start its local affordability
  // mode with that county selected instead of asking the reader to type it again.
  const [picked, setPicked] = useState<number | null>(scope?.countyId ?? null);
  const id = useId();
  const { file, layers, failed } = useMapFile();
  const [centre, setCentre] = useState<Focus | null>(null);

  const places = useMemo(() => [...counties, ...towns], [counties, towns]);
  const entries: SearchEntry[] = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        name: p.name,
        detail: p.detail ?? "County",
        level: p.level,
      })),
    [places],
  );

  // An income or a place passed in the address, read once on arrival. A static page has
  // no server to read it, and reading it here keeps the page renderable without it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const income = params.get("income")?.replace(/[^0-9]/g, "");
    if (income) setIncomeText(income);
    const place = Number(params.get("place"));
    if (place && places.some((p) => p.id === place)) setPicked(place);
  }, [places]);

  const income = Number(incomeText.replace(/[^0-9.]/g, "")) || 0;
  const options = { mode, income, downPct: down, ratePct: rate.value };
  const countyRows = income > 0 ? reach(counties, options) : [];
  const townRows = income > 0 ? reach(towns, options) : [];
  const townsWithin = townRows.filter((row) => row.within);
  const countiesWithin = countyRows.filter((row) => row.within).length;
  const shownTowns = allTowns ? townsWithin : townsWithin.slice(0, FIRST_TOWNS);
  const comparisonRows = scope ? townRows : countyRows;
  const home =
    mode === "own"
      ? "owning the typical single-family home"
      : "renting the typical home";
  const pickedPlace =
    picked === null ? null : (places.find((p) => p.id === picked) ?? null);
  // The map paints from the same rows the lists are built from, so the two can never
  // disagree about whether a place is within reach.
  const byPlace = useMemo(
    () =>
      new Map([...countyRows, ...townRows].map((row) => [row.place.id, row])),
    [countyRows, townRows],
  );
  const paintReach = (id: number | string) => {
    const row = byPlace.get(Number(id));
    if (!row) return null;
    return row.within ? "var(--seq-550)" : "var(--tick)";
  };
  const reachOf = (id: number) => {
    const row = byPlace.get(id);
    if (!row) return "no figure for this measure here";
    return `${money(row.monthly)}/mo, ${share(row.share)} of income — ${row.within ? "within reach" : "beyond reach"}`;
  };
  const check =
    pickedPlace && income > 0
      ? checkPlace(pickedPlace, { income, downPct: down, ratePct: rate.value })
      : null;

  function onModeKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const next = mode === "own" ? "rent" : "own";
    setMode(next);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next === "own" ? 0 : 1]?.focus();
  }

  return (
    <section className="afford" aria-labelledby={`${id}-summary`}>
      <div className="afford-controls">
        <label className="control" htmlFor={`${id}-income`}>
          <span className="control-label">
            Household income, a year before tax
          </span>
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
          <div
            className="seg"
            role="radiogroup"
            aria-labelledby={`${id}-mode`}
            onKeyDown={onModeKeys}
          >
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
            <select
              id={`${id}-down`}
              value={down}
              onChange={(event) => setDown(Number(event.target.value))}
            >
              {DOWN_PAYMENTS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}%
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="check" aria-labelledby={`${id}-check`}>
        <div className="check-head">
          <h2 id={`${id}-check`} className="check-title">
            Can I afford a specific place?
          </h2>
          <PlacePicker
            key={picked ?? "none"}
            className="place-search"
            entries={entries}
            onPick={(entry) => setPicked(entry.id)}
            label="A town or county to check"
            placeholder="Type a town or county"
            name="check-place"
            initialQuery={pickedPlace?.name ?? ""}
            keepPicked
          />
        </div>
        {pickedPlace && check ? (
          <>
            <p className="check-place">
              <Link href={`/regions/${pickedPlace.id}`}>
                {pickedPlace.name}
              </Link>
              {pickedPlace.detail && <span>{pickedPlace.detail}</span>}
            </p>
            <div className="check-grid">
              <CheckCell
                label="To own the typical single-family home"
                row={check.own}
                missing={
                  pickedPlace.home === null
                    ? "Zillow has no home value here, so the cost to own is not worked out."
                    : "There is no property tax figure here, so the cost to own is not worked out."
                }
              />
              <CheckCell
                label="To rent the typical home"
                row={check.rent}
                missing="Zillow publishes no rent figure here."
              />
            </div>
          </>
        ) : (
          <p className="check-missing">
            {income > 0
              ? "Pick a town or county to see what its typical home costs at this income, owned and rented."
              : "Enter an income above, then pick a place."}
          </p>
        )}
      </section>

      <p className="afford-summary" id={`${id}-summary`} aria-live="polite">
        {income > 0 ? (
          scope ? <>
            30% of {money(income)} a year is <b>{money(monthlyBudget(income))} a month</b>. At that, {home} is
            within reach in <b>{townsWithin.length}</b> of {townRows.length} municipalities in {scope.countyName}.
          </> : <>
            30% of {money(income)} a year is{" "}
            <b>{money(monthlyBudget(income))} a month</b>. At that, {home} is
            within reach in <b>{countiesWithin}</b> of {countyRows.length}{" "}
            counties and <b>{townsWithin.length}</b> of {townRows.length}{" "}
            municipalities.
          </>
        ) : (
          "Enter a yearly household income to see where the typical home is within reach."
        )}
      </p>

      <div className="explorer">
        <div className="map-panel">
          {/* The globe, at municipal level: this page is about places a reader could
              live, and 564 towns is the answer where 21 counties is a summary. Milestone
              17 drew it on the two-dimensional county map and left carrying it here to
              Milestone 16 (#144). Painted in three states rather than by quantile — a town
              a few dollars over the line must not share a color with one a few under. */}
          <GlobeMap
            appearance={appearance}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            file={file}
            layers={layers}
            failed={failed}
            pin="municipality"
            metric=""
            windowKey=""
            metricLabel="within reach"
            windowPhrase=""
            format={money}
            formatChange={money}
            paint={paintReach}
            describe={`Municipalities where ${home} is within reach on this income. The lists below the map carry the same figures.`}
            legend={
              <p className="globe-ramp">
                <b>On this income</b>
                {REACH_KEY.map(([color, label]) => (
                  <span key={label}>
                    <i className="swatch" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </p>
            }
            active={picked}
            // Searching a place moves the map to it: the question on this page is where
            // a reader could live, and answering "can I afford Montclair?" while leaving
            // the map over somewhere else makes them find it themselves.
            frameOn={picked ?? scope?.countyId ?? null}
            mute={false}
            onView={(state) => setCentre(state.focus)}
          />
          {centre && (
            <p className="readout" aria-live="polite">
              <b>{centre.name}</b> · {reachOf(Number(centre.id))}
            </p>
          )}
        </div>
        <div className="scroll-x">
          <table className="ranks">
            <thead>
              <tr>
                <th scope="col">{scope ? "Municipality" : "County"}</th>
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
              {([true, false] as const).map((within) => {
                const group = comparisonRows.filter((row) => row.within === within);
                if (!group.length) return null;
                return (
                  <Fragment key={String(within)}>
                    <tr className="afford-group-row"><th colSpan={4} scope="rowgroup">{scope
                      ? within ? "Municipalities within reach" : "Other municipalities"
                      : within ? "Counties within reach" : "Other counties"}</th></tr>
                    {group.map((row) => (
                      <tr
                        key={row.place.id}
                        className={row.within ? "within" : !scope ? "afford-secondary" : undefined}
                      >
                        <td><Link href={`/regions/${row.place.id}`}>{row.place.name}</Link></td>
                        <td className="num">{money(row.monthly)}</td>
                        <td className="num">{share(row.share)}</td>
                        <td className="reach-mark">{row.within ? "within reach" : ""}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {income > 0 && !scope && (
        <section className="section" aria-labelledby={`${id}-towns`}>
          <h2 id={`${id}-towns`}>Municipalities within reach</h2>
          {townsWithin.length === 0 ? (
            <p className="meta">
              None of the {townRows.length} municipalities with figures is
              within reach at this income.
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
                          <Link href={`/regions/${row.place.id}`}>
                            {row.place.name}
                          </Link>
                          {row.place.detail && (
                            <span className="result-detail">
                              {" "}
                              {row.place.detail}
                            </span>
                          )}
                        </td>
                        <td className="num">{money(row.monthly)}</td>
                        <td className="num">{share(row.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {townsWithin.length > FIRST_TOWNS && (
                <button
                  type="button"
                  className="button"
                  onClick={() => setAllTowns((all) => !all)}
                >
                  {allTowns
                    ? `Show the first ${FIRST_TOWNS}`
                    : `Show all ${townsWithin.length}`}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <p className="table-note afford-notes">
        {mode === "own" ? (
          <>
            Owning: Zillow’s typical single-family home value ({asOf.home}), a
            30-year fixed loan at {rate.value.toFixed(2)}% (the national
            average, {rate.asOf}) with {down}% down, and the typical property
            tax bill from New Jersey’s assessment records ({asOf.tax}). Left
            out: {listed(leftOut(down))}. Places without a Zillow value or a
            matched tax bill are not counted.
          </>
        ) : (
          <>
            Renting: Zillow’s observed rent ({asOf.rent}), which covers every
            kind of rental home and is published for fewer places than home
            values. Places without it are not counted.
          </>
        )}{" "}
        Computed from these figures by fixed rules; not a quote, and not written
        by AI.
      </p>
    </section>
  );
}
