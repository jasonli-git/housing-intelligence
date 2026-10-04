import { describe, expect, it } from "vitest";
import type { LevelReading } from "./api";
import { stateFigurePeriod, stateOverviewFigures } from "./stateEntry";
import { formatValue } from "./format";

const level = (metric_id: string): LevelReading => ({ metric_id, value: 535000, unit: "usd", label: metric_id, direction: "neutral", period_start: "2025-07-01", period_end: "2026-06-30", source_id: "nj_sr1a", rank: null, of: null });

describe("state entry data boundaries", () => {
  it("makes the property-tax rate denominator explicit", () => {
    expect(formatValue(1.86929, "rate_per_100")).toBe("$1.87 per $100");
  });
  it("selects the rolling sale median rather than an index or a longer sale window", () => {
    const price = level("sr1a_median_sale_price_12m");
    expect(stateOverviewFigures([level("fhfa_hpi"), level("sr1a_median_sale_price"), price]).price).toBe(price);
  });
  it("does not manufacture missing prices or construction coverage", () => {
    expect(stateOverviewFigures([level("fhfa_hpi")])).toEqual({ price: undefined, added: undefined, certified: undefined, demolished: undefined });
  });
  it("preserves both endpoints of a transaction window", () => {
    expect(stateFigurePeriod(level("sr1a_median_sale_price_12m"))).toBe("Jul 2025–Jun 2026");
  });
  it("labels a pooled survey by its survey years and an index by its quarter", () => {
    expect(stateFigurePeriod({ ...level("acs_median_hh_income"), period_start: "2020-01-01", period_end: "2024-12-31" })).toBe("2020–2024");
    expect(stateFigurePeriod(level("fhfa_hpi"))).toBe("Q2 2026");
  });
});
