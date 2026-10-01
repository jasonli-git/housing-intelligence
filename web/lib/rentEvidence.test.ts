import { describe, expect, it } from "vitest";

import type { PacketLevel } from "@/lib/api";
import { hasRentEvidence, rentRows } from "@/lib/rentEvidence";

function level(metric_id: string, value: number, period_end = "2024-12-31"): PacketLevel {
  return {
    metric_id,
    label: metric_id,
    unit: "usd_month",
    direction: "neutral",
    value,
    period_start: "2020-01-01",
    period_end,
    rank: null,
    of: null,
    percentile: null,
    release_id: null,
    source_id: null,
    match_method: null,
  };
}

const ZIP = [
  level("acs_median_rent_2br", 3371),
  level("hud_safmr_2br", 4190, "2027-09-30"),
  level("zori_all", 3988, "2026-08-31"),
];
const COUNTY = [level("hud_fmr_2br", 2763, "2027-09-30"), level("hud_fmr_3br", 3367, "2027-09-30")];

describe("rentRows", () => {
  it("sets tenants, benchmark and listings in order, each saying what it measures", () => {
    const rows = rentRows(2, ZIP, COUNTY, new Map([["acs_median_rent_2br", 125]]), "Hudson County", null);
    expect(rows.map((r) => r.kind)).toEqual(["occupants", "benchmark", "listings"]);
    expect(rows[0].margin).toBe(125);
    expect(rows[2].note).toContain("no split by bedrooms");
  });

  it("prefers HUD's ZIP-level rent to the county's where HUD sets one", () => {
    const rows = rentRows(2, ZIP, COUNTY, new Map(), "Hudson County", null);
    expect(rows[1]).toMatchObject({ value: 4190, asOf: "FY2027" });
    expect(rows[1].label).toContain("this ZIP code");
  });

  it("falls back to the county's Fair Market Rent and names the county", () => {
    const rows = rentRows(3, ZIP, COUNTY, new Map(), "Hudson County", null);
    expect(rows.find((r) => r.kind === "benchmark")).toMatchObject({ value: 3367 });
    expect(rows.find((r) => r.kind === "benchmark")?.note).toContain("Hudson County’s");
  });

  it("leaves out a size with no figure rather than showing it empty, and adds the reader's rent", () => {
    const rows = rentRows(4, ZIP, COUNTY, new Map(), null, 2400);
    expect(rows.map((r) => r.kind)).toEqual(["listings", "reader"]);
  });
});

describe("hasRentEvidence", () => {
  it("is false only when no size has any figure", () => {
    expect(hasRentEvidence([], [])).toBe(false);
    expect(hasRentEvidence([], COUNTY)).toBe(true);
    expect(hasRentEvidence([level("zori_all", 2000)], [])).toBe(false);
  });
});
