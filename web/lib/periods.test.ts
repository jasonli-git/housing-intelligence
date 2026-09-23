import { describe, expect, it } from "vitest";

import { periodLabel, surveyYears, windowLabel } from "@/lib/periods";

describe("periodLabel", () => {
  it("names an annual series by its year", () => {
    expect(periodLabel("2023-12-31")).toBe("2023");
    expect(periodLabel("2023-12-31", "acs_population")).toBe("2023");
  });

  it("names a monthly series by month", () => {
    expect(periodLabel("2026-07-31", "zhvi_sfr")).toBe("Jul 2026");
    expect(periodLabel("2021-01-31")).toBe("Jan 2021");
  });

  it("names a monthly series' December reading by month, not by year", () => {
    // Where "Since 2019" starts for Zillow: the reading as 2019 began.
    expect(periodLabel("2018-12-31", "zhvi_sfr")).toBe("Dec 2018");
    expect(periodLabel("2025-12-31", "unemployment_rate")).toBe("Dec 2025");
  });

  it("names a yearly total by its year, whatever its source's cadence", () => {
    // Building permits are published monthly and loaded as yearly totals.
    expect(periodLabel("2024-12-31", "permits_total_units")).toBe("2024");
  });

  it("names a Fair Market Rent by the fiscal year it closes", () => {
    // FY2026 runs 2025-10-01 to 2026-09-30, and a window endpoint is its last day.
    expect(periodLabel("2026-09-30", "hud_fmr_2br")).toBe("FY2026");
  });

  it("names an FHFA index by quarter", () => {
    expect(periodLabel("2026-06-30", "fhfa_hpi")).toBe("Q2 2026");
    expect(periodLabel("2025-12-31", "fhfa_hpi_all_transactions")).toBe("Q4 2025");
  });

  it("never lets a timezone move 31 December into the next year", () => {
    // A `Date` would; a string slice cannot.
    expect(periodLabel("2019-12-31")).toBe("2019");
  });
});

describe("windowLabel", () => {
  it("joins both endpoints in the source's own terms", () => {
    expect(windowLabel("2019-12-31", "2023-12-31", "acs_median_hh_income")).toBe("2019 → 2023");
    expect(windowLabel("2021-07-31", "2026-07-31", "zori_all")).toBe("Jul 2021 → Jul 2026");
    expect(windowLabel("2018-12-31", "2026-07-31", "zhvi_sfr")).toBe("Dec 2018 → Jul 2026");
    expect(windowLabel("2021-09-30", "2026-09-30", "hud_fmr_2br")).toBe("FY2021 → FY2026");
  });
});

describe("surveyYears", () => {
  it("spans the five years an ACS estimate pools", () => {
    expect(surveyYears("2019-01-01", "2023-12-31")).toBe("2019–2023");
  });
});

describe("periodLabel for a weekly benchmark", () => {
  it("names the day, because a week's reading is not the month's", () => {
    expect(periodLabel("2026-09-17", "mortgage_rate_30y_weekly")).toBe("Sep 17, 2026");
  });

  it("leaves the monthly average named by its month", () => {
    expect(periodLabel("2026-08-01", "mortgage_rate_30y")).toBe("Aug 2026");
  });
});
