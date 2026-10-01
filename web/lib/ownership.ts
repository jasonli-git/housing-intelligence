/**
 * The full cost of owning (Milestone 33): four views in place of one total.
 *
 * - **Each month**: the cash a month of owning takes, every component in it.
 * - **Up front**: the cash needed before the keys, as a range where closing costs are.
 * - **Money gone**: a month's cost that does not come back — all of it but principal,
 *   which pays the loan down and stays the owner's.
 * - **Over the years**: owning for a holding period and then selling, against renting
 *   for the same years, with home prices and rents flat unless the reader sets a rate.
 *
 * Arithmetic only. Each input says where it came from — a source, a published rule, a
 * stated rule of thumb, the reader — and a component nobody could supply is `null`, never
 * zero, so a total missing one says it is a partial estimate. Two components apply only
 * to some homes, HOA or condo fees and flood insurance; left empty, they are listed as
 * "add if it applies" rather than making every total partial.
 */

import { CLOSING, FHA, FHA_DOWN, njSellerFees, PMI } from "@/lib/costRules";
import { monthlyPayment } from "@/lib/cost";

/** Where an input came from, shown beside it. */
export type Basis = "source" | "rule" | "thumb" | "range" | "reader" | "loan";

export type Inputs = {
  price: number;
  downPct: number;
  ratePct: number;
  /** Yearly. Null when no figure exists and the reader has not entered one. */
  taxYear: number | null;
  insuranceYear: number | null;
  utilitiesMonth: number | null;
  /** Conditional: apply to some homes only. */
  hoaMonth: number | null;
  floodYear: number | null;
  /** The reader's mortgage insurance quote, % of the loan a year; null uses the rule. */
  pmiPct: number | null;
  /** Upkeep, % of the price a year. */
  upkeepPct: number;
  /** The reader's closing costs, % of the price; null uses the CFPB's range. */
  closingPct: number | null;
  movingCost: number | null;
  repairsCost: number | null;
  years: number;
  /** Home prices and rents, % a year: 0 unless the reader sets them. */
  appreciationPct: number;
  rentGrowthPct: number;
  commissionPct: number;
  rentMonth: number | null;
};

export type Line = {
  key: string;
  label: string;
  /** Per month. Null when nobody could supply it. */
  value: number | null;
  basis: Basis;
  /** Applies to some homes only: missing it does not make a total partial. */
  conditional?: boolean;
  /** For a figure taken from a range: its ends. */
  low?: number;
  high?: number;
};

export type Loan = {
  fha: boolean;
  down: number;
  /** Price less the down payment. */
  base: number;
  /** What is borrowed: the base, plus FHA's upfront premium financed into it. */
  amount: number;
  payment: number;
};

export function loanFor(input: Pick<Inputs, "price" | "downPct" | "ratePct">): Loan {
  const fha = input.downPct === FHA_DOWN;
  const down = (input.price * input.downPct) / 100;
  const base = Math.max(0, input.price - down);
  const amount = fha ? base * (1 + FHA.upfront) : base;
  return { fha, down, base, amount, payment: monthlyPayment(amount, input.ratePct) };
}

/** Mortgage insurance a month, with the range it was taken from where it was. */
export function mortgageInsurance(input: Inputs, loan: Loan): Line {
  const label = loan.fha ? "FHA mortgage insurance" : "Mortgage insurance";
  if (loan.fha) {
    const annual = loan.base > FHA.baseLoanThreshold ? FHA.annualAbove : FHA.annualAtOrBelow;
    return { key: "mi", label, value: (loan.base * annual) / 12, basis: "rule" };
  }
  if (input.downPct >= 20) return { key: "mi", label, value: 0, basis: "rule" };
  if (input.pmiPct !== null) {
    return { key: "mi", label, value: (loan.amount * input.pmiPct) / 100 / 12, basis: "reader" };
  }
  const low = (loan.amount / 100_000) * PMI.lowPerHundredK;
  const high = (loan.amount / 100_000) * PMI.highPerHundredK;
  return { key: "mi", label, value: (low + high) / 2, basis: "range", low, high };
}

export type Month = {
  loan: Loan;
  lines: Line[];
  total: number;
  /** The first month's interest and principal. */
  interest: number;
  principal: number;
  /** Everything but principal. */
  gone: number;
  /** Lines nobody could supply that apply to every home. */
  missing: string[];
  /** Conditional lines left empty: "add if it applies". */
  optional: string[];
};

