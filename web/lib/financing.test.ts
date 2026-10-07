import { describe, expect, it } from "vitest";

import { fhaCheck, rateScenarios } from "@/lib/financing";
import { loanFor, type Inputs } from "@/lib/ownership";

describe("fhaCheck", () => {
  it("says an FHA loan over its county's limit is over, on the loan before the premium", () => {
    const loan = loanFor({ price: 800_000, downPct: 3.5, ratePct: 6.5 });
    expect(fhaCheck(loan, { value: 730_250, year: 2026 })).toMatchObject({ over: true, base: 772_000 });
    expect(fhaCheck(loan, { value: 1_249_125, year: 2026 })?.over).toBe(false);
  });

  it("says nothing about a loan that is not FHA, or without a limit", () => {
    expect(fhaCheck(loanFor({ price: 800_000, downPct: 20, ratePct: 6.5 }), { value: 1, year: 2026 })).toBeNull();
    expect(fhaCheck(loanFor({ price: 800_000, downPct: 3.5, ratePct: 6.5 }), null)).toBeNull();
  });
});

describe("rateScenarios", () => {
  it("prices the same home at each rate, higher rates costing more", () => {
    const input = {
      price: 450_000, downPct: 20, ratePct: 6.5, taxYear: 9_000, insuranceYear: 1_500,
      utilitiesMonth: 300, upkeepPct: 1, hoaMonth: null, floodYear: null, pmiPct: null,
      rentMonth: null,
    } as unknown as Inputs;
    const rows = rateScenarios(input);
    expect(rows.map((r) => r.ratePct)).toEqual([5, 6, 7, 8]);
    expect(rows[0].mortgage).toBeLessThan(rows[3].mortgage);
    // $360,000 over 30 years at 5%: $1,932.56 a month.
    expect(rows[0].mortgage).toBeCloseTo(1932.56, 1);
  });
});
