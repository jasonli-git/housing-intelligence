import { describe, expect, it } from "vitest";
import type { PacketLevel } from "./api";
import { homeChecks } from "./homeChecks";

const row = (metric_id: string, value = 1) => ({ metric_id, value, period_end: "2026-06-30" }) as PacketLevel;
describe("moving checks", () => {
  it("does not equate missing figures with zero cost", () => {
    const checks = homeChecks([]);
    expect(checks).toHaveLength(3);
    expect(checks[0].text).toContain("does not mean no tax");
    expect(checks.every((c) => !c.metricId)).toBe(true);
  });
  it("distinguishes index values from transactions and retains the vintage", () => {
    const checks = homeChecks([row("sr1a_median_sale_price")]);
    expect(checks[1].text).toContain("changed hands");
    expect(checks[1].periodEnd).toBe("2026-06-30");
    expect(homeChecks([row("sr1a_median_sale_price"), row("zhvi_sfr")])[1].text).toContain("not a listing price");
  });
  it("uses finite figures including zero, without inventing local risk", () => {
    const checks = homeChecks([row("modiv_median_tax_bill", 0), row("zori_all", NaN)]);
    expect(checks[0].metricId).toBe("modiv_median_tax_bill");
    expect(checks[2].metricId).toBeUndefined();
    expect(homeChecks([row("zori_all")])[2].text).toContain("different kinds");
  });
});
