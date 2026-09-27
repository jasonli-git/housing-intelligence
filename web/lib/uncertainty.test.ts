import { describe, expect, it } from "vitest";

import type { Summary } from "@/lib/api";
import {
  changeMargin,
  changeMarginLabel,
  cohortLabel,
  marginLabel,
  rankRanges,
  rankReading,
  uncertaintiesFrom,
  withMargin,
} from "@/lib/uncertainty";

const counties = { count: 21, noun: "counties", scope: "New Jersey" };
const towns = { count: 564, noun: "municipalities", scope: "New Jersey" };

describe("cohortLabel", () => {
  it("names the cohort, and says so when fewer regions carry the figure", () => {
    expect(cohortLabel(21, counties)).toBe("21 NJ counties");
    expect(cohortLabel(551, towns)).toBe("551 NJ municipalities with data");
  });
});

describe("rankReading", () => {
  const cohort = "21 NJ counties";

  it("reads a rank with no margins, or a range of one place, as a place", () => {
    expect(rankReading(3, 21, undefined, cohort)).toEqual({
      lead: "3rd of 21 NJ counties",
      range: null,
    });
    expect(rankReading(6, 21, { margin: 1, best: 6, worst: 6 }, cohort).lead).toBe(
      "6th of 21 NJ counties",
    );
  });

  it("leads an uncertain rank with where its range sits, and gives the range", () => {
    expect(rankReading(12, 21, { margin: 1, best: 10, worst: 12 }, cohort)).toEqual({
      lead: "Near the middle of 21 NJ counties",
      range: "between 10th and 12th",
    });
    expect(rankReading(2, 21, { margin: 1, best: 1, worst: 3 }, cohort).lead).toBe(
      "Near the top of 21 NJ counties",
    );
    expect(rankReading(20, 21, { margin: 1, best: 19, worst: 21 }, cohort).lead).toBe(
      "Near the bottom of 21 NJ counties",
    );
    expect(rankReading(4, 21, { margin: 1, best: 2, worst: 9 }, cohort).lead).toBe(
      "Toward the top of 21 NJ counties",
    );
    expect(rankReading(16, 21, { margin: 1, best: 12, worst: 19 }, cohort).lead).toBe(
      "Toward the bottom of 21 NJ counties",
    );
    // Mercer's five-year income growth: 12th, and anywhere from 3rd to 20th.
    expect(rankReading(12, 21, { margin: 1, best: 3, worst: 20 }, cohort).lead).toBe(
      "Can’t be told apart from most of 21 NJ counties",
    );
  });

  it("will not place a figure whose range is the whole cohort", () => {
    expect(
      rankReading(40, 564, { margin: null, best: 1, worst: 564 }, "564 NJ municipalities"),
    ).toEqual({
      lead: "Too uncertain to place among 564 NJ municipalities",
      range: null,
    });
  });
});

describe("marginLabel", () => {
  it("states a margin in the figure's own terms", () => {
    expect(marginLabel(100645, 2565, "usd", "acs_median_hh_income")).toBe("± $2,565");
    expect(marginLabel(1623, 34, "usd_month", "acs_median_gross_rent")).toBe("± $34/mo");
    expect(marginLabel(0.5008, 0.0231, "ratio", "acs_renter_cost_burden")).toBe("± 2.3 points");
    expect(marginLabel(4.05, 0.12, "ratio", "price_to_income")).toBe("± 0.12×");
    expect(marginLabel(385864, 0, "count", "acs_population")).toBe("no sampling error");
  });

  it("gives a share's range where the margin would pass 0% or 100%", () => {
    expect(marginLabel(0.12, 0.28, "ratio", "acs_renter_cost_burden")).toBe("0.0% to 40.0%");
    expect(marginLabel(0.95, 0.1, "ratio", "acs_homeownership_rate")).toBe("85.0% to 100.0%");
  });

  it("says nothing where the source publishes no margin", () => {
    expect(marginLabel(445077, null, "usd", "zhvi_sfr")).toBeNull();
    expect(changeMarginLabel(null)).toBeNull();
    expect(changeMarginLabel(4.02)).toBe("± 4.0%");
  });
});

