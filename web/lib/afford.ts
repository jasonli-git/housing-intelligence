/**
 * "What can I afford here" (Milestone 17): which places' typical home is within reach of
 * an income, owned or rented.
 *
 * Within reach means the typical monthly cost is at most 30% of gross income — HUD's
 * cost-burden line, decided with the owner at the start of the milestone (TODO). Owning
 * uses the profile's full ownership calculation and shared assumptions; renting is observed rent only. A place
 * lacking a figure the mode needs is left out rather than guessed: owning without a tax
 * bill would flatter every place in the state with the highest property taxes. Other
 * required missing costs remain visible as incomplete, never marked within budget.
 */

import { BURDEN_SHARE } from "@/lib/cost";
import { eachMonth, upFront } from "./ownership";
import { ownershipInputs } from "./budgetScenario";
import type { Personal } from "./costScenario";

export type Place = {
  id: number;
  name: string;
  level: "county" | "municipality";
  /** County containing this place; null on the county rows themselves. */
  parentId?: number | null;
  /** What tells a municipality apart in a list — "Township in Morris County". */
  detail: string | null;
  home: number | null;
  tax: number | null;
  rent: number | null;
  insurance?: number | null;
  utilities?: number | null;
};

export type Mode = "own" | "rent";

export type Reached = {
  place: Place;
  /** The typical monthly cost in this mode. */
  monthly: number;
  within: boolean;
  /** The monthly cost as a share of monthly gross income. */
  share: number;
  missing: string[];
  upfront: { low: number; high: number } | null;
};

/** The most a month's housing may cost at this income and stay within reach. */
export function monthlyBudget(income: number): number {
  return (income / 12) * BURDEN_SHARE;
}

/** Every place with the figures the mode needs, cheapest first, each marked within reach or not. */
export function reach(
  places: Place[],
  options: { mode: Mode; income: number; downPct: number; ratePct: number; personal?: Personal },
): Reached[] {
  const { mode, income, downPct, ratePct } = options;
  const budget = monthlyBudget(income);
  const monthlyIncome = income / 12;
  return places
    .flatMap((place): Reached[] => {
      let monthly: number;
      let missing: string[] = [];
      let upfront: Reached["upfront"] = null;
      if (mode === "own") {
        if (place.home === null || place.tax === null) return [];
        const input = ownershipInputs({ price: place.home, ratePct, taxYear: place.tax,
          insuranceYear: place.insurance ?? null, utilitiesMonth: place.utilities ?? null, rentMonth: place.rent,
        }, { ...options.personal, downPct });
        const month = eachMonth(input);
        monthly = month.total;
        missing = month.missing;
        upfront = upFront(input);
      } else {
        if (place.rent === null) return [];
        monthly = place.rent;
      }
      return [{ place, monthly, within: monthly <= budget && missing.length === 0, share: monthly / monthlyIncome, missing, upfront }];
    })
    .sort((a, b) => a.monthly - b.monthly);
}

/**
 * One place, owned and rented, at one income (Milestone 23's "can I afford this place?").
 * Either side is null where the place lacks a figure that side needs, by `reach`'s rule.
 */
export function checkPlace(
  place: Place,
  options: { income: number; downPct: number; ratePct: number; personal?: Personal },
): { own: Reached | null; rent: Reached | null } {
  const [own] = reach([place], { ...options, mode: "own" });
  const [rent] = reach([place], { ...options, mode: "rent" });
  return { own: own ?? null, rent: rent ?? null };
}
