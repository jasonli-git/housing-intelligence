import { describe, expect, it } from "vitest";
import { waterQualityReport } from "./waterReports";

describe("verified outbound annual report links", () => {
  it("matches an exact system ID, not a name or an inherited object key", () => {
    expect(waterQualityReport("NJ2004002")?.url).toBe("https://amwater.com/ccr/raritan.pdf");
    expect(waterQualityReport("NJ0408001")?.url).toContain("camden.pdf");
    expect(waterQualityReport("NJ2004003")).toBeNull();
    expect(waterQualityReport("toString")).toBeNull();
  });
});
