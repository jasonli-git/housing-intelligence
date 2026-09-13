import { describe, expect, it } from "vitest";

import { monthlyBudget, type Place, reach } from "@/lib/afford";

function place(id: number, fields: Partial<Place>): Place {
  return { id, name: `P${id}`, level: "county", detail: null, home: null, tax: null, rent: null, ...fields };
}

describe("monthlyBudget", () => {
  it("is 30% of a month's gross income", () => {
    expect(monthlyBudget(120_000)).toBe(3000);
  });
});

describe("reach", () => {
  const places = [
    // $500,000 at 6%, 20% down, $12,000 tax: $3,398.20 a month.
    place(1, { home: 500_000, tax: 12_000, rent: 2500 }),
    // $300,000, same terms, $6,000 tax: $1,938.92 a month.
    place(2, { home: 300_000, tax: 6_000, rent: 1800 }),
    // No tax bill: left out of owning, kept for renting.
    place(3, { home: 200_000, rent: 1500 }),
  ];

  it("marks the places whose cost to own is at most 30% of income, cheapest first", () => {
    const rows = reach(places, { mode: "own", income: 120_000, downPct: 20, ratePct: 6 });

    expect(rows.map((r) => r.place.id)).toEqual([2, 1]);
    expect(rows.map((r) => r.within)).toEqual([true, false]);
    expect(rows[0].share).toBeCloseTo(1938.92 / 10_000, 4);
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
