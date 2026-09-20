import { describe, expect, it } from "vitest";

import type { PacketLevel } from "@/lib/api";
import { homePrice, MAX_SALE_AGE_MONTHS } from "@/lib/costInputs";

function level(metric_id: string, value: number, period_start: string, period_end: string): PacketLevel {
  return {
    metric_id,
    label: metric_id,
    unit: "usd",
    direction: "neutral",
    value,
    period_start,
    period_end,
    rank: null,
    of: null,
    percentile: null,
    release_id: null,
    source_id: null,
    match_method: null,
  };
}

const ZILLOW = level("zhvi_sfr", 426_786, "2026-07-01", "2026-07-31");
const SOLD = level("sr1a_median_sale_price", 630_000, "2024-01-01", "2026-06-30");
const NOW = "2026-09-20";

describe("homePrice", () => {
  it("prices from Zillow's index when there is one", () => {
    expect(homePrice([ZILLOW, SOLD], NOW)).toEqual({
      basis: "index",
      value: 426_786,
      asOf: "Jul 2026",
    });
  });

  it("falls back to the transaction median only when Zillow has nothing", () => {
    // The point of the fallback: the two are different claims, so the index wins
    // wherever it exists and this is reached only in its absence.
    expect(homePrice([SOLD], NOW)).toEqual({
      basis: "transactions",
      value: 630_000,
      asOf: "Jun 2026",
      from: "Jan 2024",
      to: "Jun 2026",
    });
  });

  it("carries both ends of the window at month precision", () => {
    // A closed window ends on 31 December, which `periodLabel` would shorten to the year
    // alone — "Jan 2023 to 2025" reads as though the ends were measured differently.
    const closed = level("sr1a_median_sale_price", 500_000, "2023-01-01", "2025-12-31");
    const price = homePrice([closed], "2026-03-01");
    expect(price).toMatchObject({ from: "Jan 2023", to: "Dec 2025" });
  });

  it("refuses a transaction median that has gone stale", () => {
    // Silence beats a stale price shown as a current one. One month inside the limit
    // still prices; one month outside does not.
    const inside = homePrice([SOLD], "2027-12-30");
    const outside = homePrice([SOLD], "2028-01-30");
    expect(inside).not.toBeNull();
    expect(outside).toBeNull();
    expect(MAX_SALE_AGE_MONTHS).toBe(18);
  });

  it("is null when neither source can price a mortgage", () => {
    // What makes the page say so, rather than print a card it cannot stand behind.
    expect(homePrice([level("acs_median_home_value", 536_200, "2020-01-01", "2024-12-31")], NOW)).toBeNull();
    expect(homePrice([], NOW)).toBeNull();
  });

  it("never prices from the owner-reported survey value", () => {
    const survey = level("acs_median_home_value", 536_200, "2020-01-01", "2024-12-31");
    expect(homePrice([survey, SOLD], NOW)).toMatchObject({ basis: "transactions" });
  });
});
