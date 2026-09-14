import { describe, expect, it } from "vitest";

import {
  changePerMonth,
  costToOwn,
  goneAgainstRent,
  incomeFor,
  leftOut,
  monthlyPayment,
  monthsBetween,
} from "@/lib/cost";

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
    expect(cost.gone).toBeCloseTo(2000, 6);
  });

  it("splits the first payment into interest, gone, and principal, kept", () => {
    // $400,000 borrowed at 6%: a month's interest is exactly $2,000 of the $2,398.20.
    const cost = costToOwn({ homeValue: 500_000, ratePct: 6, downPct: 20, annualTax: 12_000 });

    expect(cost.interest).toBeCloseTo(2000, 6);
    expect(cost.principal).toBeCloseTo(398.2, 1);
    expect(cost.gone).toBeCloseTo(3000, 6);
  });

  it("has no interest at a zero rate", () => {
    const cost = costToOwn({ homeValue: 450_000, ratePct: 0, downPct: 20, annualTax: null });

    expect(cost.interest).toBe(0);
    expect(cost.principal).toBe(1000);
  });
});

describe("goneAgainstRent", () => {
  it("reads a gap within 5% of the rent as about the same", () => {
    // Mercer on 2026-09-14: $2,654 gone against $2,606 rent.
    expect(goneAgainstRent(2654, 2606).kind).toBe("about");
  });

  it("says which way a wider gap runs", () => {
    expect(goneAgainstRent(3000, 2600)).toEqual({ kind: "more", gap: 400 });
    expect(goneAgainstRent(2200, 2600)).toEqual({ kind: "less", gap: -400 });
  });
});

describe("monthsBetween and changePerMonth", () => {
  it("counts whole months between period ends", () => {
    expect(monthsBetween("2021-07-31", "2026-07-31")).toBe(60);
    expect(monthsBetween("2018-12-31", "2026-07-31")).toBe(91);
  });

  it("spreads a change over its months, and nothing over none", () => {
    expect(changePerMonth(332_000, 451_000, 60)).toBeCloseTo(1983.33, 2);
    expect(changePerMonth(1, 2, 0)).toBe(0);
  });
});

describe("leftOut", () => {
  it("names mortgage insurance only below 20% down", () => {
    expect(leftOut(20)).toEqual([
      "homeowners insurance",
      "upkeep",
      "closing costs",
      "what the down payment could earn",
    ]);
    expect(leftOut(10)[0]).toContain("mortgage insurance");
  });
});