describe("uncertaintiesFrom", () => {
  it("looks up values and changes by metric, and is empty without a summary", () => {
    const summary = {
      levels: [
        { metric_id: "acs_median_hh_income", margin_of_error: 2565, rank_best: 10, rank_worst: 12 },
      ],
      headlines: [
        {
          metric_id: "acs_median_hh_income",
          pct_change_margin: 4,
          rank_best: 3,
          rank_worst: 20,
          start_margin: 1990,
          end_margin: 2565,
        },
      ],
    } as unknown as Summary;
    const found = uncertaintiesFrom(summary);
    expect(found.value.get("acs_median_hh_income")).toEqual({ margin: 2565, best: 10, worst: 12 });
    expect(found.change.get("acs_median_hh_income")).toEqual({
      margin: 4,
      best: 3,
      worst: 20,
      start: 1990,
      end: 2565,
    });
    expect(uncertaintiesFrom(null).value.size).toBe(0);
  });
});

describe("withMargin", () => {
  it("runs a figure and its margin together, a clipped share's range in brackets", () => {
    expect(withMargin("$100,645", "± $2,565")).toBe("$100,645 ± $2,565");
    expect(withMargin("12.0%", "0.0% to 40.0%")).toBe("12.0% (0.0% to 40.0%)");
    expect(withMargin("$1,500", null)).toBe("$1,500");
  });
});

describe("changeMargin", () => {
  it("is the warehouse's ratio formula, and null without both ends' margins", () => {
    // 100 · sqrt(2565² + (100645/81000)² · 1990²) / 81000
    expect(changeMargin(81000, 100645, 1990, 2565)).toBeCloseTo(4.4, 2);
    expect(changeMargin(81000, 100645, null, 2565)).toBeNull();
    expect(changeMargin(0, 1, 1, 1)).toBeNull();
  });
});

describe("rankRanges", () => {
  it("moves a region past another only where the Census's test finds a difference", () => {
    const values = { a: 100, b: 98, c: 50 };
    const margins = { a: 3, b: 3, c: 3 };
    const ranges = rankRanges(values, margins, "higher_is_better");
    // a and b differ by 2, inside sqrt(3² + 3²) ≈ 4.2: either could be first.
    expect(ranges.get("a")).toEqual({ best: 1, worst: 2 });
    expect(ranges.get("b")).toEqual({ best: 1, worst: 2 });
    expect(ranges.get("c")).toEqual({ best: 3, worst: 3 });
  });

  it("gives a region with no margin the whole list, and nothing without margins", () => {
    const values = { a: 100, b: 50, c: 10 };
    const ranges = rankRanges(values, { a: 1, c: 1 }, "higher_is_better");
    expect(ranges.get("b")).toEqual({ best: 1, worst: 3 });
    expect(ranges.get("a")).toEqual({ best: 1, worst: 2 });
    expect(rankRanges(values, undefined, "higher_is_better").size).toBe(0);
  });

  it("reads lower-is-better from the small end", () => {
    const ranges = rankRanges({ a: 1, b: 10 }, { a: 1, b: 1 }, "lower_is_better");
    expect(ranges.get("a")).toEqual({ best: 1, worst: 1 });
  });
});

describe("a survey figure without a margin (SPEC principle 12)", () => {
  it("says so, where any other source's figure stays bare", () => {
    expect(marginLabel(0.42, null, "ratio", "chas_renter_cost_burden")).toBe("no margin available");
    expect(marginLabel(450985, null, "usd", "zhvi_sfr")).toBeNull();
    expect(changeMarginLabel(null, "acs_median_hh_income")).toBe("no margin available");
    expect(changeMarginLabel(null, "zhvi_sfr")).toBeNull();
    expect(changeMarginLabel(null)).toBeNull();
  });
});

describe("a controlled estimate", () => {
  it("says it has no sampling error, not ± 0", () => {
    // Mercer's population: the Census controls county totals to its estimates (-555555555).
    expect(marginLabel(387340, 0, "count", "acs_population")).toBe("no sampling error");
    expect(changeMarginLabel(0, "acs_population")).toBe("no sampling error");
    expect(withMargin("387,340", marginLabel(387340, 0, "count", "acs_population"))).toBe(
      "387,340 (no sampling error)",
    );
  });
});
