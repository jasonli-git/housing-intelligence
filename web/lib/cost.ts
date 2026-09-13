/**
 * The cost to own, month by month (Milestone 17).
 *
 * Arithmetic on figures the warehouse holds — a typical home value, the national 30-year
 * rate, a typical tax bill — and a down payment the reader chooses. Not a forecast and
 * not a quote: every input is printed beside the result, and what it leaves out is named,
 * because a monthly figure that silently omits something reads as complete.
 */

/** A 30-year fixed loan, the product the FRED rate describes. */
export const LOAN_YEARS = 30;

/** HUD's cost-burden line: housing at more than 30% of gross income is a burden. */
export const BURDEN_SHARE = 0.3;

/** Below this down payment a conventional lender requires mortgage insurance. */
export const NO_PMI_DOWN = 20;

/** The down payments offered, in percent. 20 is the default (TODO, Milestone 17). */
export const DOWN_PAYMENTS = [3.5, 5, 10, 20, 25] as const;
export const DEFAULT_DOWN = 20;

/** The level monthly payment of principal and interest on a fully amortising loan. */
export function monthlyPayment(principal: number, annualRatePct: number, years = LOAN_YEARS): number {
  if (principal <= 0) return 0;
  const months = years * 12;
  const rate = annualRatePct / 100 / 12;
  if (rate === 0) return principal / months;
  return (principal * rate) / (1 - (1 + rate) ** -months);
}

/** The gross yearly income at which a monthly housing cost is exactly 30% of it. */
export function incomeFor(monthly: number): number {
  return (monthly * 12) / BURDEN_SHARE;
}

export type OwnCost = {
  down: number;
  loan: number;
  /** Principal and interest, per month. */
  mortgage: number;
  /** A twelfth of the yearly tax bill, or null where there is no bill to use. */
  tax: number | null;
  total: number;
  incomeNeeded: number;
};

export function costToOwn(input: {
  homeValue: number;
  ratePct: number;
  downPct: number;
  annualTax: number | null;
}): OwnCost {
  const down = (input.homeValue * input.downPct) / 100;
  const loan = input.homeValue - down;
  const mortgage = monthlyPayment(loan, input.ratePct);
  const tax = input.annualTax === null ? null : input.annualTax / 12;
  const total = mortgage + (tax ?? 0);
  return { down, loan, mortgage, tax, total, incomeNeeded: incomeFor(total) };
}

/** What the monthly figure leaves out, in the order a reader would miss them. */
export function leftOut(downPct: number): string[] {
  return [
    ...(downPct < NO_PMI_DOWN ? ["mortgage insurance, which lenders require below 20% down"] : []),
    "homeowners insurance",
    "upkeep",
    "closing costs",
  ];
}
