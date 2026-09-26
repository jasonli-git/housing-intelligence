import { describe, expect, it } from "vitest";

import type { Summary } from "@/lib/api";
import {
  changeMarginLabel,
  cohortLabel,
  marginLabel,
  rankReading,
  uncertaintiesFrom,
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
    expect(marginLabel(385864, 0, "count", "acs_population")).toBe("± 0");
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
        { metric_id: "acs_median_hh_income", pct_change_margin: 4, rank_best: 3, rank_worst: 20 },
      ],
    } as unknown as Summary;
    const found = uncertaintiesFrom(summary);
    expect(found.value.get("acs_median_hh_income")).toEqual({ margin: 2565, best: 10, worst: 12 });
    expect(found.change.get("acs_median_hh_income")).toEqual({ margin: 4, best: 3, worst: 20 });
    expect(uncertaintiesFrom(null).value.size).toBe(0);
  });
});
