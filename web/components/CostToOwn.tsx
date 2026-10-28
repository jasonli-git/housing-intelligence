"use client";

import { Gloss } from "@/components/Gloss";
import { type ReactNode, useId, useState } from "react";

import { Glossed } from "@/components/Glossed";
import { Term, type TermEntry } from "@/components/Term";
import { HousingHelp } from "@/components/HousingHelp";
import { coveredState } from "@/lib/states";
import { ReaderDetails } from "@/components/ReaderDetails";
import { DEFAULT_DOWN, DOWN_PAYMENTS, goneAgainstRent, incomeFor } from "@/lib/cost";
import {
  CLOSING,
  COMMISSION_PCT,
  FHA,
  FHA_DOWN,
  FHA_LIMITS,
  FLOOD_MAP,
  PMI,
  rulesFor,
  UPKEEP_PCT,
} from "@/lib/costRules";
import { type Personal, parseAmount } from "@/lib/costScenario";
import { type FhaLimit, fhaCheck, rateScenarios } from "@/lib/financing";
import { formatValue } from "@/lib/format";
import { type Basis, eachMonth, type Inputs, overYears, upFront } from "@/lib/ownership";
import { ownershipInputs, cashFit, DEFAULT_YEARS } from "@/lib/budgetScenario";
import { useBudgetScenario } from "@/components/useBudgetScenario";
import { QuietDisclosure, QuietToolGroup } from "@/components/QuietCounty";
import { StepIcon } from "@/components/StepIcon";
import {DifferenceBridge,sentenceCostLabel} from "@/components/DifferenceBridge";
import { writeGuideTransfer } from "@/lib/guideTransfer";
import { MonthlyBill } from "@/components/MonthlyBill";

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
  /** The place's state: whose seller fees and deposit cap apply (`rulesFor`). */
  state: string;
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
  /** FHA's limit for a one-unit home in this county (Milestone 48), where held. */
  fhaLimit?: FhaLimit | null;
};

function money(value: number): string {
  return formatValue(value, "usd");
}

