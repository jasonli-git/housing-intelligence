"use client";

import { useId, useState } from "react";

import { costToOwn, DEFAULT_DOWN, DOWN_PAYMENTS, incomeFor, leftOut } from "@/lib/cost";
import { formatValue } from "@/lib/format";

/** A figure and when it is from, already labelled for a reader: "Jul 2026". */
export type Dated = { value: number; asOf: string };

function money(value: number): string {
  return formatValue(value, "usd");
}

function listed(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * What it costs per month to own the typical home here, and how that compares with the
 * typical rent (Milestone 17).
 *
 * The one control is the down payment, 20% unless the reader changes it; everything else
 * is a published figure, printed beside the line it feeds. The rent comparison says the
 * two indexes describe different homes, because Zillow's rent covers every kind of rental
 * and its home value only single-family houses — a gap between them is partly that.
 * Rendered on the server at the default and re-computed in the browser on change, so the
 * page reads correctly with no script and prints at 20%.
 */
export function CostToOwn({
  home,
  rate,
  tax,
  rent,
  noTax,
}: {
  home: Dated;
  rate: Dated;
  tax: Dated | null;
  rent: Dated | null;
  /** Why the tax bill is missing, when it is. */
  noTax: string | null;
}) {
  const [down, setDown] = useState<number>(DEFAULT_DOWN);
  const id = useId();
  const cost = costToOwn({
    homeValue: home.value,
    ratePct: rate.value,
    downPct: down,
    annualTax: tax?.value ?? null,
  });
  const gap = rent ? cost.total - rent.value : null;

  return (
    <section className="section cost" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <h2 id={`${id}-heading`}>What it costs per month</h2>
        <label className="control">
          <span className="control-label">Down payment</span>
          <select value={down} onChange={(event) => setDown(Number(event.target.value))}>
            {DOWN_PAYMENTS.map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cost-grid">
        <dl className="cost-lines" aria-live="polite">
          <div>
            <dt>
              Typical single-family home <span className="src">Zillow, {home.asOf}</span>
            </dt>
            <dd>{money(home.value)}</dd>
          </div>
          <div>
            <dt>Down payment, {down}%</dt>
            <dd>{money(cost.down)}</dd>
          </div>
          <div>
            <dt>
              Mortgage, 30-year fixed at {rate.value.toFixed(2)}%{" "}
              <span className="src">national average, {rate.asOf}</span>
            </dt>
            <dd>{money(cost.mortgage)}/mo</dd>
          </div>
          <div>
            <dt>
              Property tax
              {tax && (
                <>
                  , a typical bill of {money(tax.value)} a year{" "}
                  <span className="src">MOD-IV, {tax.asOf}</span>
                </>
              )}
            </dt>
            <dd>{cost.tax === null ? "not included" : `${money(cost.tax)}/mo`}</dd>
          </div>
          <div className="total">
            <dt>To own the typical home{cost.tax === null ? ", before property tax" : ""}</dt>
            <dd>{money(cost.total)}/mo</dd>
          </div>
          <div>
            <dt>Income at which that is 30% of pay</dt>
            <dd>{money(cost.incomeNeeded)} a year</dd>
          </div>
        </dl>

        <div className="cost-notes">
          {rent && gap !== null && (
            <p>
              The typical rent here is {money(rent.value)}/mo ({rent.asOf}), so owning costs{" "}
              {Math.abs(gap) < 50
                ? "about the same as renting"
                : `${money(Math.abs(gap))} ${gap > 0 ? "more" : "less"} a month than renting`}
              ; renting takes {money(incomeFor(rent.value))} a year to stay at 30% of pay.
              Zillow’s rent covers every kind of rental home, mostly apartments, and its home
              value only single-family houses, so the two describe different homes.
            </p>
          )}
          {noTax && <p>{noTax}</p>}
          <p className="muted">
            Left out: {listed(leftOut(down))}. Computed from the figures shown by fixed rules;
            not a quote, and not written by AI.
          </p>
        </div>
      </div>
    </section>
  );
}
