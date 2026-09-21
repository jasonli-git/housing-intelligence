"use client";

import { useId, useState } from "react";

import { Definition } from "@/components/Definition";
import { costToOwn, DEFAULT_DOWN, DOWN_PAYMENTS, goneAgainstRent, incomeFor, leftOut } from "@/lib/cost";
import { formatValue } from "@/lib/format";
import type { Term } from "@/lib/glossary";

/** A figure and when it is from, already labelled for a reader: "Jul 2026". */
export type Dated = { value: number; asOf: string };

/** The typical home's change in value over the page's window, spread over its months. */
export type Gain = { perMonth: number; from: string; to: string };

/**
 * The price the owning card is worked out from, and what may be said about it.
 *
 * Two different claims, deliberately not one type with a flag. `index` is Zillow's model
 * of what a typical home here *is worth*, so the card can speak of "the typical home".
 * `transactions` is the median of what actually *sold* over a stated window, which
 * describes the homes that changed hands rather than the housing stock — so the card
 * speaks of a purchase at a stated price, and names the window.
 */
export type HomePrice =
  | ({ basis: "index" } & Dated)
  | ({ basis: "transactions"; from: string; to: string } & Dated);

export type CostProps = {
  home: HomePrice;
  rate: Dated;
  tax: Dated | null;
  rent: Dated | null;
  /** Why the tax bill is missing, when it is. */
  noTax: string | null;
  gain: Gain | null;
  /** The national rate when the gain began. */
  rateThen: Dated | null;
};

function money(value: number): string {
  return formatValue(value, "usd");
}

