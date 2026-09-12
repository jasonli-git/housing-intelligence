import { describe, expect, it } from "vitest";

import { formatChange, formatMetric, formatValue } from "@/lib/format";

/**
 * These must agree with `format_value` in `src/hip/packets/report.py`. The packet
 * carries a `unit` and each medium formats for itself, so the two implementations are
 * checked against the same expectations rather than against each other.
 */
describe("formatValue", () => {
  it("renders money without cents", () => {
    expect(formatValue(453317.4, "usd")).toBe("$453,317");
    expect(formatValue(2622, "usd_month")).toBe("$2,622");
  });

  it("renders a percentage to one decimal and a ratio to two", () => {
    expect(formatValue(4.5, "percent")).toBe("4.5%");
    expect(formatValue(4.1523, "ratio")).toBe("4.15");
  });

  it("renders a count as a whole number", () => {
    expect(formatValue(383286, "count")).toBe("383,286");
  });

  it("drops a trailing zero on an unrecognised unit", () => {
    expect(formatValue(233, "index")).toBe("233");
    expect(formatValue(233.46, "index")).toBe("233.5");
  });

  it("keeps a negative readable", () => {
    expect(formatValue(-1987, "count")).toBe("-1,987");
  });

  it("renders a year without a thousands separator", () => {
    // MOD-IV's median year built. "1,955" would read as a quantity, not a date.
    expect(formatValue(1955, "year")).toBe("1955");
    expect(formatValue(1955.5, "year")).toBe("1956");
  });

  it("renders acreage with its unit", () => {
    expect(formatValue(0.374, "acres")).toBe("0.37 ac");
  });
});

describe("formatChange", () => {
  it("always carries a sign, because an unsigned change is ambiguous", () => {
    expect(formatChange(37.69)).toBe("+37.7%");
    expect(formatChange(-1.83)).toBe("-1.8%");
    expect(formatChange(0)).toBe("+0.0%");
  });
});

// Every `ratio` metric in the catalog on 2026-09-12.
const RATIO_METRICS = [
  "acs_homeownership_rate", "acs_renter_cost_burden", "acs_vacancy_rate",
  "chas_owner_cost_burden", "chas_renter_cost_burden", "chas_renter_severe_burden",
  "fmr_to_income", "modiv_multifamily_share", "modiv_vacant_land_share",
  "price_to_ami", "price_to_income", "rent_to_income",
];

describe("formatMetric", () => {
  it("shows a share as a percentage", () => {
    expect(formatMetric(0.6189, "ratio", "acs_homeownership_rate")).toBe("61.9%");
    expect(formatMetric(0.2917, "ratio", "rent_to_income")).toBe("29.2%");
  });

  it("shows a multiple with ×", () => {
    expect(formatMetric(4.1258, "ratio", "price_to_income")).toBe("4.13×");
  });

  it("shows monthly money per month", () => {
    expect(formatMetric(1950, "usd_month", "hud_fmr_2br")).toBe("$1,950/mo");
  });

  it("leaves every other unit to formatValue", () => {
    expect(formatMetric(383286, "count", "acs_population")).toBe("383,286");
    expect(formatMetric(450985.2, "usd", "zhvi_sfr")).toBe("$450,985");
  });

  it("classifies every catalogued ratio", () => {
    for (const id of RATIO_METRICS) expect(() => formatMetric(0.5, "ratio", id)).not.toThrow();
  });

  it("refuses a ratio it has not been told how to show", () => {
    expect(() => formatMetric(0.5, "ratio", "something_new")).toThrow(/neither a share nor/);
  });
});
