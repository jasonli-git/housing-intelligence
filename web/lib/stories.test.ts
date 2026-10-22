import { describe, expect, it } from "vitest";

import { centre, extremes, inside, ladder, leadingDestination, monthlyCost, PRICE, ratioBand, traitPremiums, type StoryTown, type Trait } from "./stories";

const town = (id: number, county: number, price: number, extra: Record<string, number> = {}): StoryTown => ({
  id, name: `Town ${id}`, county, countyName: `County ${county}`, values: { [PRICE]: price, ...extra },
});
const trait: Trait = { key: "t", label: "Has it", rule: "", metric: "m", has: (v) => v > 0 };

describe("traitPremiums", () => {
  it("compares a town only with its own county", () => {
    // County 1 is dear, county 2 cheap; in each, the towns with the trait are twice the rest.
    const towns = [
      ...[1, 2, 3, 4, 5].map((i) => town(i, 1, 800, { m: 1 })),
      ...[6, 7, 8, 9, 10].map((i) => town(i, 1, 400, { m: 0 })),
      ...[11, 12, 13, 14, 15].map((i) => town(i, 2, 200, { m: 1 })),
      ...[16, 17, 18, 19, 20].map((i) => town(i, 2, 100, { m: 0 })),
    ];
    const [premium] = traitPremiums(towns, [trait]);
    expect(premium.premium).toBeCloseTo(1);
    expect(premium.towns).toBe(10);
    expect(premium.examples[0]).toBe("Town 1");
  });

  it("leaves out a trait too few or too many towns have", () => {
    const towns = [1, 2, 3, 4, 5, 6].map((i) => town(i, 1, 100 * i, { m: i === 1 ? 1 : 0 }));
    expect(traitPremiums(towns, [trait])).toEqual([]);
  });
});

describe("ladder and extremes", () => {
  it("orders towns by typical home and keeps a missing price missing", () => {
    const rows = ladder([town(1, 1, 300), town(2, 1, 500, { zhvi_bottom_tier: 350 })]);
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
    expect(rows[1].starter).toBeNull();
  });

  it("names each county's priciest and cheapest, widest gap first", () => {
    const counties = new Map([[1, "One"], [2, "Two"]]);
    const towns = [town(1, 1, 900), town(2, 1, 100), town(3, 2, 300), town(4, 2, 200)];
    const out = extremes(towns, [{ id: 9, name: "07001", value: 500, county: 1 }], counties);
    expect(out.map((e) => e.countyName)).toEqual(["One", "Two"]);
    expect(out[0].spread).toBe(9);
    expect(out[0].zipPriciest?.name).toBe("07001");
    expect(out[0].zipCheapest).toBeNull();
  });
});

describe("placing a ZIP code", () => {
  const square = [[0, 0, 2, 0, 2, 2, 0, 2, 0, 0]];
  it("finds the centre and tests it against an outline", () => {
    expect(centre(square)).toEqual([0.8, 0.8]);
    expect(inside([1, 1], square)).toBe(true);
    expect(inside([3, 1], square)).toBe(false);
  });
});

describe("the newer stories' arithmetic", () => {
  it("bands a town by home value to income", () => {
    expect(ratioBand(100, 250)).toBe("under3");
    expect(ratioBand(100, 500)).toBe("3to5");
    expect(ratioBand(100, 501)).toBe("over5");
  });

  it("builds a month only where the home value and tax bill exist", () => {
    const flat = (p: number) => p / 100;
    expect(monthlyCost({ [PRICE]: 500 }, 6, flat)).toBeNull();
    const m = monthlyCost({ [PRICE]: 500, modiv_median_tax_bill: 120, acs_median_gas: 50 }, 6, flat)!;
    expect(m.mortgage).toBe(4);
    expect(m.tax).toBe(10);
    expect(m.gas).toBe(50);
    expect(m.insurance).toBe(0);
  });

  it("skips the town itself and the catch-alls for its leading destination", () => {
    const d = [
      { name: "Montclair", region_id: 1, share: 0.2 },
      { name: "Elsewhere in New York", region_id: null, share: 0.1 },
      { name: "Newark", region_id: 2, share: 0.05 },
    ];
    expect(leadingDestination(d, 1)?.name).toBe("Newark");
    expect(leadingDestination(d.slice(0, 2), 1)).toBeNull();
  });
});