function listed(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function term(_key: string, title: string, what: string): TermEntry {
  return { title, what };
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
  state,
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
  fhaLimit = null,
  control = true,
  beforeMoving,
  showHelp = true,
  comparePlaceId,
  quiet = false,
  householdTools,
  planning = true,
  guidePlaceId,
  compactOverview = false,
  overviewContext,
}: CostProps & { control?: boolean; beforeMoving?: ReactNode; showHelp?: boolean; comparePlaceId?: number; quiet?: boolean; householdTools?: ReactNode; planning?: boolean; guidePlaceId?: number; compactOverview?: boolean; overviewContext?: ReactNode }) {
  const id = useId();
  const { personal: rememberedPersonal, household, savePersonal, saveHousehold } = useBudgetScenario(control && planning);
  const personal = planning ? rememberedPersonal : {};
  const [fields, setFields] = useState<HomeFields>(NO_HOME_FIELDS);
  const [view, setView] = useState<View>("upfront");
  const [calculationOpen,setCalculationOpen] = useState(false);

  const setPersonal = (key: keyof Personal, value: number | null) => {
    const next = { ...personal };
    if (value === null) delete next[key];
    else next[key] = value;
    savePersonal(next);
  };
  const setField = (key: keyof HomeFields, text: string) => setFields({ ...fields, [key]: text });
  const transferToGuide = () => {
    if (guidePlaceId === undefined) return;
    const home = Object.fromEntries([
      ["price", parseAmount(fields.price)], ["taxYear", parseAmount(fields.tax)], ["hoaMonth", parseAmount(fields.hoa)],
      ["floodYear", parseAmount(fields.flood)], ["movingCost", parseAmount(fields.moving)], ["repairsCost", parseAmount(fields.repairs)],
    ].filter(([,value]) => value !== null));
    writeGuideTransfer(guidePlaceId, home, parseAmount(fields.rent));
  };

  const typedPrice = parseAmount(fields.price);
  const typedTax = parseAmount(fields.tax);
  const typedRent = parseAmount(fields.rent);
  const down = personal.downPct ?? DEFAULT_DOWN;
  const rules = rulesFor(state);
  const stateLabel = coveredState(state)?.name ?? "the state";
  const input: Inputs = ownershipInputs({
    state, price: home.value, ratePct: rate.value, taxYear: tax?.value ?? null,
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
  const baselineMonth = eachMonth(ownershipInputs({ state, price: home.value, ratePct: rate.value,
    taxYear: tax?.value ?? null, insuranceYear: insurance?.value ?? null,
    utilitiesMonth: utilities?.month ?? null, rentMonth: rent?.value ?? null }));
  const years = overYears(input);
  const partial = month.missing.length > 0;
  const fha = fhaCheck(month.loan, fhaLimit);
  const scenarios = rateScenarios(input);
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
  // The rent half is always true; the price half names whatever priced the card. Where
  // Zillow has no home value, sales or the reader's own figure do, and Zillow's home
  // value must not be described beside a card it is not on (TODO, found 2026-09-21).
  const priceKind =
    typedPrice !== null
      ? null
      : home.basis === "index"
        ? " while its home value covers single-family houses only"
        : " while the price here is the middle of recent residential sales";
  const rentalCaveat = rent && (
    <>
      A house usually rents for more than this: Zillow’s rent covers every kind of rental
      home, mostly apartments{priceKind ? `,${priceKind}` : ""}.
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
        ? `The typical home’s value, houses and condos (Zillow Home Value Index, ${home.asOf})`
        : `A purchase at ${money(home.value)} — the middle price of qualifying residential ` +
          `sales here from ${home.from} to ${home.to}, from ${stateLabel}’s SR1A sales file. ` +
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
        `enter them. The tax bill is the area’s median from ${stateLabel}’s assessment records ` +
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
    partial: term(
      "cost-partial",
      "Partial estimate",
      `This total leaves out ${listed(month.missing).toLowerCase()}: no published figure ` +
        (planning ? "covers it for this place. Enter yours under ‘Your numbers’ to complete it." : "covers it for this place. Use the buyer’s guide to enter a quote."),
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

  const owningLedger = (<dl className="cost-lines">
            <div className="sum">
              <dt>
                <Term id="cost-gone">Money gone each month</Term>
              </dt>
              <dd>{money(month.gone)}</dd>
            </div>
            <div>
              <dt>
                {typedPrice !== null ? "Your purchase price" : home.basis === "index" ? "Typical home" : "Purchase price"}{" "}
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
                  <Glossed text={line.label} />
                  {line.key === "mortgage" && month.loan.fha ? ", FHA" : ""}{" "}
                  <small className={line.value === null && line.conditional ? "src cost-add-prompt" : "src"}>
                    {line.value === null && line.conditional
                      ? "add yours if it applies"
                      : <Glossed text={[source(line.key), line.value !== null && line.key !== "mortgage" ? BASIS_WORDS[line.basis] : ""]
                          .filter(Boolean)
                          .join(" · ")} />}
                  </small>
                </dt>
                <dd>{line.value === null ? (line.conditional ? "—" : "not included") : `${money(line.value)}/mo`}</dd>
              </div>
            ))}
            <div>
              <dt>
                <Term id="cost-income">Income to keep it at 30% of pay</Term>
              </dt>
              <dd>{money(incomeFor(month.total))} a year</dd>
            </div>
          </dl>);
  const rentingLedger = rentMonth !== null ? (<dl className="cost-lines">
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
              </dl>) : null;
  const calculationToggle = <button type="button" className="calculation-toggle" aria-expanded={calculationOpen} aria-controls={id+"-calculation"} onClick={()=>setCalculationOpen(o=>!o)}>
    <span className="calculation-toggle-label"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8v4H8zM8 14h2m4 0h2m-8 4h2m4 0h2"/></svg>{calculationOpen ? "Hide the breakdown" : "See the breakdown"}</span>
    <svg className="calculation-chevron" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 8 5 5 5-5"/></svg>
  </button>;

  const downControl = <label className="control">
            <span className="control-label">Down payment</span>
            <select aria-label="Down payment" value={down} onChange={(event) => setPersonal("downPct", Number(event.target.value))}>
              {DOWN_PAYMENTS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}%
                </option>
              ))}
            </select>
          </label>;

  const budgetFit = control ? <QuietDisclosure enabled={false} title="Check your monthly budget">
      <aside className="cost-budget-fit" aria-label="Your budget fit">
        <div className="budget-basics">
          <h4>Your budget{household.income && household.income > 0 ? ` · Owning uses ${Math.round(month.total / (household.income / 12) * 100)}% of your income${partial ? " on included costs" : ""}` : " · Add your income to check"}</h4>
          <div className="budget-inputs">
            {compactOverview && downControl}
            <label className="control"><span>Yearly household income before tax</span><input inputMode="decimal" value={household.income ?? ""} placeholder="e.g. 100000" onChange={(event) => saveHousehold({ ...household, income: parseAmount(event.target.value) ?? undefined })} /></label>
            <label className="control"><span>Cash available for buying</span><input inputMode="decimal" value={household.cash ?? ""} placeholder="optional" onChange={(event) => saveHousehold({ ...household, cash: parseAmount(event.target.value) ?? undefined })} /></label>
            {quiet && <Field label="Rent you’d pay instead, a month" value={fields.rent} placeholder={rent ? money(rent.value) : "not published"} onChange={(t) => setField("rent", t)} />}
          </div>
          <p>Uses cash paid each month, including principal—not the lower “money gone” figure. The comparison line is 30% of income, not loan approval.</p>
        </div>
        {household.income !== undefined && household.income > 0 && <p>
          {month.total > household.income / 12 * .3
            ? `${money(month.total - household.income / 12 * .3)} a month above the 30% comparison line.`
            : partial ? "Below the 30% line on included costs; the estimate is incomplete." : "Within the 30% monthly comparison line."}
          {partial && ` Missing: ${listed(month.missing)}.`}
          {rentMonth !== null && ` Rent alone uses ${Math.round(rentMonth / (household.income / 12) * 100)}% of your income.`}
        </p>}
        <p>Buying upfront: {money(up.low)}–{money(up.high)} · {cashFit(household.cash, up.low, up.high)}.</p>
        {comparePlaceId !== undefined && <a href={`/afford?county=all&place=${comparePlaceId}${household.income ? `&income=${household.income}` : ""}`}>Compare typical homes across {stateLabel} →</a>}
        {Object.values(fields).some(Boolean) && <small>Your home’s price, tax and fees stay here; comparisons use each area’s figures.</small>}
        {home.basis === "transactions" && <small>This sale-price scenario is not included in cross-place ownership rankings.</small>}
      </aside>
      </QuietDisclosure> : null;

  const monthlyComparison = control && cashComparison ? <div className="cost-monthly-headline" role="group" aria-label={compactOverview ? "Ownership cost after principal" : "Monthly cash comparison"}>
    <p className="cost-evidence-label">{compactOverview ? "After principal builds equity" : "Monthly cash"}</p>
    {compactOverview && <p className="calculation-note">A secondary comparison: principal reduces your loan balance but still leaves your bank account. This is not the cash needed each month.</p>}
    {quiet && rentMonth !== null && against ? <DifferenceBridge own={goneNoUtilities} rent={rentMonth} principal={kept} kind={against.kind} gap={against.gap} missing={missingBeyondUtilities}/> : <p className="cost-monthly-headline-copy" aria-live="polite">{cashComparison}</p>}
  </div> : null;

  const fineTune = control && planning && (
        <details className="cost-yours">
          <summary>
            <span className="cost-yours-title">{compactOverview ? "More assumptions" : "Fine-tune the costs"}</span>
            {!compactOverview && <span className="cost-yours-hint">
              {own ? "Using your figures" : "Replace any figure with your own — a listing’s price, a quote"}
            </span>}
          </summary>
          <div className="cost-yours-body">
            {!compactOverview && <MonthlyBill current={month} baseline={baselineMonth} />}
            <fieldset>
              <legend>This home <small>stays on this page</small></legend>
              {!compactOverview && <Field label="Purchase price" value={fields.price} placeholder={money(home.value)} onChange={(t) => setField("price", t)} />}
              <Field label="Property tax a year" value={fields.tax} placeholder={tax ? money(tax.value) : "not published"} onChange={(t) => setField("tax", t)} />
              <Field label="HOA or condo fees a month" value={fields.hoa} placeholder="if any" onChange={(t) => setField("hoa", t)} />
              <Field label="Flood insurance a year" value={fields.flood} placeholder="if required" onChange={(t) => setField("flood", t)}>
                <a href={FLOOD_MAP.url} target="_blank" rel="noreferrer">Check FEMA’s flood map</a>
              </Field>
              {!quiet && <Field label="Rent you’d pay instead, a month" value={fields.rent} placeholder={rent ? money(rent.value) : "not published"} onChange={(t) => setField("rent", t)} />}
              {!compactOverview && <><Field label="Moving" value={fields.moving} placeholder="optional" onChange={(t) => setField("moving", t)} />
              <Field label="First repairs" value={fields.repairs} placeholder="optional" onChange={(t) => setField("repairs", t)} /></>}
            </fieldset>
            <fieldset>
              <legend>You <small>remembered on every page, in this browser</small></legend>
              <NumberField label="Mortgage rate, %" value={personal.ratePct} placeholder={rate.value.toFixed(2)} onChange={(v) => setPersonal("ratePct", v)} />
              <NumberField label="Homeowners insurance a year" value={personal.insuranceYear} placeholder={insurance ? money(insurance.value) : "your quote"} onChange={(v) => setPersonal("insuranceYear", v)} />
              {!month.loan.fha && down < 20 && (
                <NumberField label="Mortgage insurance, % of loan a year" value={personal.pmiPct} placeholder="your quote" onChange={(v) => setPersonal("pmiPct", v)} />
              )}
              <NumberField label="Upkeep, % of price a year" value={personal.upkeepPct} placeholder={String(UPKEEP_PCT)} onChange={(v) => setPersonal("upkeepPct", v)} />
              {!compactOverview && <><NumberField label="Closing costs, % of price" value={personal.closingPct} placeholder={`${CLOSING.low * 100}–${CLOSING.high * 100}`} onChange={(v) => setPersonal("closingPct", v)} />
              <NumberField label="Years you’d stay" value={personal.years} placeholder={String(DEFAULT_YEARS)} onChange={(v) => setPersonal("years", v)} />
              <NumberField label="Home prices, % a year" value={personal.appreciationPct} placeholder="0, flat" onChange={(v) => setPersonal("appreciationPct", v)} />
              <NumberField label="Rents, % a year" value={personal.rentGrowthPct} placeholder="0, flat" onChange={(v) => setPersonal("rentGrowthPct", v)} />
              <NumberField label="Selling commission, %" value={personal.commissionPct} placeholder={String(COMMISSION_PCT)} onChange={(v) => setPersonal("commissionPct", v)} /></>}
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
      );

  const ownershipBreakdown = <>
          {/* Stated assumptions, not a forecast of rates (#327). */}
          <ReaderDetails title="At other mortgage rates" className="mortgage-rate-details">
            <table className="change-places rate-scenarios">
              <caption className="visually-hidden">The month at other mortgage rates, everything else as above</caption>
              <thead>
                <tr>
                  <th scope="col">Rate</th>
                  <th scope="col" className="num">Principal and interest</th>
                  <th scope="col" className="num">The month</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((row) => (
                  <tr key={row.ratePct}>
                    <th scope="row">{row.ratePct}%</th>
                    <td className="num">{money(row.mortgage)}</td>
                    <td className="num">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sales-note">
              The same home, down payment and costs at each rate. Assumptions to compare, not a
              forecast of where rates go.
            </p>
          </ReaderDetails>
          <div className="gone-kept">
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
  </>;

  return (
    <section className={`section cost${compactOverview ? " place-cost-overview" : ""}`} aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <h2 id={`${id}-heading`}>{compactOverview ? "Monthly housing costs" : "What it costs to own and to rent"}</h2>
        {control && !compactOverview ? downControl : <span className="control-label">{down}% down payment</span>}
      </div>

      {compactOverview && <p className="cost-overview-meta">Published starting figures: {home.basis === "index" ? "home value" : "sale-price median"} {home.asOf}{rent && ` · rent ${rent.asOf}`} · mortgage benchmark {rate.asOf}. Your inputs adjust the estimates below.</p>}

      {!compactOverview && fineTune}

      {!quiet && budgetFit}

      {!compactOverview && monthlyComparison}

      <div className="cost-cards">
        {compactOverview && control && planning && <details className="cost-use-numbers" role="group" aria-label="Use your numbers">
          <summary>Use your numbers <span>{own ? "Using your figures" : "Adjust the estimate"}</span></summary>
          <div className="cost-use-numbers-body">
          <div className="budget-inputs">
            <label className="control"><span>Yearly household income before tax</span><input inputMode="decimal" value={household.income ?? ""} placeholder="e.g. 100000" onChange={event=>saveHousehold({...household,income:parseAmount(event.target.value)??undefined})}/></label>
            {downControl}
            <Field label="Purchase price" value={fields.price} placeholder={money(home.value)} onChange={t=>setField("price",t)}/>
          </div>
          <p className="cost-budget-result" aria-live="polite">{household.income && household.income>0 ? `Estimated payment uses ${Math.round(month.total/(household.income/12)*100)}% of your income before tax.` : "Add your income to compare it with the payment above."}{partial && ` Included costs only; missing: ${listed(month.missing)}.`}</p>
          {fineTune}
          <nav className="cost-planning-links" aria-label="Plan beyond this estimate">
            {guidePlaceId!==undefined && <a href={`/guide?place=${guidePlaceId}`} onClick={transferToGuide}>Check upfront cash & rent vs. buy →</a>}
            {comparePlaceId!==undefined && <a href={`/afford?county=all&place=${comparePlaceId}${household.income ? `&income=${household.income}`:""}`}>Find your fit →</a>}
          </nav>
          </div>
        </details>}
        <article className="cost-card">
          <h3 className="cost-card-label">
            <Term entry={terms.own}>
              {typedPrice !== null
                ? `To own at your ${money(typedPrice)} price`
                : home.basis === "index"
                  ? "To own the typical home"
                  : `To own at a ${money(home.value)} purchase price`}
            </Term>
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
            <b key={compactOverview ? month.total : undefined} className={compactOverview ? "cost-updated-value" : undefined}>{money(month.total)}</b>
            <span>{compactOverview ? "estimated cash paid each month, including principal" : quiet ? <Glossed text="a month, including principal" /> : "a month, every cost below"}</span>
          </p>
          {month.loan.fha && (
            <p className="cost-basis">
              {fha ? (
                fha.over ? (
                  <>
                    <b>Over FHA’s limit.</b> This loan of {money(fha.base)} is more than the{" "}
                    {money(fha.limit)} HUD insures on a one-unit home in this county in {fha.year},
                    so it would not be an FHA loan; a conventional loan at 3.5% down is priced
                    differently.{" "}
                  </>
                ) : (
                  <>
                    An FHA loan, within the {money(fha.limit)} HUD insures on a one-unit home in
                    this county in {fha.year}.{" "}
                  </>
                )
              ) : (
                <>An FHA loan, which HUD caps at a limit set for each county; </>
              )}
              <a href={FHA_LIMITS.url} target="_blank" rel="noreferrer">
                {fha ? "HUD’s limits" : "check the limit here"}
              </a>
              .
            </p>
          )}
          <p className="cost-estimate-note">
            {partial ? (
              <Term entry={terms.partial}>
                <span className="cost-partial">Partial estimate</span>
              </Term>
            ) : (
              "Calculated estimate"
            )}{" "}
            · not a lender quote
          </p>
          {!compactOverview && ownershipBreakdown}
          {!quiet && owningLedger}
        </article>

        <article className="cost-card">
          <h3 className="cost-card-label">
            <Term entry={terms.rent}>{typedRent !== null ? "To rent at your figure" : "To rent the typical home"}</Term>
          </h3>
          {rentMonth !== null ? (
            <>
              <p className="cost-figure">
                <b>{money(rentMonth)}</b>
                <span>a month, all of it gone</span>
              </p>
              {!quiet && rentingLedger}
            </>
          ) : (
            <p className="cost-missing">
              No rent figure for this place: Zillow publishes its rent index for fewer places than
              its home values. {planning ? "Enter one under ‘Your numbers’ to compare." : "Use the buyer’s guide to compare a rent you enter."}
            </p>
          )}
        </article>
        {compactOverview && <div className="cost-ownership-breakdown"><h4>Where the ownership payment goes</h4>{ownershipBreakdown}</div>}
        {quiet && <>
          {calculationToggle}
          <section id={id+"-calculation"} className="shared-calculation" hidden={!calculationOpen} aria-label="Owning and renting calculation">
            {compactOverview && monthlyComparison}
            <div><h4>Owning</h4><p className="calculation-note">Cash payment includes principal and included utilities. Money spent includes utilities here; the bridge excludes them.</p>{owningLedger}</div>
            <div><h4>Renting</h4>{rentingLedger ?? <p>No rent figure. {planning ? "Enter one under ‘Your numbers’ to compare." : "Enter your rent in the buyer’s guide to compare."}</p>}</div>
          </section>
        </>}
        <aside className="cost-evidence-omissions" aria-label="Costs not included in the monthly owning estimate">
          <p className="cost-evidence-label">
            <span className="cost-evidence-omissions-mark" aria-hidden="true">i</span>
            Not included
          </p>
          <p>
            <Glossed text={`The monthly owning estimate leaves out ${listed([...month.missing, ...month.optional, "what the down payment could earn"].map(sentenceCostLabel))}.`} />
          </p>
        </aside>

      </div>


      {compactOverview && overviewContext && <div className="place-overview-context">{overviewContext}</div>}

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

      {planning && !compactOverview && <QuietToolGroup enabled={quiet}>
      {quiet && budgetFit}
      {compactOverview && fineTune}
      <div className={quiet ? "planning-preview-grid" : undefined}>
      <QuietDisclosure enabled={quiet} title={`Upfront cash & the next ${input.years} years`} icon={<StepIcon name="tax" />} preview={`${money(up.low)}–${money(up.high)} upfront · estimate`} note="Cash at closing—and what owning could cost over time.">
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
            {rentMonth !== null && rules && (
              <p className="cost-view-note">
                To rent instead: the first month and a deposit of up to {money(rentMonth * rules.depositMonths)},
                a month and a half’s rent — the most a {rules.name} landlord may ask ({rules.depositRule.source}).
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
                <dt>Cash up front <small className="src"><Gloss>closing costs at the middle of their range unless you set them</Gloss></small></dt>
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
                  <small className="src">{input.commissionPct}% commission, an assumption, {rules ? <>{`and ${rules.name}’s seller fees (`}{rules.transferRule.source})</> : "and no state seller fees: none are held for this state"}</small>
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
      </div>
      {guidePlaceId !== undefined && <p className="household-next"><a href={`/guide?place=${guidePlaceId}`} onClick={() => {
        const home = Object.fromEntries([
          ["price", typedPrice], ["taxYear", typedTax], ["hoaMonth", parseAmount(fields.hoa)],
          ["floodYear", parseAmount(fields.flood)], ["movingCost", parseAmount(fields.moving)], ["repairsCost", parseAmount(fields.repairs)],
        ].filter(([,value]) => value !== null));
        writeGuideTransfer(guidePlaceId, home, typedRent);
      }}>Continue in the buyer’s guide →</a><span>Bring these home figures into a complete buying plan.</span></p>}
      </QuietToolGroup>}

      {showHelp && <HousingHelp state={state} />}

      {!control && planning && (
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
