import { describe, expect, it } from "vitest";

import { firstYear, openingYear, selectableYears, since, sinceLine, yearsNote } from "@/lib/since";

const monthly = (year: number, m: number, value: number) => {
  const mm = String(m).padStart(2, "0");
  return { period_start: `${year}-${mm}-01`, period_end: `${year}-${mm}-28`, value };
};
const annual = (year: number, value: number) => ({
  period_start: `${year - 4}-01-01`,
  period_end: `${year}-12-31`,
  value,
});

describe("since", () => {
  it("reads a monthly series at the latest reading's month", () => {
    const points = [monthly(2016, 1, 90), monthly(2016, 7, 100), monthly(2016, 12, 110), monthly(2026, 7, 150)];

    const result = since(points, 2016);

    expect(result?.from.value).toBe(100);
    expect(result?.to.value).toBe(150);
    expect(result?.pct).toBeCloseTo(50);
  });

  it("falls back to the nearest month in the year", () => {
    const points = [monthly(2015, 1, 80), monthly(2015, 12, 120), monthly(2026, 7, 200)];

    // July is nearer December (5 months) than January (6).
    expect(since(points, 2015)?.from.value).toBe(120);
  });

  it("reads an annual series by the year its estimate ends", () => {
    const points = [annual(2019, 80000), annual(2023, 96000)];

    expect(since(points, 2019)?.pct).toBeCloseTo(20);
  });

  it("says nothing for a year the series does not reach, or the latest year", () => {
    const points = [annual(2019, 80000), annual(2023, 96000)];

    expect(since(points, 2016)).toBeNull();
    expect(since(points, 2023)).toBeNull();
  });
});

describe("selectableYears", () => {
  it("offers every year before the latest that any series reaches, newest first", () => {
    const years = selectableYears([
      [monthly(2016, 7, 1), monthly(2026, 7, 2)],
      [annual(2019, 1), annual(2023, 2)],
    ]);

    expect(years).toEqual([2023, 2019, 2016]);
  });
});

describe("sinceLine", () => {
  const home = { metricId: "zhvi_sfr", label: "Home value", unit: "usd" };

  it("says both readings, when each is from, and the change", () => {
    const points = [
      { period_start: "2016-07-01", period_end: "2016-07-31", value: 332020.88 },
      { period_start: "2026-07-01", period_end: "2026-07-31", value: 450985.17 },
    ];

    expect(sinceLine({ ...home, points }, 2016).text).toBe(
      "$332,021 in Jul 2016, $450,985 in Jul 2026: up 35.8%",
    );
  });

  it("says why a year has no reading", () => {
    const income = { metricId: "acs_median_hh_income", label: "Income", unit: "usd", points: [annual(2019, 1), annual(2023, 2)] };

    expect(sinceLine(income, 2016).text).toBe("no reading for 2016; the series begins in 2019");
  });
});

describe("openingYear", () => {
  const years = Array.from({ length: 26 }, (_, i) => 2025 - i); // 2025 … 2000, newest first

  it("opens where every series has a reading, when that is later than ten years back", () => {
    // Home values from 2000, rent from 2015, income from 2019: every chart shows at 2019.
    const series = [[monthly(2000, 1, 1)], [monthly(2015, 1, 1)], [annual(2019, 1)]];
    expect(openingYear(series, years)).toBe(2019);
  });

  it("opens ten years back when every series reaches that far", () => {
    expect(openingYear([[monthly(2000, 1, 1)]], years)).toBe(2016);
  });

  it("falls back to the newest year when no year is late enough", () => {
    expect(openingYear([[annual(2030, 1)]], years)).toBe(2025);
  });
});

describe("firstYear", () => {
  it("is the earliest year a series reaches", () => {
    expect(firstYear([annual(2023, 1), annual(2019, 1)])).toBe(2019);
    expect(firstYear([])).toBeNull();
  });
});

describe("yearsNote", () => {
  const points = (...years: number[]) => years.map((y) => ({ period_end: `${y}-07-31`, value: 1 }));

  it("says where the years begin and which series start later", () => {
    expect(
      yearsNote([
        { short: "home values", points: points(2000, 2026) },
        { short: "rent", points: points(2015, 2026) },
        { short: "household income", points: points(2019, 2023) },
      ]),
    ).toBe(
      "Years go back to 2000, where the home values series begins; rent begins in 2015 and " +
        "household income in 2019, so earlier years show only the charts that reach them.",
    );
  });

  it("is absent when every series begins in the same year", () => {
    expect(
      yearsNote([
        { short: "rent", points: points(2019, 2026) },
        { short: "household income", points: points(2019, 2025) },
      ]),
    ).toBeNull();
  });
});
