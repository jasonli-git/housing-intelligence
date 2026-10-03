"use client";

import { useEffect, useId, useState } from "react";

import type { PacketLevel } from "@/lib/api";
import { formatValue } from "@/lib/format";
import {
  countyLabel,
  type Household,
  type IncomeLimits,
  lineFor,
  positionOf,
  positionSentence,
  readHousehold,
  SIZES,
  writeHousehold,
} from "@/lib/household";
import {
  BEDROOM_LABELS,
  BEDROOMS,
  type Bedrooms,
  hasRentEvidence,
  KIND_LABELS,
  rentRows,
} from "@/lib/rentEvidence";
import { parseAmount } from "@/lib/costScenario";
import { HousingHelp } from "@/components/HousingHelp";
import { ReaderDetails } from "@/components/ReaderDetails";

/**
 * Answers sized to the reader's household (Milestone 35): where their income sits against
 * HUD's lines for their household size, and every rent figure held here for the number of
 * bedrooms they need, each labelled for what it measures.
 *
 * Household size, income and current rent are the reader's and are remembered in this
 * browser alone, carried to every page (decided with the owner 2026-10-01); nothing typed
 * here reaches a published figure. Rendered with the figures and no inputs until the
 * page is interactive, so it reads without JavaScript.
 */
export function ForYourHousehold({
  regionName,
  limits,
  levels,
  countyLevels,
  margins,
}: {
  regionName: string;
  limits: IncomeLimits | null;
  levels: PacketLevel[];
  countyLevels: PacketLevel[];
  /** The Census's 90% margins for the page's figures, by metric id. */
  margins: Map<string, number | null>;
}) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [house, setHouse] = useState<Household>({});
  const [incomeText, setIncomeText] = useState("");
  const [rentText, setRentText] = useState("");
  const [bedrooms, setBedrooms] = useState<Bedrooms>(2);

  useEffect(() => {
    const stored = readHousehold();
    setHouse(stored);
    setIncomeText(stored.income === undefined ? "" : String(stored.income));
    setRentText(stored.rent === undefined ? "" : String(stored.rent));
    setReady(true);
  }, []);

  const update = (next: Household) => {
    setHouse(next);
    writeHousehold(next);
  };
  const setAmount = (key: "income" | "rent", text: string) => {
    (key === "income" ? setIncomeText : setRentText)(text);
    const value = parseAmount(text);
    const next = { ...house };
    if (value === null) delete next[key];
    else next[key] = value;
    update(next);
  };

  const size = house.size ?? 3;
  const showRents = hasRentEvidence(levels, countyLevels);
  if (!limits && !showRents) return null;
  const rows = rentRows(
    bedrooms,
    levels,
    countyLevels,
    margins,
    limits ? countyLabel(limits) : null,
    house.rent ?? null,
  );

  return (
    <section className="section household" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <h2 id={`${id}-heading`}>For your household</h2>
      </div>

      {limits && (
        <article className="household-panel">
          <h3 className="household-title">Your income vs. local benchmarks</h3>
          {ready && (
            <div className="household-inputs">
              <label className="control">
                <span className="control-label">People in your household</span>
                <select
                  value={size}
                  onChange={(event) => update({ ...house, size: Number(event.target.value) })}
                >
                  {SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="control">
                <span className="control-label">Yearly income before tax</span>
                <input
                  inputMode="numeric"
                  value={incomeText}
                  placeholder="e.g. 68,000"
                  aria-label="Yearly household income before tax"
                  onChange={(event) => setAmount("income", event.target.value)}
                />
              </label>
            </div>
          )}
          {ready && house.income !== undefined && (
            <p className="household-position" aria-live="polite">
              {positionSentence(limits, size, house.income)}
            </p>
          )}
          <table className="household-lines">
            <caption>
              HUD’s lines for a household of {size}, {countyLabel(limits)}, FY{limits.fiscal_year}
            </caption>
            <thead>
              <tr>
                <th scope="col">Share of median income</th>
                <th scope="col">HUD calls it</th>
                <th scope="col" className="num">
                  Income at or below
                </th>
              </tr>
            </thead>
            <tbody>
              {positionOf(limits, size, house.income ?? Number.POSITIVE_INFINITY).lines.map(
                ({ band }) => (
                  <tr key={band.band}>
                    <td>{band.band}%</td>
                    <td>{band.hud_name}</td>
                    <td className="num">{formatValue(lineFor(band, size), "usd")}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <p className="household-note">
            {limits.via === "self"
              ? `HUD sets these lines for ${countyLabel(limits)}.`
              : limits.via === "parent"
                ? `HUD sets these lines by county; ${regionName} reads ${countyLabel(limits)}’s.`
                : `HUD sets these lines by county; this ZIP code reads ${countyLabel(limits)}’s, where most of its homes are.`}{" "}
            These are income benchmarks, not approval for help. Each program has its own rules.{" "}
            <a
              href="https://www.huduser.gov/portal/datasets/il.html"
              target="_blank"
              rel="noreferrer"
            >
              HUD’s income limits
            </a>
            {" · "}
            <a
              href="https://www.nj.gov/dca/hmfa/homebuyers-and-renters/"
              target="_blank"
              rel="noreferrer"
            >
              NJ Housing and Mortgage Finance Agency
            </a>
          </p>
          <HousingHelp />
        </article>
      )}

      {showRents && (
        <article className="household-panel">
          <h3 className="household-title">Rents here, by size</h3>
          {ready && (
            <div className="household-inputs">
              <div className="cost-view-tabs" role="tablist" aria-label="Bedrooms">
                {BEDROOMS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="tab"
                    aria-selected={bedrooms === b}
                    className={bedrooms === b ? "on" : undefined}
                    onClick={() => setBedrooms(b)}
                  >
                    {BEDROOM_LABELS[b]}
                  </button>
                ))}
              </div>
              <label className="control">
                <span className="control-label">Rent you pay now, a month</span>
                <input
                  inputMode="numeric"
                  value={rentText}
                  placeholder="optional"
                  aria-label="Rent you pay now, a month"
                  onChange={(event) => setAmount("rent", event.target.value)}
                />
              </label>
            </div>
          )}
          {!ready && <p className="household-note">{BEDROOM_LABELS[bedrooms]}</p>}
          <dl className="cost-lines household-rents">
            {rows.map((row) => (
              <div key={row.key} data-kind={row.kind}>
                <dt>
                  <span className="household-kind">{KIND_LABELS[row.kind]}</span> {row.label}
                  <small className="src">
                    {[row.asOf, row.note].filter(Boolean).join(" · ")}
                  </small>
                </dt>
                <dd>
                  {formatValue(row.value, "usd")}/mo
                  {row.margin !== null && (
                    <small className="margin"> ± {formatValue(row.margin, "usd")}</small>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <ReaderDetails title="Why the rent figures differ">
            <p className="household-note">
              Asking rent is for a new lease; existing tenants may pay less. HUD’s benchmark
              is deliberately below the middle of recent movers’ rents. They measure different things.
            </p>
          </ReaderDetails>
        </article>
      )}
    </section>
  );
}
