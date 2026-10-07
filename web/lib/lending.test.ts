import { describe, expect, it } from "vitest";

import type { PacketLevel } from "@/lib/api";
import { lending } from "@/lib/lending";

const level = (metric_id: string, value: number, match_method = "tract_homes") =>
  ({ metric_id, value, period_end: "2025-12-31", match_method }) as PacketLevel;

describe("lending", () => {
  it("reads the newest year, says when a town's figures are estimated, and orders denial reasons", () => {
    const l = lending([
      level("hmda_purchase_loans", 96),
      level("hmda_median_rate", 6.625),
      level("hmda_denial_rate", 0.075),
      level("hmda_denial_dti_share", 0.3),
      level("hmda_denial_value_share", 0.4),
      level("hmda_denial_credit_share", 0),
    ])!;
    expect(l.year).toBe(2025);
    expect(l.estimated).toBe(true);
    expect(l.reasons.map((r) => r.label)).toEqual(["the home's appraised value", "debt-to-income"]);
  });

  it("is exact for a county and absent without HMDA figures", () => {
    expect(lending([level("hmda_purchase_loans", 5000, "fips")])!.estimated).toBe(false);
    expect(lending([])).toBeNull();
  });
});
