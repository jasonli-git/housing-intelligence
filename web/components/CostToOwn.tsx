"use client";

import { type ReactNode, useId, useState } from "react";

import { Definition } from "@/components/Definition";
import { HousingHelp } from "@/components/HousingHelp";
import { ReaderDetails } from "@/components/ReaderDetails";
import { DEFAULT_DOWN, DOWN_PAYMENTS, goneAgainstRent, incomeFor } from "@/lib/cost";
import {
  CLOSING,
  COMMISSION_PCT,
  DEPOSIT_MONTHS,
  DEPOSIT_RULE,
  FHA,
  FHA_DOWN,
  FHA_LIMITS,
  FLOOD_MAP,
  NJ_TRANSFER_RULE,
  PMI,
  UPKEEP_PCT,
} from "@/lib/costRules";
import { type Personal, parseAmount } from "@/lib/costScenario";
import { formatValue } from "@/lib/format";
import type { Term } from "@/lib/glossary";
import { type Basis, eachMonth, type Inputs, overYears, upFront } from "@/lib/ownership";
import { ownershipInputs, cashFit, DEFAULT_YEARS } from "@/lib/budgetScenario";
import { useBudgetScenario } from "@/components/useBudgetScenario";
import { QuietDisclosure, QuietToolGroup } from "@/components/QuietCounty";
import { CostRibbon } from "@/components/CostRibbon";

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

/**
 * A month of utility bills for a home here (Milestone 33): the typical electricity and gas
 * bills and a twelfth of the yearly water and sewer bill, among homes billed for each, from
 * the Census's brackets. Heating oil and other fuels are left out — a home that burns oil
 * rarely pays for gas too, and adding both would bill one home for two heating systems.
 */
export type Utilities = {
  month: number;
  electricity: number | null;
  gas: number | null;
  waterYear: number | null;
  asOf: string;
};

