import { describe, expect, it } from "vitest";

import type { PacketLevel, PacketMetric } from "@/lib/api";
import { standOuts } from "@/lib/standouts";

function metric(metric_id: string, fields: Partial<PacketMetric>): PacketMetric {
  return {
    metric_id,
    label: metric_id,
    unit: "usd",
    direction: "neutral",
    window_start: "2021-07-31",
    window_end: "2026-07-31",
    start_value: 1,
    end_value: 1,
    pct_change: 0,
    cagr: null,
    rank: null,
    of: null,
    percentile: null,
    release_id: null,
    source_id: null,
    match_method: null,
    ...fields,
  };
}

function level(metric_id: string, fields: Partial<PacketLevel>): PacketLevel {
  return {
    metric_id,
    label: metric_id,
    unit: "usd",
    direction: "neutral",
    value: 0,
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    rank: null,
    of: null,
    percentile: null,
    release_id: null,
    source_id: null,
    match_method: null,
    ...fields,
  };
}

describe("standOuts", () => {
  it("reads the packet's highlights as leads and lags, with the readings behind each", () => {
    // Mercer on 2026-09-14: permits 1st of 21 by change, HUD's income 20th.
    const metrics = [
      metric("permits_total_units", {
        unit: "count",
        start_value: 538,
        end_value: 2256,
        window_start: "2019-12-31",
        window_end: "2024-12-31",
      }),
      metric("hud_area_median_income", {
        start_value: 108700,
        end_value: 125900,
        window_start: "2020-12-31",
        window_end: "2024-12-31",
      }),
    ];
    const items = standOuts({
      highlights: [
        { metric_id: "permits_total_units", label: "Units permitted", position: "leading", rank: 1, of: 21, pct_change: 319.33 },
        { metric_id: "hud_area_median_income", label: "Area median income", position: "trailing", rank: 20, of: 21, pct_change: 15.82 },
      ],
      metrics,
      levels: [],
    });

    expect(items).toEqual([
      {
        metric_id: "permits_total_units",
        label: "Units permitted",
        group: "leads",
        rank: "1st of 21",
        figure: "+319.3%",
        detail: "538 in 2019, 2,256 in 2024",
      },
      {
        metric_id: "hud_area_median_income",
        label: "Area median income",
        group: "lags",
        rank: "20th of 21",
        figure: "+15.8%",
        detail: "$108,700 in 2020, $125,900 in 2024",
      },
    ]);
  });

  it("finds value extremes the packet does not highlight, leaving out counts that follow size", () => {
    const levels = [
      level("modiv_median_tax_bill", { value: 12238, rank: 1, of: 21 }),
      level("modiv_median_year_built", { unit: "year", value: 1948, rank: 20, of: 21 }),
      level("acs_population", { unit: "count", value: 900000, rank: 1, of: 21 }),
      level("zhvi_sfr", { value: 450000, rank: 14, of: 21 }),
    ];

    const items = standOuts({ highlights: [], metrics: [], levels });

    expect(items.map((item) => [item.metric_id, item.rank, item.figure, item.detail])).toEqual([
      ["modiv_median_tax_bill", "1st of 21", "$12,238", "the highest of 21"],
      ["modiv_median_year_built", "20th of 21", "1948", "the 2nd lowest of 21"],
    ]);
  });

  it("reads a lower-is-better rank from the right end", () => {
    // Rank 1 of a lower-is-better measure is its lowest value.
    const levels = [
      level("unemployment_rate", { unit: "percent", value: 2.9, rank: 1, of: 21, direction: "lower_is_better" }),
    ];

    expect(standOuts({ highlights: [], metrics: [], levels })[0].detail).toBe("the lowest of 21");
  });

  it("needs a cohort of five, as the packet's highlights do", () => {
    const levels = [level("modiv_median_tax_bill", { value: 9000, rank: 1, of: 4 })];

    expect(standOuts({ highlights: [], metrics: [], levels })).toEqual([]);
  });
});
