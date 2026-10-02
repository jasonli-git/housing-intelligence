import { describe, expect, it } from "vitest";

import type { Observation } from "@/lib/api";
import { byYear, constructionYears, fiveYears } from "@/lib/construction";

function year(y: number, value: number, vintage = String(y)): Observation {
  return {
    metric_id: "m",
    period_start: `${y}-01-01`,
    period_end: `${y}-12-31`,
    value,
    source_id: "s",
    vintage,
    match_method: "x",
  };
}

function month(y: number, m: number, value: number): Observation {
  const mm = String(m).padStart(2, "0");
  return { ...year(y, value), period_start: `${y}-${mm}-01`, period_end: `${y}-${mm}-28` };
}

describe("byYear", () => {
  it("sums a whole year of months and leaves out a year still under way", () => {
    const months = [
      ...Array.from({ length: 12 }, (_, i) => month(2024, i + 1, 10)),
      ...Array.from({ length: 7 }, (_, i) => month(2025, i + 1, 10)),
    ];
    const years = byYear(months);
    expect(years.get(2024)).toEqual({ value: 120, preliminary: false });
    expect(years.has(2025)).toBe(false);
  });

  it("marks a year read from a year-to-date report as preliminary", () => {
    expect(byYear([year(2025, 7, "2025-ytd")]).get(2025)).toEqual({ value: 7, preliminary: true });
  });
});

describe("constructionYears and fiveYears", () => {
  const permitted = [2020, 2021, 2022, 2023, 2024, 2025].map((y) => year(y, 100));
  const completed = [
    year(2020, 40), year(2021, 50), year(2023, 60), year(2024, 70), year(2025, 30, "2025-ytd"),
  ];
  const demolished = [year(2020, 5), year(2021, 5), year(2023, 5), year(2024, 10)];
  const net = [year(2020, 35), year(2021, 45), year(2023, 55), year(2024, 60)];
  const rows = constructionYears({ permitted, completed, demolished, net });

  it("keeps a year a town did not report as missing, not zero", () => {
    expect(rows.map((r) => r.year)).toEqual([2025, 2024, 2023, 2021, 2020]);
    expect(rows[0]).toMatchObject({ year: 2025, completed: 30, demolished: null, preliminary: true });
    expect(rows.find((r) => r.year === 2022)).toBeUndefined();
  });

  it("compares five final years, completions over the years reported", () => {
    expect(fiveYears(rows, byYear(permitted))).toEqual({
      first: 2020,
      last: 2024,
      permitted: 500,
      completed: 220,
      demolished: 25,
      net: 195,
      reported: 4,
    });
  });

  it("refuses a window whose permits are not whole", () => {
    expect(fiveYears(rows, byYear(permitted.filter((o) => o.period_end < "2022")))).toBeNull();
  });
});