/** A month of owning, every component in it. */
export function eachMonth(input: Inputs, bases: Partial<Record<string, Basis>> = {}): Month {
  const loan = loanFor(input);
  const interest = loan.amount > 0 ? (loan.amount * input.ratePct) / 100 / 12 : 0;
  const principal = loan.payment - interest;
  const twelfth = (yearly: number | null) => (yearly === null ? null : yearly / 12);
  const lines: Line[] = [
    { key: "mortgage", label: "Mortgage, principal and interest", value: loan.payment, basis: "loan" },
    { key: "tax", label: "Property tax", value: twelfth(input.taxYear), basis: bases.tax ?? "source" },
    {
      key: "insurance",
      label: "Homeowners insurance",
      value: twelfth(input.insuranceYear),
      basis: bases.insurance ?? "source",
    },
    mortgageInsurance(input, loan),
    {
      key: "utilities",
      label: "Utilities",
      value: input.utilitiesMonth,
      basis: bases.utilities ?? "source",
    },
    {
      key: "upkeep",
      label: "Upkeep",
      value: (input.price * input.upkeepPct) / 100 / 12,
      basis: bases.upkeep ?? "thumb",
    },
    { key: "hoa", label: "HOA or condo fees", value: input.hoaMonth, basis: "reader", conditional: true },
    {
      key: "flood",
      label: "Flood insurance",
      value: twelfth(input.floodYear),
      basis: "reader",
      conditional: true,
    },
  ];
  const total = lines.reduce((sum, line) => sum + (line.value ?? 0), 0);
  return {
    loan,
    lines,
    total,
    interest,
    principal,
    gone: total - principal,
    missing: lines.filter((l) => l.value === null && !l.conditional).map((l) => l.label),
    optional: lines.filter((l) => l.value === null && l.conditional).map((l) => l.label),
  };
}

export type Upfront = {
  down: number;
  closingLow: number;
  closingHigh: number;
  closingBasis: Basis;
  moving: number | null;
  repairs: number | null;
  low: number;
  high: number;
};

/** The cash needed before the keys: a range wherever closing costs are the CFPB's. */
export function upFront(input: Inputs): Upfront {
  const loan = loanFor(input);
  const [closingLow, closingHigh] =
    input.closingPct === null
      ? [input.price * CLOSING.low, input.price * CLOSING.high]
      : [(input.price * input.closingPct) / 100, (input.price * input.closingPct) / 100];
  const extras = (input.movingCost ?? 0) + (input.repairsCost ?? 0);
  return {
    down: loan.down,
    closingLow,
    closingHigh,
    closingBasis: input.closingPct === null ? "range" : "reader",
    moving: input.movingCost,
    repairs: input.repairsCost,
    low: loan.down + closingLow + extras,
    high: loan.down + closingHigh + extras,
  };
}

/**
 * Conventional mortgage insurance ends once the loan falls to 78% of the price paid —
 * the Homeowners Protection Act's automatic termination, on the original value. FHA's
 * runs for the life of a loan made with under 10% down.
 */
export const PMI_ENDS_AT = 0.78;

export type Years = {
  years: number;
  /** Everything paid each month over the years, utilities left out. */
  paid: number;
  upfront: number;
  salePrice: number;
  sellingCosts: number;
  balance: number;
  /** What selling leaves: the price, less the loan and the costs of selling. */
  equity: number;
  /** Owning's cost over the years: cash in, less what selling gives back. */
  net: number;
  rent: number | null;
  /** Lines nobody could supply, which the totals leave out. */
  missing: string[];
};

/**
 * Owning for `years` and then selling, against renting for the same years — both with
 * utilities left out, which a home and a rental both pay, in amounts this page cannot
 * set side by side. Closing costs are the middle of their range unless the reader set
 * them. Taxes, insurance, fees and upkeep stay flat in dollars; so do prices and rents,
 * unless the reader sets a rate. Not a forecast: a sum over stated assumptions.
 */
export function overYears(input: Inputs): Years {
  const month = eachMonth(input);
  const loan = month.loan;
  const months = Math.max(0, Math.round(input.years * 12));
  const rate = input.ratePct / 100 / 12;
  const mi = month.lines.find((l) => l.key === "mi")?.value ?? 0;
  const fixed = month.lines
    .filter((l) => !["mortgage", "mi", "utilities"].includes(l.key))
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  let balance = loan.amount;
  let paid = 0;
  for (let m = 0; m < months; m += 1) {
    const insured = loan.fha || balance > PMI_ENDS_AT * input.price;
    paid += loan.payment + fixed + (insured ? mi : 0);
    balance -= loan.payment - balance * rate;
  }
  balance = Math.max(0, balance);

  const up = upFront(input);
  const upfront = up.down + (up.closingLow + up.closingHigh) / 2 + (up.moving ?? 0) + (up.repairs ?? 0);
  const salePrice = input.price * (1 + input.appreciationPct / 100) ** input.years;
  const sellingCosts = (salePrice * input.commissionPct) / 100 + njSellerFees(salePrice);
  const equity = salePrice - balance - sellingCosts;

  let rent: number | null = null;
  if (input.rentMonth !== null) {
    rent = 0;
    for (let m = 0; m < months; m += 1) {
      rent += input.rentMonth * (1 + input.rentGrowthPct / 100) ** Math.floor(m / 12);
    }
  }
  return {
    years: input.years,
    paid,
    upfront,
    salePrice,
    sellingCosts,
    balance,
    equity,
    net: upfront + paid - equity,
    rent,
    missing: month.missing.filter((label) => label !== "Utilities"),
  };
}

