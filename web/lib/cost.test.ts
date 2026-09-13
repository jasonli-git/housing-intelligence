import { describe, expect, it } from "vitest";

import { costToOwn, incomeFor, leftOut, monthlyPayment } from "@/lib/cost";

describe("monthlyPayment", () => {
  it("matches the standard amortisation figure", () => {
    // $400,000 at 6% over 30 years is $2,398.20 a month.
    expect(monthlyPayment(400_000, 6)).toBeCloseTo(2398.2, 1);
  });

  it("divides evenly at a zero rate and is nothing on nothing", () => {
    expect(monthlyPayment(360_000, 0)).toBe(1000);
    expect(monthlyPayment(0, 6)).toBe(0);
  });
});

describe("incomeFor", () => {
  it("is the income at which the cost is 30% of it", () => {
    expect(incomeFor(3000)).toBe(120_000);
  });
});

describe("costToOwn", () => {
  it("adds a twelfth of the tax bill to principal and interest", () => {
    const cost = costToOwn({ homeValue: 500_000, ratePct: 6, downPct: 20, annualTax: 12_000 });

    expect(cost.down).toBe(100_000);
    expect(cost.loan).toBe(400_000);
    expect(cost.mortgage).toBeCloseTo(2398.2, 1);
    expect(cost.tax).toBe(1000);
    expect(cost.total).toBeCloseTo(3398.2, 1);
    expect(cost.incomeNeeded).toBeCloseTo(135_928, 0);
  });

  it("leaves tax out, and says so by null, where there is no bill", () => {
    const cost = costToOwn({ homeValue: 500_000, ratePct: 6, downPct: 20, annualTax: null });

    expect(cost.tax).toBeNull();
    expect(cost.total).toBeCloseTo(2398.2, 1);
  });
});

describe("leftOut", () => {
  it("names mortgage insurance only below 20% down", () => {
    expect(leftOut(20)).toEqual(["homeowners insurance", "upkeep", "closing costs"]);
    expect(leftOut(10)[0]).toContain("mortgage insurance");
  });
});
