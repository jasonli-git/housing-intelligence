import { describe, expect, it } from "vitest";

import { checkPlace, monthlyBudget, type Place, reach } from "@/lib/afford";
import { ownershipInputs, cashFit, utilityTotal } from "./budgetScenario";
import { eachMonth, upFront } from "./ownership";

describe("checkPlace", () => {
  const options = { income: 120_000, downPct: 20, ratePct: 6 };

  it("answers one place both ways", () => {
    const result = checkPlace(place(1, { home: 300_000, tax: 6_000, rent: 2_500 }), options);

    expect(result.own?.monthly).toBeCloseTo(2488.92, 1);
    expect(result.own?.within).toBe(true);
    expect(result.rent?.within).toBe(true);
  });

  it("leaves a side empty where the place lacks its figure", () => {
    const result = checkPlace(place(2, { home: 300_000, rent: 4_000 }), options);

    expect(result.own).toBeNull();
    expect(result.rent?.within).toBe(false);
  });
});

function place(id: number, fields: Partial<Place>): Place {
  return { id, name: `P${id}`, level: "county", detail: null, home: null, tax: null, rent: null, insurance: 1200, utilities: 200, ...fields };
}

describe("monthlyBudget", () => {
  it("is 30% of a month's gross income", () => {
    expect(monthlyBudget(120_000)).toBe(3000);
  });
});

describe("reach", () => {
  const places = [
    // Complete monthly estimates also include insurance, utilities and upkeep.
    place(1, { home: 500_000, tax: 12_000, rent: 2500 }),
    place(2, { home: 300_000, tax: 6_000, rent: 1800 }),
    // No tax bill: left out of owning, kept for renting.
    place(3, { home: 200_000, rent: 1500 }),
  ];

  it("marks the places whose cost to own is at most 30% of income, cheapest first", () => {
    const rows = reach(places, { mode: "own", income: 120_000, downPct: 20, ratePct: 6 });

    expect(rows.map((r) => r.place.id)).toEqual([2, 1]);
    expect(rows.map((r) => r.within)).toEqual([true, false]);
    expect(rows[0].share).toBeCloseTo(2488.92 / 10_000, 4);
  });

  it("leaves out a place without the tax bill owning needs", () => {
    const rows = reach(places, { mode: "own", income: 1_000_000, downPct: 20, ratePct: 6 });

    expect(rows.some((r) => r.place.id === 3)).toBe(false);
  });

  it("compares rent to the same line when renting", () => {
    const rows = reach(places, { mode: "rent", income: 72_000, downPct: 20, ratePct: 6 });

    // 30% of $6,000 a month is $1,800: the $1,800 rent is within reach, the $2,500 is not.
    expect(rows.map((r) => [r.place.id, r.within])).toEqual([[3, true], [2, true], [1, false]]);
  });
});

describe("one calculation for the profile and budget finder", () => {
  it.each([20, 10, 3.5])("matches full monthly and upfront costs at %s%% down, including mortgage insurance", (downPct) => {
    const p = place(1, { home: 300000, tax: 6000, rent: 1800 });
    const personal = { ratePct: 5.5, upkeepPct: .8, insuranceYear: 1600, closingPct: 3 };
    const input = ownershipInputs({ price: p.home!, ratePct: 6, taxYear: p.tax, insuranceYear: p.insurance!, utilitiesMonth: p.utilities!, rentMonth: p.rent }, { ...personal, downPct });
    const row = checkPlace(p, { income: 120000, ratePct: 6, downPct, personal }).own!;
    expect(row.monthly).toBe(eachMonth(input).total);
    expect(row.monthly).toBeGreaterThan(eachMonth(input).gone);
    expect(row.upfront?.low).toBe(upFront(input).low);
    expect(row.upfront?.high).toBe(upFront(input).high);
  });
  it("does not green-light a low estimate with missing required costs", () => {
    const row = checkPlace(place(1, { home: 100000, tax: 2000, insurance: null, utilities: null }), { income: 500000, downPct: 20, ratePct: 6 }).own!;
    expect(row.share).toBeLessThan(.3);
    expect(row.within).toBe(false);
    expect(row.missing).toEqual(["Homeowners insurance", "Utilities"]);
  });
  it("keeps home-specific prices and fees out of the shared scenario", () => {
    const base = { price: 300000, ratePct: 6, taxYear: 6000, insuranceYear: 1200, utilitiesMonth: 200, rentMonth: 1800 };
    const local = ownershipInputs(base, {}, { price: 350000, hoaMonth: 200 });
    const comparison = ownershipInputs(base);
    expect(local.price).toBe(350000);
    expect(comparison.price).toBe(300000);
    expect(comparison.hoaMonth).toBeNull();
  });
  it("distinguishes no cash check, below range, inside range and above range", () => {
    expect(cashFit(undefined, 10000, 15000)).toBe("Upfront cash not checked");
    expect(cashFit(0, 10000, 15000)).toBe("Below the estimated upfront range");
    expect(cashFit(10000, 10000, 15000)).toContain("low end");
    expect(cashFit(15000, 10000, 15000)).toBe("Covers the estimated upfront range");
  });
  it("requires electricity and uses monthly gas / annual water consistently", () => {
    expect(utilityTotal(null, 20, 120)).toBeNull();
    expect(utilityTotal(100, 20, 120)).toBe(130);
    expect(utilityTotal(100, null, null)).toBe(100);
  });
});
