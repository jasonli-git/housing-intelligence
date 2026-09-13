/**
 * "What can I afford here" (Milestone 17): which places' typical home is within reach of
 * an income, owned or rented.
 *
 * Within reach means the typical monthly cost is at most 30% of gross income — HUD's
 * cost-burden line, decided with the owner at the start of the milestone (TODO). Owning
 * is `costToOwn` at the reader's down payment; renting is the observed rent. A place
 * lacking a figure the mode needs is left out rather than guessed: owning without a tax
 * bill would flatter every place in the state with the highest property taxes.
 */

import { BURDEN_SHARE, costToOwn } from "@/lib/cost";

export type Place = {
  id: number;
  name: string;
  level: "county" | "municipality";
  /** What tells a municipality apart in a list — "Township in Morris County". */
  detail: string | null;
  home: number | null;
  tax: number | null;
  rent: number | null;
};

export type Mode = "own" | "rent";

export type Reached = {
  place: Place;
  /** The typical monthly cost in this mode. */
  monthly: number;
  within: boolean;
  /** The monthly cost as a share of monthly gross income. */
  share: number;
};

/** The most a month's housing may cost at this income and stay within reach. */
export function monthlyBudget(income: number): number {
  return (income / 12) * BURDEN_SHARE;
}

/** Every place with the figures the mode needs, cheapest first, each marked within reach or not. */
export function reach(
  places: Place[],
  options: { mode: Mode; income: number; downPct: number; ratePct: number },
): Reached[] {
  const { mode, income, downPct, ratePct } = options;
  const budget = monthlyBudget(income);
  const monthlyIncome = income / 12;
  return places
    .flatMap((place): Reached[] => {
      let monthly: number;
      if (mode === "own") {
        if (place.home === null || place.tax === null) return [];
        monthly = costToOwn({ homeValue: place.home, ratePct, downPct, annualTax: place.tax }).total;
      } else {
        if (place.rent === null) return [];
        monthly = place.rent;
      }
      return [{ place, monthly, within: monthly <= budget, share: monthly / monthlyIncome }];
    })
    .sort((a, b) => a.monthly - b.monthly);
}
