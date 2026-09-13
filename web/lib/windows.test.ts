import { describe, expect, it } from "vitest";

import { windowNote } from "@/lib/windows";

const acs = { start: "2019-12-31", end: "2023-12-31" };
const zillow5 = { start: "2021-07-31", end: "2026-07-31" };
const zillowSince = { start: "2018-12-31", end: "2026-07-31" };

describe("windowNote", () => {
  it("says nothing for the windows that explain themselves", () => {
    expect(windowNote("5y", "zhvi_sfr", { "5y": zillow5 })).toEqual([]);
    expect(windowNote("10y", "zhvi_sfr", {})).toEqual([]);
  });

  it("explains why Since 2019 starts where it does", () => {
    const notes = windowNote("since_2019", "zhvi_sfr", { "5y": zillow5, since_2019: zillowSince });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("last full year before the pandemic");
  });

  it("says when it compares the same two readings as five years", () => {
    const notes = windowNote("since_2019", "acs_median_hh_income", { "5y": acs, since_2019: acs });
    expect(notes[1]).toContain("the same two readings as five years");
  });

  it("names HUD's method change only for a Fair Market Rent window that spans it", () => {
    const spanning = { start: "2018-09-30", end: "2026-09-30" };
    expect(
      windowNote("since_2019", "hud_fmr_2br", { "5y": { start: "2021-09-30", end: "2026-09-30" }, since_2019: spanning }).at(-1),
    ).toContain("50th to the 40th percentile");
    expect(
      windowNote("since_2019", "hud_fmr_2br", { since_2019: { start: "2021-09-30", end: "2026-09-30" } }).join(" "),
    ).not.toContain("percentile");
  });
});
