import { describe, expect, it } from "vitest";

import { sample } from "@/lib/similar.fixture";
import { priceWindow, similarGroups } from "@/lib/similar";

describe("similarGroups", () => {
  it("separates what was matched on from the price and what else to compare", () => {
    const groups = similarGroups(sample);
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.metric_id)])).toEqual([
      ["matched", ["acs_share_detached", "acs_homeownership_rate"]],
      ["price", ["sr1a_median_sale_price", "zhvi_sfr"]],
      ["also", ["acs_mean_commute_minutes", "nj_effective_tax_rate"]],
    ]);
    // One column per place, the town first, a missing value kept as missing.
    expect(groups[1].rows[1].values).toEqual([null, 390547]);
  });
});

describe("priceWindow", () => {
  it("names the sales window, which is not a calendar year", () => {
    expect(priceWindow(sample)).toBe("January 2024 to June 2026");
    expect(priceWindow({ ...sample, price_from: null })).toBeNull();
  });
});
