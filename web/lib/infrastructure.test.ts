import { describe, expect, it } from "vitest";
import { bundledPrice, pfasResult, publisherUrl, resolutionText } from "./infrastructure";
import type { ElectricUtility, PfasSamples, WaterSystem } from "./api";

describe("infrastructure context, never a bill or clean-water score", () => {
  it("uses only bundled revenue and converts units once", () => {
    const utility: ElectricUtility = { name: "One", year: 2024, sales: [
      { service_type: "Bundled", data_type: "O", revenue_thousand: 200, mwh: 1000, customers: 100 },
      { service_type: "Delivery", data_type: "O", revenue_thousand: 800, mwh: 1000, customers: 50 },
    ] };
    expect(bundledPrice(utility)).toEqual({ dollarsPerKwh: .2, imputed: false });
    expect(bundledPrice({ ...utility, sales: [utility.sales[1]] })).toBeNull();
    expect(bundledPrice({ ...utility, sales: [{ ...utility.sales[0], mwh: null }] })).toBeNull();
    expect(bundledPrice({ ...utility, sales: [{ ...utility.sales[0], data_type: "I" }] })?.imputed).toBe(true);
  });
  it("does not call missing RTC dates active violations", () => {
    const system = { violations: 2, resolved_violations: 1 } as WaterSystem;
    expect(resolutionText(system)).toBe("1 of 2 have a reported return to compliance");
    expect(resolutionText({ ...system, resolved_violations: null })).toBe("Resolution data not loaded");
  });
  it("does not make nondetects zero or below the legal limit", () => {
    const sample = { detections: 0, maximum_ng_l: null, minimum_reporting_limit_ng_l: 4, maximum_reporting_limit_ng_l: 5 } as PfasSamples;
    expect(pfasResult(sample)).toBe("Below reporting limit (4–5 ng/L); not zero");
  });
  it("rejects executable publisher links", () => {
    expect(publisherUrl("javascript:alert(1)")).toBeNull();
    expect(publisherUrl("https://example.com/report")).toBe("https://example.com/report");
  });
});
