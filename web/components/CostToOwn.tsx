"use client";

import { useId, useState } from "react";

import { Definition } from "@/components/Glossed";
import { costToOwn, DEFAULT_DOWN, DOWN_PAYMENTS, incomeFor, leftOut } from "@/lib/cost";
import { formatValue } from "@/lib/format";
import type { Term } from "@/lib/glossary";

/** A figure and when it is from, already labelled for a reader: "Jul 2026". */
export type Dated = { value: number; asOf: string };

function money(value: number): string {
  return formatValue(value, "usd");
}

function listed(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function term(key: string, title: string, definition: string): Term {
  return { key, title, phrases: [], definition };
}

/**
 * What it costs per month to own the typical home here, and how that compares with the
 * typical rent (Milestone 17).
 *
 * The one control is the down payment, 20% unless the reader changes it; everything else
 * is a published figure, printed beside the line it feeds. Owning is worked through as a
 * ledger of lines; owning against renting is a small table, so the two monthly costs and
 * the incomes they take sit in columns a reader can compare at a glance — a sentence hid
 * four numbers in a paragraph (the owner's review of 0.15.1). The table is drawn even
 * where Zillow publishes no rent, with dashes and a line saying so, so the section keeps
 * its shape from one place to the next.
 *
 * Each of the table's headings is a definition saying how its figures are worked out and
 * where they come from, filled in with this page's own rate, down payment and dates, so
 * the method sits one hover or tap from the number rather than in a paragraph beside it.
 *
 * The note under the table says the two indexes describe different homes, because
 * Zillow's rent covers every kind of rental and its home value only single-family houses —
 * a gap between them is partly that. Rendered on the server at the default and
 * re-computed in the browser on change, so the page reads correctly with no script and
 * prints at 20%.
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
  const beforeTax = cost.tax === null;
  const gap = rent ? cost.total - rent.value : null;

  const terms = {
    own: term(
      "cost-own",
      "To own",
      `The typical single-family home’s value (Zillow Home Value Index, ${home.asOf}), less a ` +
        `${down}% down payment, borrowed over 30 years at ${rate.value.toFixed(2)}% — the ` +
        `national average fixed rate (Freddie Mac’s survey, via FRED, ${rate.asOf}). A month ` +
        `is that loan’s principal and interest` +
        (tax
          ? `, plus a twelfth of the typical yearly property tax bill (${money(tax.value)}, ` +
            `from New Jersey’s MOD-IV assessment records, ${tax.asOf}).`
          : `; property tax is not included here.`) +
        ` Left out: ${listed(leftOut(down))}.`,
    ),
    rent: term(
      "cost-rent",
      "To rent",
      rent
        ? `Zillow Observed Rent Index for this place (${rent.asOf}): the typical rent asked for ` +
            `homes listed for rent, across every kind of rental home — mostly apartments — ` +
            `smoothed and seasonally adjusted. It is what a new tenant is asked, not what ` +
            `tenants already in place pay.`
        : "Zillow publishes no rent index for this place, so there is no typical rent to compare.",
    ),
    month: term(
      "cost-month",
      "A month",
      "What the typical home costs each month. Owning: the loan’s principal and interest " +
        "plus a twelfth of the yearly tax bill, as worked through beside this table. Renting: " +
        "the typical asking rent.",
    ),
    income: term(
      "cost-income",
      "Income to keep it at 30% of pay",
      "The yearly household income, before tax, at which a month’s cost is 30% of a month’s " +
        "pay — HUD’s line for cost burden. It is the monthly cost × 12 ÷ 0.3.",
    ),
  };

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
            <dt>To own the typical home{beforeTax ? ", before property tax" : ""}</dt>
            <dd>{money(cost.total)}/mo</dd>
          </div>
        </dl>

        <div className="cost-compare">
          <table className="compare" aria-live="polite">
            <caption className="visually-hidden">Owning the typical home against renting it</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Measure</span>
                </th>
                <th scope="col" className="num">
                  <Definition term={terms.own}>To own</Definition>
                  <span className="src">{beforeTax ? "before property tax" : `${down}% down`}</span>
                </th>
                <th scope="col" className="num">
                  <Definition term={terms.rent}>To rent</Definition>
                  <span className="src">{rent ? `Zillow, ${rent.asOf}` : "no figure"}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <Definition term={terms.month}>A month</Definition>
                </th>
                <td className="num">{money(cost.total)}</td>
                <td className="num">{rent ? money(rent.value) : "—"}</td>
              </tr>
              <tr>
                <th scope="row">
                  <Definition term={terms.income}>Income to keep it at 30% of pay</Definition>
                </th>
                <td className="num">{money(cost.incomeNeeded)}</td>
                <td className="num">{rent ? money(incomeFor(rent.value)) : "—"}</td>
              </tr>
            </tbody>
          </table>
          {rent && gap !== null ? (
            <>
              <p className="compare-gap">
                {Math.abs(gap) < 50 ? (
                  "Owning and renting cost about the same a month"
                ) : (
                  <>
                    Owning costs <b>{money(Math.abs(gap))}</b> {gap > 0 ? "more" : "less"} a month
                    than renting
                  </>
                )}
                {beforeTax ? ", before property tax." : "."}
              </p>
              <p className="compare-note">
                Zillow’s rent covers every kind of rental home, mostly apartments; its home value
                covers only single-family houses, so the two describe different homes.
              </p>
            </>
          ) : (
            <p className="compare-note">
              No rent figure for this place: Zillow publishes its rent index for fewer places
              than its home values.
            </p>
          )}
          {noTax && <p className="compare-note">{noTax}</p>}
          <p className="compare-note">Hover or tap a heading for how its figures are worked out.</p>
        </div>
      </div>

      <p className="muted cost-left-out">
        Left out: {listed(leftOut(down))}. Computed from the figures shown by fixed rules; not a
        quote, and not written by AI.
      </p>
    </section>
  );
}
