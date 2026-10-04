import { DEFAULT_DOWN } from "./cost";
import { COMMISSION_PCT, UPKEEP_PCT } from "./costRules";
import type { Personal } from "./costScenario";
import type { Inputs } from "./ownership";

export type PublishedCosts = {
  price: number; ratePct: number; taxYear: number | null;
  insuranceYear: number | null; utilitiesMonth: number | null; rentMonth: number | null;
};
export const DEFAULT_YEARS = 10;

/** One set of defaults for the profile and the place finder; home overrides stay local. */
export function ownershipInputs(source: PublishedCosts, personal: Personal = {}, home: Partial<Inputs> = {}): Inputs {
  return {
    ...source, downPct: personal.downPct ?? DEFAULT_DOWN,
    ratePct: personal.ratePct ?? source.ratePct,
    insuranceYear: personal.insuranceYear ?? source.insuranceYear,
    pmiPct: personal.pmiPct ?? null, upkeepPct: personal.upkeepPct ?? UPKEEP_PCT,
    closingPct: personal.closingPct ?? null, years: personal.years ?? DEFAULT_YEARS,
    appreciationPct: personal.appreciationPct ?? 0, rentGrowthPct: personal.rentGrowthPct ?? 0,
    commissionPct: personal.commissionPct ?? COMMISSION_PCT,
    hoaMonth: null, floodYear: null, movingCost: null, repairsCost: null,
    ...home,
  };
}

export function utilityTotal(electricity: number | null, gas: number | null, waterYear: number | null): number | null {
  return electricity === null ? null : electricity + (gas ?? 0) + (waterYear ?? 0) / 12;
}

export function cashFit(cash: number | undefined, low: number, high: number): string {
  if (cash === undefined) return "Upfront cash not checked";
  if (cash < low) return "Below the estimated upfront range";
  if (cash < high) return "Covers the low end; may not cover the high end";
  return "Covers the estimated upfront range";
}