function listed(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function term(key: string, title: string, definition: string): Term {
  return { key, title, phrases: [], definition };
}

function share(part: number, whole: number): string {
  return `${whole > 0 ? (part / whole) * 100 : 0}%`;
}

/**
 * What it costs per month to own the typical home here, and to rent one (Milestone 17),
 * as two cards since Milestone 23: the section most readers turn to first, so the one
 * place a region page raises its voice.
 *
 * Owning leads with its monthly payment and splits it, on a bar and in words, into money
 * gone — interest and tax — and money kept, the principal that pays the loan down and
 * stays the buyer's. Rent is set against money gone rather than the whole payment:
 * counting the part a buyer keeps as cost made owning read hundreds of dollars dearer than
 * renting (the owner's review, 2026-09-14). The strip under both says which is dearer by
 * that count, says plainly that a house usually rents for more than Zillow's all-rental
 * figure, sets the past five years' gain in value beside it as the past, and names what is
 * left out.
 *
 * The cards' headings keep their definitions — how each figure is worked out and where it
 * comes from, filled in with this page's rate, down payment and dates. The one control is
 * the down payment, 20% unless the reader changes it; the report prints the cards at 20%
 * with no control. Rendered on the server at the default and re-computed in the browser
 * on change, so the page reads correctly with no script.
 */
export function CostToOwn({
  home,
  rate,
  tax,
  rent,
  noTax,
  gain,
  rateThen,
  control = true,
}: CostProps & { control?: boolean }) {
  const [down, setDown] = useState<number>(DEFAULT_DOWN);
  const id = useId();
  const cost = costToOwn({
    homeValue: home.value,
    ratePct: rate.value,
    downPct: down,
    annualTax: tax?.value ?? null,
  });
  const beforeTax = cost.tax === null;
  // Whole dollars that add up: money gone is its parts, and the key's parts are the payment,
  // where rounding each figure on its own left them a dollar apart.
  const shown = {
    total: Math.round(cost.total),
    interest: Math.round(cost.interest),
    tax: cost.tax === null ? 0 : Math.round(cost.tax),
  };
  const shownGone = shown.interest + shown.tax;
  const shownKept = shown.total - shownGone;
  const against = rent ? goneAgainstRent(cost.gone, rent.value) : null;
  const cashComparison = rent && against && (
    <>
      Counting only money that’s gone{beforeTax ? ", and before property tax" : ""},{" "}
      {against.kind === "about" ? (
        <>
          owning costs <b>about the same as renting</b>
        </>
      ) : (
        <>
          owning costs{" "}
          <b>
            {money(Math.abs(against.gap))} a month {against.kind}
          </b>{" "}
          than renting
        </>
      )}{" "}
      — {money(shownGone)} against {money(rent.value)} — and the first payment also puts{" "}
      {money(shownKept)} into the home.
    </>
  );
  const rentalCaveat = rent && (
    <>
      A house usually rents for more than this: Zillow’s rent covers every kind of rental
      home, mostly apartments, while its home value covers single-family houses only.
    </>
  );
  const history = gain && (
    <>
      Over the last five years the typical home here {gain.perMonth >= 0 ? "gained" : "lost"} about{" "}
      {money(Math.abs(gain.perMonth))} a month in value ({gain.from} to {gain.to}) — what
      happened, not a promise
      {rateThen
        ? `. Buyers then borrowed at ${rateThen.value.toFixed(2)}% (${rateThen.asOf}), against ${rate.value.toFixed(2)}% (${rate.asOf}).`
        : "."}
    </>
  );

  const terms = {
    own: term(
      "cost-own",
      "To own",
      (home.basis === "index"
        ? `The typical single-family home’s value (Zillow Home Value Index, ${home.asOf})`
        : `A purchase at ${money(home.value)} — the middle price of qualifying residential ` +
          `sales here from ${home.from} to ${home.to}, from New Jersey’s SR1A sales file. ` +
          `That is the middle of what sold in that window, not a valuation of the typical ` +
          `home on any one date, and the homes that sell are not a cross-section of the ` +
          `homes that exist`) +
        `, less a ${down}% down payment, borrowed over 30 years at ${rate.value.toFixed(2)}% — ` +
        `the national average fixed rate (Freddie Mac’s survey, via FRED, ${rate.asOf}). A ` +
        `month is that loan’s principal and interest` +
        (tax
          ? `, plus a twelfth of the typical yearly property tax bill for this area ` +
            `(${money(tax.value)}, from New Jersey’s MOD-IV assessment records, ${tax.asOf}). ` +
            `That bill is the area’s median, not this price’s tax: it is read from the ` +
            `assessment records, never worked out from the price above.`
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
    gone: term(
      "cost-gone",
      "Money gone each month",
      `The part of a month of owning that does not come back: the loan’s interest` +
        (tax ? " and a twelfth of the yearly property tax bill." : "; property tax is not included here.") +
        " The rest of the payment, principal, pays the loan down and stays the owner’s as " +
        "equity in the home. These are the first month’s figures: each month after, a little " +
        "more of the same payment is principal.",
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
        {control ? (
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
        ) : (
          <span className="control-label">{down}% down payment</span>
        )}
      </div>

      <div className="cost-cards">
        <article className="cost-card">
          <h3 className="cost-card-label">
            <Definition term={terms.own}>
              {home.basis === "index"
                ? "To own the typical single-family home"
                : `Estimated monthly cost at a ${money(home.value)} purchase price`}
            </Definition>
          </h3>
          {home.basis === "transactions" && (
            // The window, on the card rather than only in the definition. A reader who
            // never opens the definition still has to be told that this price is the
            // middle of what sold over a span, not a valuation on a date.
            <p className="cost-basis">
              Based on qualifying residential sales here, {home.from} to {home.to}.
            </p>
          )}
          <p className="cost-figure" aria-live="polite">
            <b>{money(shown.total)}</b>
            <span>a month{beforeTax ? ", before property tax" : ", to the lender and the town"}</span>
          </p>
          <div className="gone-kept">
            <div
              className="gone-kept-bar"
              role="img"
              aria-label={
                `Of ${money(shown.total)}: interest ${money(shown.interest)}` +
                (cost.tax === null ? "" : `, property tax ${money(shown.tax)}`) +
                `, and ${money(shownKept)} paid into the home`
              }
            >
              <i style={{ width: share(cost.interest, cost.total), background: "var(--gone-1)" }} />
              {cost.tax !== null && <i style={{ width: share(cost.tax, cost.total), background: "var(--gone-2)" }} />}
              <i style={{ width: share(cost.principal, cost.total), background: "var(--good)" }} />
            </div>
            <p className="gone-kept-key" aria-hidden="true">
              <span>
                <i style={{ background: "var(--gone-1)" }} />
                Interest {money(shown.interest)}
              </span>
              {cost.tax !== null && (
                <span>
                  <i style={{ background: "var(--gone-2)" }} />
                  Property tax {money(shown.tax)}
                </span>
              )}
              <span className="kept">
                <i style={{ background: "var(--good)" }} />
                Paid into your home {money(shownKept)}
              </span>
            </p>
          </div>
          <dl className="cost-lines">
            <div className="sum">
              <dt>
                <Definition term={terms.gone}>Money gone each month</Definition>
              </dt>
              <dd>{money(shownGone)}</dd>
            </div>
            <div>
              <dt>
                {home.basis === "index" ? "Typical single-family home" : "Purchase price"}{" "}
                <small className="src">
                  {home.basis === "index"
                    ? `Zillow, ${home.asOf}`
                    : `NJ SR1A sales, ${home.from} to ${home.to}`}
                </small>
              </dt>
              <dd>{money(home.value)}</dd>
            </div>
            <div>
              <dt>
                Down payment, {down}% <small className="src">money a renter could invest instead</small>
              </dt>
              <dd>{money(cost.down)}</dd>
            </div>
            <div>
              <dt>
                Mortgage, 30-year fixed at {rate.value.toFixed(2)}%{" "}
                <small className="src">national average, {rate.asOf}</small>
              </dt>
              <dd>{money(cost.mortgage)}/mo</dd>
            </div>
            <div>
              <dt>
                Property tax{tax && `, ${money(tax.value)} a year`}
                {tax && <small className="src">MOD-IV, {tax.asOf}</small>}
              </dt>
              <dd>{cost.tax === null ? "not included" : `${money(shown.tax)}/mo`}</dd>
            </div>
            <div>
              <dt>
                <Definition term={terms.income}>Income to keep it at 30% of pay</Definition>
              </dt>
              <dd>{money(cost.incomeNeeded)} a year</dd>
            </div>
          </dl>
        </article>

        <article className="cost-card">
          <h3 className="cost-card-label">
            <Definition term={terms.rent}>To rent the typical home</Definition>
          </h3>
          {rent ? (
            <>
              <p className="cost-figure">
                <b>{money(rent.value)}</b>
                <span>a month, all of it gone</span>
              </p>
              <dl className="cost-lines">
                <div className="sum">
                  <dt>Money gone each month</dt>
                  <dd>{money(rent.value)}</dd>
                </div>
                <div>
                  <dt>
                    Typical rent, any kind of rental home{" "}
                    <small className="src">Zillow, {rent.asOf} · mostly apartments</small>
                  </dt>
                  <dd>{money(rent.value)}/mo</dd>
                </div>
                <div>
                  <dt>Income to keep it at 30% of pay</dt>
                  <dd>{money(incomeFor(rent.value))} a year</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="cost-missing">
              No rent figure for this place: Zillow publishes its rent index for fewer places than
              its home values.
            </p>
          )}
        </article>
      </div>

      {control ? (
        <div className="cost-strip cost-evidence">
          {cashComparison && (
            <div className="cost-evidence-answer">
              <p className="cost-evidence-label">Monthly cash</p>
              <p className="cost-strip-big" aria-live="polite">
                {cashComparison}
              </p>
            </div>
          )}
          <div className="cost-evidence-grid">
            {rentalCaveat && (
              <div className="cost-evidence-item">
                <p className="cost-evidence-label">Comparison caveat</p>
                <p>{rentalCaveat}</p>
              </div>
            )}
            {history && (
              <div className="cost-evidence-item">
                <p className="cost-evidence-label">Five-year context</p>
                <p>{history}</p>
              </div>
            )}
            {noTax && (
              <div className="cost-evidence-item">
                <p className="cost-evidence-label">Tax caveat</p>
                <p>{noTax}</p>
              </div>
            )}
          </div>
          <aside className="cost-evidence-omissions" aria-label="Costs not included">
            <p className="cost-evidence-label">
              <span className="cost-evidence-omissions-mark" aria-hidden="true">i</span>
              Not included
            </p>
            <p>{listed(leftOut(down))}.</p>
          </aside>
          <p className="cost-evidence-method">
            Computed from the figures shown by fixed rules; not a quote, and not written by AI.
          </p>
        </div>
      ) : (
        <div className="cost-strip">
          {cashComparison && (
            <p className="cost-strip-big" aria-live="polite">
              {cashComparison}
            </p>
          )}
          {rentalCaveat && <p className="cost-strip-small">{rentalCaveat}</p>}
          {history && <p className="cost-strip-small">{history}</p>}
          {noTax && <p className="cost-strip-small">{noTax}</p>}
          <p className="cost-strip-small">
            Left out of owning: {listed(leftOut(down))}. Computed from the figures shown by fixed
            rules; not a quote, and not written by AI.
          </p>
        </div>
      )}
    </section>
  );
}
