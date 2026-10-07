/**
 * Two financing views on the cost-of-owning card (Milestone 48, ARCHITECTURE #326-#327).
 *
 * - FHA's county limit: HUD insures an FHA loan only up to a limit set for each county
 *   each year, on the loan before its upfront premium. A 3.5%-down card in a dear town can
 *   otherwise price a loan HUD would not insure.
 * - Rate scenarios: the same home at 5%, 6%, 7% and 8%, each a stated assumption rather
 *   than a forecast (promoted from the owner's Director Note of the roadmap review,
 *   2026-10-07).
 */

import { eachMonth, type Inputs, type Loan } from "@/lib/ownership";

export type FhaLimit = { value: number; year: number };

export type FhaCheck = { limit: number; year: number; base: number; over: boolean };

/** Whether an FHA loan is within its county's limit; null when it is not FHA or no limit is held. */
export function fhaCheck(loan: Loan, limit: FhaLimit | null): FhaCheck | null {
  if (!loan.fha || !limit) return null;
  return { limit: limit.value, year: limit.year, base: loan.base, over: loan.base > limit.value };
}

export const SCENARIO_RATES = [5, 6, 7, 8] as const;

export type RateScenario = { ratePct: number; mortgage: number; total: number };

/** The month at each scenario rate, every other input as entered. */
export function rateScenarios(input: Inputs): RateScenario[] {
  return SCENARIO_RATES.map((ratePct) => {
    const month = eachMonth({ ...input, ratePct });
    return { ratePct, mortgage: month.loan.payment, total: month.total };
  });
}
