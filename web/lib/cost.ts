/**
 * The cost to own, month by month (Milestone 17).
 *
 * Arithmetic on figures the warehouse holds — a typical home value, the national 30-year
 * rate, a typical tax bill — and a down payment the reader chooses. Not a forecast and
 * not a quote: every input is printed beside the result, and what it leaves out is named,
 * because a monthly figure that silently omits something reads as complete.
 *
 * Since Milestone 23 the payment is also split into money gone — interest and tax — and
 * money kept, the principal that pays the loan down and stays the owner's as equity, and
 * rent is set against money gone: counting the whole payment as cost made owning look
 * dearer than renting by the part of it a buyer keeps (the owner's review, TODO).
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
  /** The first month's interest: paid to the lender, and gone. */
  interest: number;
  /** The first month's principal: the loan paid down, kept as equity in the home. */
  principal: number;
  /** A twelfth of the yearly tax bill, or null where there is no bill to use. */
  tax: number | null;
  total: number;
  /** What a month of owning costs and does not come back: interest and tax. */
  gone: number;
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
  // The first month's split. Interest is at its highest then, and each later payment puts
  // a little more into principal, so this is the most a month of owning loses rather than
  // the average over the loan.
  const interest = loan > 0 ? (loan * input.ratePct) / 100 / 12 : 0;
  const principal = mortgage - interest;
  const gone = interest + (tax ?? 0);
  return { down, loan, mortgage, interest, principal, tax, total, gone, incomeNeeded: incomeFor(total) };
}

/** What the monthly figure leaves out, in the order a reader would miss them. */
export function leftOut(downPct: number): string[] {
  return [
    ...(downPct < NO_PMI_DOWN ? ["mortgage insurance, which lenders require below 20% down"] : []),
    "homeowners insurance",
    "upkeep",
    "closing costs",
    "what the down payment could earn",
  ];
}

/**
 * Within this share of the rent, owning's money gone and the rent read as about the same:
 * both are typical figures from different indexes, and a gap of a few percent between them
 * is inside what either could be off by.
 */
export const ABOUT_THE_SAME = 0.05;

export type Against = { kind: "about" | "more" | "less"; gap: number };

/** Owning's money gone against a month's rent; `gap` is money gone less the rent. */
export function goneAgainstRent(gone: number, rent: number): Against {
  const gap = gone - rent;
  if (Math.abs(gap) <= rent * ABOUT_THE_SAME) return { kind: "about", gap };
  return { kind: gap > 0 ? "more" : "less", gap };
}

/** Whole months from one period end to another: Jul 2021 to Jul 2026 is 60. */
export function monthsBetween(start: string, end: string): number {
  return (
    (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
    (Number(end.slice(5, 7)) - Number(start.slice(5, 7)))
  );
}

/** A change in value spread evenly over the months it took: what the past gave, not a forecast. */
export function changePerMonth(start: number, end: number, months: number): number {
  return months > 0 ? (end - start) / months : 0;
}