export type CostProps = {
  home: HomePrice;
  rate: Dated;
  tax: Dated | null;
  /** Homeowners insurance a year, owners with a mortgage, from the Census's brackets. */
  insurance: Dated | null;
  utilities: Utilities | null;
  /** The share of renters here paying at least one utility on top of rent. */
  rentersPayUtilities: Dated | null;
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


/** Where each kind of input came from, in a reader's words. */
const BASIS_WORDS: Record<Basis, string> = {
  source: "published figure",
  rule: "published rule",
  thumb: "rule of thumb",
  range: "typical range",
  reader: "your figure",
  loan: "worked out",
};

/** The colour each part of a month takes on the bar, money kept last. */
const PART_COLOURS: Record<string, string> = {
  interest: "var(--gone-1)",
  tax: "var(--gone-2)",
  insurance: "color-mix(in srgb, var(--gone-1) 55%, var(--gone-2))",
  mi: "color-mix(in srgb, var(--gone-1) 25%, var(--gone-2))",
  utilities: "var(--text-muted)",
  upkeep: "color-mix(in srgb, var(--text-muted) 45%, var(--border))",
  hoa: "var(--notice)",
  flood: "color-mix(in srgb, var(--notice) 55%, var(--border))",
};

/** The holding period the long view starts at, until the reader sets one. */
export { DEFAULT_YEARS } from "@/lib/budgetScenario";

type HomeFields = {
  price: string;
  tax: string;
  rent: string;
  hoa: string;
  flood: string;
  moving: string;
  repairs: string;
};

const NO_HOME_FIELDS: HomeFields = { price: "", tax: "", rent: "", hoa: "", flood: "", moving: "", repairs: "" };

type View = "upfront" | "years";

/**
 * The full cost of owning a home here, and of renting one (Milestone 33; cards since
 * Milestones 17 and 23).
 *
 * The cards show a month of owning with every part of it — the loan, property tax,
 * homeowners insurance, mortgage insurance, utilities and upkeep, and HOA or condo fees and
 * flood insurance where they apply — and beside it a month of renting. Below them, three
 * more views: the cash needed up front, the money a month costs and does not give back,
 * and owning for a number of years then selling, set against renting for as long.
 *
 * Every figure says where it came from: a published figure for this place, a published
 * rule (HUD's FHA premiums, New Jersey's transfer fees), a typical range (the CFPB's
 * closing costs, Freddie Mac's mortgage insurance), or the reader. A total missing a part
 * every home has says *partial estimate* beside it.
 *
 * "Your numbers" lets a reader replace any input. What describes the reader — down
 * payment, rate, quotes, assumptions about the years — follows them to every page in this
 * browser; what describes a home stays on this one (`costScenario`). Nothing typed changes
 * a published figure or a ranking.
 *
 * The report prints the cards at the published figures, with every view and no controls.
 */
export function CostToOwn({
  home,
  rate,
  tax,
  insurance,
  utilities,
  rentersPayUtilities,
  rent,
  noTax,
  gain,
  rateThen,
  control = true,
  beforeMoving,
  showHelp = true,
  comparePlaceId,
  quiet = false,
  householdTools,
}: CostProps & { control?: boolean; beforeMoving?: ReactNode; showHelp?: boolean; comparePlaceId?: number; quiet?: boolean; householdTools?: ReactNode }) {
  const id = useId();
  const { personal, household, savePersonal, saveHousehold } = useBudgetScenario(control);
  const [fields, setFields] = useState<HomeFields>(NO_HOME_FIELDS);
  const [view, setView] = useState<View>("upfront");

  const setPersonal = (key: keyof Personal, value: number | null) => {
    const next = { ...personal };
    if (value === null) delete next[key];
    else next[key] = value;
    savePersonal(next);
  };
  const setField = (key: keyof HomeFields, text: string) => setFields({ ...fields, [key]: text });

  const typedPrice = parseAmount(fields.price);
  const typedTax = parseAmount(fields.tax);
  const typedRent = parseAmount(fields.rent);
  const down = personal.downPct ?? DEFAULT_DOWN;
  const input: Inputs = ownershipInputs({
    price: home.value, ratePct: rate.value, taxYear: tax?.value ?? null,
    insuranceYear: insurance?.value ?? null, utilitiesMonth: utilities?.month ?? null,
    rentMonth: rent?.value ?? null,
  }, personal, {
    price: typedPrice ?? home.value,
    taxYear: typedTax ?? tax?.value ?? null,
    hoaMonth: parseAmount(fields.hoa),
    floodYear: parseAmount(fields.flood),
    movingCost: parseAmount(fields.moving),
    repairsCost: parseAmount(fields.repairs),
    rentMonth: typedRent ?? rent?.value ?? null,
  });
  const month = eachMonth(input, {
    tax: typedTax !== null ? "reader" : "source",
    insurance: personal.insuranceYear !== undefined ? "reader" : "source",
    upkeep: personal.upkeepPct !== undefined ? "reader" : "thumb",
  });
  const up = upFront(input);
  const years = overYears(input);
  const partial = month.missing.length > 0;
  const own = typedPrice !== null || Object.keys(personal).length > 0 || Object.values(fields).some(Boolean);
  const rentMonth = input.rentMonth;
  const utilitiesLine = month.lines.find((l) => l.key === "utilities")?.value ?? 0;

  // Whole dollars that add up: the bar's parts are the month, and each line is rounded
  // once, here, so the key, the lines and the total cannot disagree by a dollar.
  const parts = [
    { key: "interest", label: "Interest", value: month.interest },
    ...month.lines
      .filter((l) => l.key !== "mortgage" && (l.value ?? 0) > 0)
      .map((l) => ({ key: l.key, label: l.label, value: l.value ?? 0 })),
  ];
  const kept = month.principal;

  // Money gone against rent, both without utilities: a home and a rental both pay them,
  // in amounts this page cannot set side by side, and a quoted rent usually leaves them
  // out (`rentersPayUtilities`).
  const goneNoUtilities = month.gone - utilitiesLine;
  const missingBeyondUtilities = month.missing.filter((label) => label !== "Utilities");
  const against = rentMonth !== null ? goneAgainstRent(goneNoUtilities, rentMonth) : null;
  const cashComparison = rentMonth !== null && against && (
    <>
      Counting only money that’s gone, and leaving utilities out of both
      {missingBeyondUtilities.length > 0
        ? ` (and ${listed(missingBeyondUtilities).toLowerCase()}, which no figure covers)`
        : ""}
      ,{" "}
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
      — {money(goneNoUtilities)} against {money(rentMonth)} — and the first payment also puts{" "}
      {money(kept)} into the home.
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

  const priceWords =
    typedPrice !== null
      ? `A purchase at ${money(typedPrice)}, the price you entered`
      : home.basis === "index"
        ? `The typical single-family home’s value (Zillow Home Value Index, ${home.asOf})`
        : `A purchase at ${money(home.value)} — the middle price of qualifying residential ` +
          `sales here from ${home.from} to ${home.to}, from New Jersey’s SR1A sales file. ` +
          `That is the middle of what sold in that window, not a valuation of the typical ` +
          `home on any one date, and the homes that sell are not a cross-section of the ` +
          `homes that exist`;
  const terms = {
    own: term(
      "cost-own",
      "To own",
      `${priceWords}, less a ${down}% down payment, borrowed over 30 years at ` +
        `${input.ratePct.toFixed(2)}%` +
        (personal.ratePct !== undefined
          ? " — the rate you entered."
          : ` — the national benchmark for a 30-year fixed loan (Freddie Mac’s weekly survey, ` +
            `via FRED, ${rate.asOf}), not a quote for any borrower.`) +
        (month.loan.fha
          ? " At 3.5% down the loan is an FHA loan: HUD’s 1.75% upfront premium is added to it, " +
            "and its yearly premium is part of each month."
          : "") +
        " A month adds property tax, homeowners insurance, any mortgage insurance, utilities " +
        "and upkeep, each with where it comes from; HOA fees and flood insurance only if you " +
        "enter them. The tax bill is the area’s median from New Jersey’s assessment records " +
        "unless you enter a bill — never worked out from the price.",
    ),
    rent: term(
      "cost-rent",
      "To rent",
      typedRent !== null
        ? `The rent you entered, ${money(typedRent)} a month.`
        : rent
          ? `Zillow Observed Rent Index for this place (${rent.asOf}): the typical rent asked for ` +
            `homes listed for rent, across every kind of rental home — mostly apartments — ` +
            `smoothed and seasonally adjusted. It is what a new tenant is asked, not what ` +
            `tenants already in place pay, and it does not include utilities.`
          : "Zillow publishes no rent index for this place, so there is no typical rent to compare.",
    ),
    gone: term(
      "cost-gone",
      "Money gone each month",
      "The part of a month of owning that does not come back: interest, tax, insurance, " +
        "mortgage insurance, utilities, upkeep and any fees. The rest, principal, pays the " +
        "loan down and stays the owner’s as equity. These are the first month’s figures: " +
        "each month after, a little more of the payment is principal.",
    ),
    income: term(
      "cost-income",
      "Income to keep it at 30% of pay",
      "The yearly household income, before tax, at which a month’s cost is 30% of a month’s " +
        "pay — HUD’s line for cost burden. It is the monthly cost × 12 ÷ 0.3.",
    ),
    partial: term(
      "cost-partial",
      "Partial estimate",
      `This total leaves out ${listed(month.missing).toLowerCase()}: no published figure ` +
        "covers it for this place. Enter yours under “Your numbers” to complete it.",
    ),
  };

  const source = (key: string): string => {
    switch (key) {
      case "mortgage":
        return month.loan.fha
          ? `${money(month.loan.amount)} at ${input.ratePct.toFixed(2)}%, HUD’s upfront premium included`
          : `${money(month.loan.amount)} at ${input.ratePct.toFixed(2)}%`;
      case "tax":
        return typedTax !== null ? `${money(typedTax)} a year, your figure` : tax ? `${money(tax.value)} a year, MOD-IV, ${tax.asOf}` : "no figure for this place";
      case "insurance":
        return personal.insuranceYear !== undefined
          ? `${money(personal.insuranceYear)} a year, your quote`
          : insurance
            ? `${money(insurance.value)} a year, what owners with a mortgage report · Census survey, ${insurance.asOf}`
            : "no figure for this place";
      case "mi": {
        const line = month.lines.find((l) => l.key === "mi");
        if (month.loan.fha) return `${FHA.rule.source}: ${month.loan.base > FHA.baseLoanThreshold ? "0.75" : "0.55"}% of the loan a year`;
        if (down >= 20) return "none at 20% down";
        if (line?.basis === "reader") return `${input.pmiPct}% of the loan a year, your quote`;
        return `${money(line?.low ?? 0)}–${money(line?.high ?? 0)} a month, ${PMI.rule.source}`;
      }
      case "utilities":
        return utilities
          ? `electricity${utilities.gas !== null ? ", gas" : ""}${utilities.waterYear !== null ? ", water and sewer" : ""} · Census survey, ${utilities.asOf}`
          : "no figure for this place";
      case "upkeep":
        return `${input.upkeepPct}% of the price a year`;
      default:
        return "";
    }
  };

  const views: Record<View, string> = {
    upfront: "Cash needed to buy",
    years: `Over ${input.years} years`,
  };
  const showView = (which: View) => !control || view === which;

  const budgetFit = <QuietDisclosure enabled={quiet} title="Check your monthly budget">
      {control && comparePlaceId !== undefined && <aside className="cost-budget-fit" aria-label="Your budget fit">
        <details open={quiet || undefined}>
          <summary>Your budget{household.income && household.income > 0 ? ` · Owning uses ${Math.round(month.total / (household.income / 12) * 100)}% of your income${partial ? " on included costs" : ""}` : " · Add your income to check"}</summary>
          <div className="budget-inputs">
            <label className="control">Yearly household income before tax<input inputMode="decimal" value={household.income ?? ""} placeholder="e.g. 100000" onChange={(event) => saveHousehold({ ...household, income: parseAmount(event.target.value) ?? undefined })} /></label>
            <label className="control">Cash available for buying<input inputMode="decimal" value={household.cash ?? ""} placeholder="optional" onChange={(event) => saveHousehold({ ...household, cash: parseAmount(event.target.value) ?? undefined })} /></label>
          </div>
          <p>Uses cash paid each month, including principal—not the lower “money gone” figure. The comparison line is 30% of income, not loan approval.</p>
        </details>
        {household.income !== undefined && household.income > 0 && <p>
          {month.total > household.income / 12 * .3
            ? `${money(month.total - household.income / 12 * .3)} a month above the 30% comparison line.`
            : partial ? "Below the 30% line on included costs; the estimate is incomplete." : "Within the 30% monthly comparison line."}
          {partial && ` Missing: ${listed(month.missing)}.`}
          {rentMonth !== null && ` Rent alone uses ${Math.round(rentMonth / (household.income / 12) * 100)}% of your income.`}
        </p>}
        <p>Buying upfront: {money(up.low)}–{money(up.high)} · {cashFit(household.cash, up.low, up.high)}.</p>
        <a href={`/afford?county=all&place=${comparePlaceId}${household.income ? `&income=${household.income}` : ""}`}>Compare typical homes across New Jersey →</a>
        {Object.values(fields).some(Boolean) && <small>Your home’s price, tax and fees stay here; comparisons use each area’s figures.</small>}
        {home.basis === "transactions" && <small>This sale-price scenario is not included in cross-place ownership rankings.</small>}
      </aside>}
      </QuietDisclosure>;

  return (
    <section className="section cost" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <h2 id={`${id}-heading`}>What it costs to own and to rent</h2>
        {control ? (
          <label className="control">
            <span className="control-label">Down payment</span>
            <select value={down} onChange={(event) => setPersonal("downPct", Number(event.target.value))}>
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

      {control && (
        <details className="cost-yours">
          <summary>
            <span className="cost-yours-title">Your numbers</span>
            <span className="cost-yours-hint">
              {own ? "Using your figures" : "Replace any figure with your own — a listing’s price, a quote"}
            </span>
          </summary>
          <div className="cost-yours-body">
            <fieldset>
              <legend>This home <small>stays on this page</small></legend>
              <Field label="Purchase price" value={fields.price} placeholder={money(home.value)} onChange={(t) => setField("price", t)} />
              <Field label="Property tax a year" value={fields.tax} placeholder={tax ? money(tax.value) : "not published"} onChange={(t) => setField("tax", t)} />
              <Field label="HOA or condo fees a month" value={fields.hoa} placeholder="if any" onChange={(t) => setField("hoa", t)} />
              <Field label="Flood insurance a year" value={fields.flood} placeholder="if required" onChange={(t) => setField("flood", t)}>
                <a href={FLOOD_MAP.url} target="_blank" rel="noreferrer">Check FEMA’s flood map</a>
              </Field>
              <Field label="Rent you’d pay instead, a month" value={fields.rent} placeholder={rent ? money(rent.value) : "not published"} onChange={(t) => setField("rent", t)} />
              <Field label="Moving" value={fields.moving} placeholder="optional" onChange={(t) => setField("moving", t)} />
              <Field label="First repairs" value={fields.repairs} placeholder="optional" onChange={(t) => setField("repairs", t)} />
            </fieldset>
            <fieldset>
              <legend>You <small>remembered on every page, in this browser</small></legend>
              <NumberField label="Mortgage rate, %" value={personal.ratePct} placeholder={rate.value.toFixed(2)} onChange={(v) => setPersonal("ratePct", v)} />
              <NumberField label="Homeowners insurance a year" value={personal.insuranceYear} placeholder={insurance ? money(insurance.value) : "your quote"} onChange={(v) => setPersonal("insuranceYear", v)} />
              {!month.loan.fha && down < 20 && (
                <NumberField label="Mortgage insurance, % of loan a year" value={personal.pmiPct} placeholder="your quote" onChange={(v) => setPersonal("pmiPct", v)} />
              )}
              <NumberField label="Upkeep, % of price a year" value={personal.upkeepPct} placeholder={String(UPKEEP_PCT)} onChange={(v) => setPersonal("upkeepPct", v)} />
              <NumberField label="Closing costs, % of price" value={personal.closingPct} placeholder={`${CLOSING.low * 100}–${CLOSING.high * 100}`} onChange={(v) => setPersonal("closingPct", v)} />
              <NumberField label="Years you’d stay" value={personal.years} placeholder={String(DEFAULT_YEARS)} onChange={(v) => setPersonal("years", v)} />
              <NumberField label="Home prices, % a year" value={personal.appreciationPct} placeholder="0, flat" onChange={(v) => setPersonal("appreciationPct", v)} />
              <NumberField label="Rents, % a year" value={personal.rentGrowthPct} placeholder="0, flat" onChange={(v) => setPersonal("rentGrowthPct", v)} />
              <NumberField label="Selling commission, %" value={personal.commissionPct} placeholder={String(COMMISSION_PCT)} onChange={(v) => setPersonal("commissionPct", v)} />
            </fieldset>
            <p className="cost-yours-note">
              What you enter changes this page’s arithmetic only — never this place’s published
              figures or its rankings.{" "}
              {own && (
                <button
                  type="button"
                  className="cost-yours-reset"
                  onClick={() => {
                    savePersonal({});
                    setFields(NO_HOME_FIELDS);
                  }}
                >
                  Use the published figures
                </button>
              )}
            </p>
          </div>
        </details>
      )}

      {!quiet && budgetFit}

      {control && cashComparison && (
        <div className="cost-monthly-headline" role="group" aria-label="Monthly cash comparison">
          <p className="cost-evidence-label">Monthly cash</p>
          <p className="cost-monthly-headline-copy" aria-live="polite">{cashComparison}</p>
        </div>
      )}

      <div className="cost-cards">
        <article className="cost-card">
          <h3 className="cost-card-label">
            <Definition term={terms.own}>
              {typedPrice !== null
                ? `To own at your ${money(typedPrice)} price`
                : home.basis === "index"
                  ? "To own the typical single-family home"
                  : `To own at a ${money(home.value)} purchase price`}
            </Definition>
          </h3>
          {typedPrice === null && home.basis === "transactions" && (
            // The window, on the card rather than only in the definition. A reader who
            // never opens the definition still has to be told that this price is the
            // middle of what sold over a span, not a valuation on a date.
            <p className="cost-basis">
              Based on qualifying residential sales here, {home.from} to {home.to}.
            </p>
          )}
          <p className="cost-figure" aria-live="polite">
            <b>{money(month.total)}</b>
            <span>a month, every cost below</span>
          </p>
          {month.loan.fha && (
            <p className="cost-basis">
              An FHA loan, which HUD caps at a limit set for each county;{" "}
              <a href={FHA_LIMITS.url} target="_blank" rel="noreferrer">
                check the limit here
              </a>
              .
            </p>
          )}
          <p className="cost-estimate-note">
            {partial ? (
              <Definition term={terms.partial}>
                <span className="cost-partial">Partial estimate</span>
              </Definition>
            ) : (
              "Calculated estimate"
            )}{" "}
            · not a lender quote
          </p>
          <div className="gone-kept">
            {quiet ? <CostRibbon parts={parts.map(p=>({key:p.key,value:p.value,color:PART_COLOURS[p.key]}))} principal={kept} label={`Included monthly payment: ${money(month.total)}. ` + parts.map(p=>`${p.label} ${money(p.value)}`).join(", ") + `; principal paid down ${money(kept)}. Band thickness at each end shows its share; missing costs are not included.`} /> : (
            <div
              className="gone-kept-bar"
              role="img"
              aria-label={
                `Of ${money(month.total)}: ` +
                parts.map((p) => `${p.label.toLowerCase()} ${money(p.value)}`).join(", ") +
                `, and ${money(kept)} paid into the home`
              }
            >
              {parts.map((p) => (
                <i key={p.key} style={{ width: share(p.value, month.total), background: PART_COLOURS[p.key] }} />
              ))}
              <i style={{ width: share(kept, month.total), background: "var(--good)" }} />
            </div>
            )}
            {quiet && <p className="quiet-receipt"><span>Money gone <b>{money(month.gone)}</b></span><span>Into the home <b>{money(kept)}</b></span></p>}
            <p className="gone-kept-key" aria-hidden="true">
              {parts.map((p) => (
                <span key={p.key}>
                  <i style={{ background: PART_COLOURS[p.key] }} />
                  {p.label} {money(p.value)}
                </span>
              ))}
              <span className="kept">
                <i style={{ background: "var(--good)" }} />
                Paid into your home {money(kept)}
              </span>
            </p>
          </div>
          <QuietDisclosure enabled={quiet} title="See the owning breakdown" note="The costs, assumptions and sources">
          <dl className="cost-lines">
            <div className="sum">
              <dt>
                <Definition term={terms.gone}>Money gone each month</Definition>
              </dt>
              <dd>{money(month.gone)}</dd>
            </div>
            <div>
              <dt>
                {typedPrice !== null ? "Your purchase price" : home.basis === "index" ? "Typical single-family home" : "Purchase price"}{" "}
                <small className="src">
                  {typedPrice !== null
                    ? "your figure"
                    : home.basis === "index"
                      ? `Zillow, ${home.asOf}`
                      : `NJ SR1A sales, ${home.from} to ${home.to}`}
                </small>
              </dt>
              <dd>{money(input.price)}</dd>
            </div>
            <div>
              <dt>
                Down payment, {down}% <small className="src">money a renter could invest instead</small>
              </dt>
              <dd>{money(month.loan.down)}</dd>
            </div>
            {month.lines.map((line) => (
              <div key={line.key} className={line.value === null ? "missing" : undefined}>
                <dt>
                  {line.label}
                  {line.key === "mortgage" && month.loan.fha ? ", FHA" : ""}{" "}
                  <small className={line.value === null && line.conditional ? "src cost-add-prompt" : "src"}>
                    {line.value === null && line.conditional
                      ? "add yours if it applies"
                      : [source(line.key), line.value !== null && line.key !== "mortgage" ? BASIS_WORDS[line.basis] : ""]
                          .filter(Boolean)
                          .join(" · ")}
                  </small>
                </dt>
                <dd>{line.value === null ? (line.conditional ? "—" : "not included") : `${money(line.value)}/mo`}</dd>
              </div>
            ))}
            <div>
              <dt>
                <Definition term={terms.income}>Income to keep it at 30% of pay</Definition>
              </dt>
              <dd>{money(incomeFor(month.total))} a year</dd>
            </div>
          </dl>
          </QuietDisclosure>
        </article>

        <article className="cost-card">
          <h3 className="cost-card-label">
            <Definition term={terms.rent}>{typedRent !== null ? "To rent at your figure" : "To rent the typical home"}</Definition>
          </h3>
          {rentMonth !== null ? (
            <>
              <p className="cost-figure">
                <b>{money(rentMonth)}</b>
                <span>a month, all of it gone</span>
              </p>
              <QuietDisclosure enabled={quiet} title="See the renting breakdown" note="The rent figure and what it leaves out">
              <dl className="cost-lines">
                <div className="sum">
                  <dt>Money gone each month</dt>
                  <dd>{money(rentMonth)}</dd>
                </div>
                <div>
                  <dt>
                    {typedRent !== null ? "Your rent" : "Typical rent, any kind of rental home"}{" "}
                    <small className="src">{typedRent !== null ? "your figure" : `Zillow, ${rent?.asOf} · mostly apartments`}</small>
                  </dt>
                  <dd>{money(rentMonth)}/mo</dd>
                </div>
                <div>
                  <dt>
                    Utilities on top{" "}
                    <small className="src">
                      {rentersPayUtilities
                        ? `${Math.round(rentersPayUtilities.value * 100)}% of renters here pay at least one · Census survey, ${rentersPayUtilities.asOf}`
                        : "a quoted rent usually leaves them out"}
                    </small>
                  </dt>
                  <dd>not included</dd>
                </div>
                <div>
                  <dt>
                    Renters insurance <small className="src">no published figure</small>
                  </dt>
                  <dd>not included</dd>
                </div>
                <div>
                  <dt>Income to keep it at 30% of pay</dt>
                  <dd>{money(incomeFor(rentMonth))} a year</dd>
                </div>
              </dl>
              </QuietDisclosure>
            </>
          ) : (
            <p className="cost-missing">
              No rent figure for this place: Zillow publishes its rent index for fewer places than
              its home values. Enter one under “Your numbers” to compare.
            </p>
          )}
        </article>
        <aside className="cost-evidence-omissions" aria-label="Costs not included in the monthly owning estimate">
          <p className="cost-evidence-label">
            <span className="cost-evidence-omissions-mark" aria-hidden="true">i</span>
            Not included
          </p>
          <p>
            The monthly owning estimate leaves out {listed([...month.missing, ...month.optional, "what the down payment could earn"])}.
          </p>
        </aside>
      </div>

      {control && (
        <div className="cost-strip cost-evidence">
          {beforeMoving}
          <div className="cost-evidence-grid">
            {rentalCaveat && (
              <div className="cost-evidence-item">
                <p className="cost-evidence-label">Comparison caveat</p>
                <p>{rentalCaveat}</p>
              </div>
            )}
            {history && (
              <div className="cost-evidence-item">
                <ReaderDetails title="Five-year history · not a forecast">
                <p>{history}</p>
                </ReaderDetails>
              </div>
            )}
            {noTax && (
              <div className="cost-evidence-item">
                <p className="cost-evidence-label">Tax caveat</p>
                <p>{noTax}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <QuietToolGroup enabled={quiet}>
      {quiet && budgetFit}
      <QuietDisclosure enabled={quiet} title="Upfront cash & a longer-term scenario">
      <div className="cost-views">
        {control && (
          <div className="cost-view-tabs" role="tablist" aria-label="Other views of the cost">
            {(Object.keys(views) as View[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={view === key ? "on" : undefined}
                onClick={() => setView(key)}
              >
                {views[key]}
              </button>
            ))}
          </div>
        )}

        {showView("upfront") && (
          <div className="cost-view" role={control ? "tabpanel" : undefined}>
            <h3 className="cost-view-title">Cash needed up front</h3>
            <p className="cost-view-figure">
              <b>{up.low === up.high ? money(up.low) : `${money(up.low)}–${money(up.high)}`}</b>
              <span>before the keys</span>
            </p>
            <dl className="cost-lines">
              <div>
                <dt>Down payment, {down}%</dt>
                <dd>{money(up.down)}</dd>
              </div>
              <div>
                <dt>
                  Closing costs{" "}
                  <small className="src">
                    {up.closingBasis === "reader"
                      ? `${input.closingPct}% of the price, your figure`
                      : `${CLOSING.low * 100}–${CLOSING.high * 100}% of the price, ${CLOSING.rule.source}`}
                  </small>
                </dt>
                <dd>{up.closingLow === up.closingHigh ? money(up.closingLow) : `${money(up.closingLow)}–${money(up.closingHigh)}`}</dd>
              </div>
              {month.loan.fha && (
                <div>
                  <dt>
                    FHA upfront premium <small className="src">1.75% of the loan, added to it rather than paid in cash</small>
                  </dt>
                  <dd>{money(month.loan.amount - month.loan.base)}</dd>
                </div>
              )}
              <div className={up.moving === null ? "missing" : undefined}>
                <dt>Moving</dt>
                <dd>{up.moving === null ? "—" : money(up.moving)}</dd>
              </div>
              <div className={up.repairs === null ? "missing" : undefined}>
                <dt>First repairs</dt>
                <dd>{up.repairs === null ? "—" : money(up.repairs)}</dd>
              </div>
            </dl>
            {rentMonth !== null && (
              <p className="cost-view-note">
                To rent instead: the first month and a deposit of up to {money(rentMonth * DEPOSIT_MONTHS)},
                a month and a half’s rent — the most a New Jersey landlord may ask ({DEPOSIT_RULE.source}).
              </p>
            )}
          </div>
        )}

        {showView("years") && (
          <div className="cost-view" role={control ? "tabpanel" : undefined}>
            <h3 className="cost-view-title">Owning for {input.years} years, then selling</h3>
            <p className="cost-view-figure">
              <b>{money(years.net)}</b>
              <span>
                spent over {input.years} years, after what selling gives back
                {years.rent !== null ? ` — against ${money(years.rent)} of rent` : ""}
              </span>
            </p>
            <dl className="cost-lines">
              <div>
                <dt>Cash up front <small className="src">closing costs at the middle of their range unless you set them</small></dt>
                <dd>{money(years.upfront)}</dd>
              </div>
              <div>
                <dt>Paid each month over the years <small className="src">utilities left out, as for rent</small></dt>
                <dd>{money(years.paid)}</dd>
              </div>
              <div>
                <dt>
                  Sale price{" "}
                  <small className="src">
                    {input.appreciationPct === 0 ? "prices flat, as no one can say where they will go" : `${input.appreciationPct}% a year, your assumption`}
                  </small>
                </dt>
                <dd>{money(years.salePrice)}</dd>
              </div>
              <div>
                <dt>
                  Less the loan still owed
                </dt>
                <dd>−{money(years.balance)}</dd>
              </div>
              <div>
                <dt>
                  Less selling costs{" "}
                  <small className="src">{input.commissionPct}% commission, an assumption, and New Jersey’s seller fees ({NJ_TRANSFER_RULE.source})</small>
                </dt>
                <dd>−{money(years.sellingCosts)}</dd>
              </div>
              <div className="sum">
                <dt>What selling gives back</dt>
                <dd>{money(years.equity)}</dd>
              </div>
            </dl>
            <p className="cost-view-note">
              A sum over stated assumptions, not a forecast: tax, insurance, fees and upkeep stay
              at today’s dollars, and prices and rents stay flat unless you set a rate.
              {years.missing.length > 0 ? ` It leaves out ${listed(years.missing).toLowerCase()}.` : ""}
            </p>
          </div>
        )}
      </div>
      </QuietDisclosure>
      {householdTools}
      </QuietToolGroup>

      {showHelp && <HousingHelp />}

      {!control && (
        <div className="cost-strip">
          {cashComparison && (
            <p className="cost-strip-big" aria-live="polite">
              {cashComparison}
            </p>
          )}
          {rentalCaveat && <p className="cost-strip-small">{rentalCaveat}</p>}
          {history && <p className="cost-strip-small">{history}</p>}
          {noTax && <p className="cost-strip-small">{noTax}</p>}
        </div>
      )}
    </section>
  );
}

/** A field for a figure about this home: free text, read as an amount when it is one. */
function Field({
  label,
  value,
  placeholder,
  onChange,
  children,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  children?: ReactNode;
}) {
  return (
    <label className="cost-field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {children && <small>{children}</small>}
    </label>
  );
}

/**
 * A field for one of the reader's own figures. Its text is kept while typing, so "6." is
 * not snapped to "6"; the number reaches the scenario, and storage, once it reads as one.
 */
function NumberField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === undefined ? "" : String(value));
  return (
    <label className="cost-field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        aria-label={label}
        value={shown}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseAmount(e.target.value));
        }}
        onBlur={() => setText(null)}
      />
    </label>
  );
}
