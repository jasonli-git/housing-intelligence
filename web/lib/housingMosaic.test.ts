import { describe, expect, it } from "vitest";
import type { PacketLevel } from "@/lib/api";
import { housingMosaicViews, mosaicCounts, statewideMosaicViews } from "./housingMosaic";

function row(metric_id: string, value: number, extra: Partial<PacketLevel> = {}): PacketLevel {
  return { metric_id, value, label: metric_id, unit: "ratio", direction: "neutral",
    period_start: "2020-01-01", period_end: "2024-12-31", source_id: "census_acs",
    release_id: 1, rank: null, of: null, percentile: null, match_method: "fips",
    margin_of_error: .01, ...extra };
}
const ageIds = ["acs_share_built_pre_1940", "acs_share_built_1940_1979", "acs_share_built_1980_1999", "acs_share_built_2000_later"];
describe("mosaic apportionment", () => {
  it("uses largest remainders with deterministic ties and exactly 100 tiles", () => {
    expect(mosaicCounts([.3333, .3333, .3334])).toEqual([33, 33, 34]);
    expect(mosaicCounts([.335, .335, .33])).toEqual([34, 33, 33]);
    expect(mosaicCounts([0, 1])).toEqual([0, 100]);
    for (let n = 0; n <= 1000; n++) {
      const shares = [n / 1000, (1000 - n) / 1000];
      const counts = mosaicCounts(shares);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(100);
      expect(counts.every((v, i) => Math.abs(v - shares[i] * 100) < 1.000001)).toBe(true);
    }
  });
  it("rejects invalid or incomplete distributions", () => {
    for (const shares of [[], [.4, .4], [-.1, 1.1], [NaN, 1], [Infinity, 0]]) {
      expect(mosaicCounts(shares)).toEqual([]);
    }
  });
});

describe("state record distributions", () => {
  const construction = [
    row("nj_units_certified", 100, { source_id: "nj_construction", unit: "count" }),
    row("nj_units_certified_1_2", 40, { source_id: "nj_construction", unit: "count" }),
    row("nj_units_certified_multi", 50, { source_id: "nj_construction", unit: "count" }),
    row("nj_units_certified_mixed", 10, { source_id: "nj_construction", unit: "count" }),
  ];
  const mortgages = [
    row("hmda_purchase_loans", 100, { source_id: "ffiec_hmda", unit: "count" }),
    row("hmda_conventional_share", .7, { source_id: "ffiec_hmda" }),
    row("hmda_fha_share", .2, { source_id: "ffiec_hmda" }),
    row("hmda_va_share", .05, { source_id: "ffiec_hmda" }),
  ];
  it("uses reported completion counts, not statewide stock, and labels preliminary coverage", () => {
    const [view] = statewideMosaicViews(construction, [2024]);
    expect(view.groups.map(g => g.share)).toEqual([.4, .5, .1]);
    expect(view.groups.every(g => g.margin === null)).toBe(true);
    expect(view.denominator).toBe("100 reported new homes finished");
    expect(view.evidence).toContain("Reporting towns only. Preliminary figures.");
  });
  it("keeps the other loan-type remainder and excludes cash purchases explicitly", () => {
    const [view] = statewideMosaicViews(mortgages);
    expect(view.groups[3].share).toBeCloseTo(.05);
    expect(mosaicCounts(view.groups.map(g => g.share))).toEqual([70, 20, 5, 5]);
    expect(view.evidence).toContain("cash buyers and non-reporting lenders are excluded");
  });
  it("rejects incomplete, incompatible and inconsistent completion distributions", () => {
    expect(statewideMosaicViews(construction.slice(1))).toEqual([]);
    expect(statewideMosaicViews(construction.slice(0, 3))).toEqual([]);
    for (const extra of [{ value: 101 }, { value: 0 }, { value: 100.5 }, { period_end: "2023-12-31" }, { release_id: 2 }, { source_id: "other" }]) {
      expect(statewideMosaicViews([{ ...construction[0], ...extra }, ...construction.slice(1)])).toEqual([]);
    }
  });
  it("rejects missing, overfull and mismatched loan-type distributions", () => {
    expect(statewideMosaicViews(mortgages.slice(0, 3))).toEqual([]);
    for (const extra of [{ value: .9 }, { value: -1 }, { period_end: "2023-12-31" }, { release_id: 2 }]) {
      expect(statewideMosaicViews([mortgages[0], { ...mortgages[1], ...extra }, ...mortgages.slice(2)])).toEqual([]);
    }
    expect(statewideMosaicViews([{ ...mortgages[0], value: 0 }, ...mortgages.slice(1)])).toEqual([]);
  });
});
describe("independent housing views", () => {
  it("separates all homes from occupied homes, including complementary margins", () => {
    const views = housingMosaicViews([row("acs_homeownership_rate", .743), row("acs_vacancy_rate", .021)]);
    expect(views.map(v => v.denominator)).toEqual(["Occupied homes", "All homes"]);
    expect(views[0].groups[1].share).toBeCloseTo(.257);
    expect(views[0].groups.map(g => g.margin)).toEqual(["± 1.0 points", "± 1.0 points"]);
    expect(views[1].groups[0].note).toContain("seasonal");
    expect(views[1].period).toBe("2020–2024");
  });
  it("preserves missing margins and prefers the summary uncertainty", () => {
    const levels = [row("acs_homeownership_rate", .7, { margin_of_error: null })];
    expect(housingMosaicViews(levels)[0].groups[1].margin).toBe("no margin available");
    const u = { value: new Map([["acs_homeownership_rate", { margin: .02, best: null, worst: null }]]), change: new Map() };
    expect(housingMosaicViews(levels, u)[0].groups[1].margin).toBe("± 2.0 points");
  });
  it("includes age only as a complete, same-source, same-period, same-release distribution", () => {
    const ages = ageIds.map(id => row(id, .25));
    expect(housingMosaicViews(ages)[0].groups).toHaveLength(4);
    expect(housingMosaicViews(ages.slice(1))).toEqual([]);
    for (const extra of [{ period_end: "2023-12-31" }, { source_id: "other" }, { release_id: 2 }, { value: .3 }]) {
      expect(housingMosaicViews([row(ageIds[0], .25, extra), ...ages.slice(1)])).toEqual([]);
    }
  });
  it("does not turn missing, nonfinite or invalid-unit figures into tiles", () => {
    expect(housingMosaicViews([])).toEqual([]);
    for (const extra of [{ value: NaN }, { value: -1 }, { value: 1.1 }, { unit: "percent" }, { source_id: "other" }]) {
      expect(housingMosaicViews([row("acs_homeownership_rate", .5, extra)])).toEqual([]);
    }
  });
});
