import { describe, expect, it } from "vitest";

import type { Observation, PacketLevel } from "@/lib/api";
import { claimsSummary, floodLevels, shareText, systemReportUrl, unmapped } from "@/lib/hazards";

function year(metric: string, y: number, value: number): Observation {
  return {
    metric_id: metric,
    period_start: `${y}-01-01`,
    period_end: `${y}-12-31`,
    value,
    source_id: "fema_nfip_claims",
    vintage: "current",
    match_method: "fips",
  };
}

function level(metric_id: string, value: number): PacketLevel {
  return { metric_id, value } as PacketLevel;
}

describe("floodLevels and unmapped", () => {
  it("says the shares are missing because the map does not reach the homes", () => {
    const levels = floodLevels([level("fema_mapped_homes_share", 0.15)]);
    expect(levels.high).toBeNull();
    expect(unmapped(levels)).toBe(true);
  });

  it("does not call a mapped place unmapped", () => {
    const levels = floodLevels([
      level("fema_mapped_homes_share", 1),
      level("fema_flood_homes_share", 0.04),
    ]);
    expect(unmapped(levels)).toBe(false);
    expect(levels.high).toBe(0.04);
  });
});

describe("claimsSummary", () => {
  const claims = [year("c", 2012, 900), year("c", 2021, 40), year("c", 2024, 5), year("c", 2026, 2)];
  const paid = [year("p", 2012, 9e6), year("p", 2021, 4e5), year("p", 2024, 1e4), year("p", 2026, 3e3)];

  it("sums ten whole years and keeps the newest year apart as still filling", () => {
    const s = claimsSummary(claims, paid)!;
    expect(s.partialYear).toBe(2026);
    expect(s.partial).toEqual({ year: 2026, claims: 2, paid: 3e3 });
    expect([s.first, s.last]).toEqual([2016, 2025]);
    expect(s.claims).toBe(45);
    expect(s.paid).toBe(4.1e5);
  });

  it("names the worst whole years since records begin", () => {
    const s = claimsSummary(claims, paid)!;
    expect(s.since).toBe(2012);
    expect(s.worst.map((y) => y.year)).toEqual([2012, 2021, 2024]);
  });

  it("is null where no claim was ever paid", () => {
    expect(claimsSummary([], [])).toBeNull();
  });
});

describe("shareText", () => {
  it("never prints a precision the estimate does not have", () => {
    expect(shareText(0)).toBe("none");
    expect(shareText(0.003)).toBe("under 1%");
    expect(shareText(0.257)).toBe("26%");
    expect(shareText(0.996)).toBe("over 99%");
    expect(shareText(1)).toBe("100%");
  });
});

it("links EPA's report for a water system", () => {
  expect(systemReportUrl("NJ0238001")).toBe(
    "https://echo.epa.gov/detailed-facility-report?fid=NJ0238001&sys=SDWIS",
  );
});
