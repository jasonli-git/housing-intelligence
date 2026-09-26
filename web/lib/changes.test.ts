import { describe, expect, it } from "vitest";

import type { RevisedPlace, RevisionGroup } from "@/lib/api";
import {
  changeLabel,
  otherPeriods,
  periodSpan,
  placeName,
  revisedValue,
  sizeLabel,
  summaryLine,
} from "@/lib/changes";

function place(fields: Partial<RevisedPlace>): RevisedPlace {
  return {
    region_id: 1,
    name: "X",
    level: "municipality",
    county: null,
    has_page: true,
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    old_value: 1,
    new_value: 2,
    change: 1,
    periods: 1,
    ...fields,
  };
}

function group(fields: Partial<RevisionGroup>): RevisionGroup {
  return {
    metric_id: "zhvi_sfr",
    label: "Home value index, single-family",
    unit: "usd",
    frequency: "monthly",
    source_id: "zillow_zhvi",
    under_way: false,
    figures: 1,
    places: 1,
    earliest_period: "2026-01-31",
    latest_period: "2026-01-31",
    rose: 1,
    fell: 0,
    median_change: 0.01,
    largest: [],
    ...fields,
  };
}

describe("placeName", () => {
  it("names a place the way the rest of the site does, with its county", () => {
    expect(placeName(place({ name: "Margate City", county: "Atlantic" }))).toBe(
      "Margate City, Atlantic County",
    );
    expect(placeName(place({ name: "08402", level: "zip" }))).toBe("ZIP 08402");
    expect(placeName(place({ name: "Hudson", level: "county" }))).toBe("Hudson County");
    // A region since removed keeps the id the API labels it by.
    expect(placeName(place({ name: "region -1", level: null }))).toBe("region -1");
  });
});

describe("periodSpan", () => {
  it("labels periods by their ends, one label when there is one period", () => {
    expect(periodSpan(group({ earliest_period: "2000-01-31", latest_period: "2026-07-31" }))).toBe(
      "Jan 2000 – Jul 2026",
    );
    expect(
      periodSpan(
        group({
          metric_id: "price_to_income",
          earliest_period: "2019-12-31",
          latest_period: "2024-12-31",
        }),
      ),
    ).toBe("2019 – 2024");
    expect(periodSpan(group({}))).toBe("Jan 2026");
  });
});

describe("otherPeriods", () => {
  it("counts a place's other revised periods in its metric's own unit", () => {
    expect(otherPeriods(place({ periods: 30 }), "monthly")).toBe("and 29 other months");
    expect(otherPeriods(place({ periods: 2 }), "annual")).toBe("and 1 other year");
    expect(otherPeriods(place({ periods: 3 }), null)).toBe("and 2 other periods");
    expect(otherPeriods(place({ periods: 1 }), "monthly")).toBe("");
  });
});

describe("summaryLine", () => {
  it("says how many moved, where, when, which way and by how much", () => {
    expect(
      summaryLine(
        group({
          figures: 294469,
          places: 955,
          earliest_period: "2000-01-31",
          latest_period: "2026-07-31",
          rose: 22944,
          fell: 271525,
          median_change: 0.0106,
        }),
      ),
    ).toBe(
      "294,469 figures across 955 places, Jan 2000 – Jul 2026: " +
        "271,525 revised down and 22,944 up, typically by 1.1%.",
    );
  });

  it("does not call a single figure typical", () => {
    expect(summaryLine(group({ figures: 1, rose: 1 }))).toBe(
      "1 figure across 1 place, Jan 2026: revised up.",
    );
  });

  it("says all when every figure moved the same way", () => {
    expect(summaryLine(group({ figures: 105, places: 21, rose: 0, fell: 105 }))).toContain(
      ": all revised down, typically by 1.0%.",
    );
  });
});

describe("sizeLabel", () => {
  it("never rounds a real move to zero", () => {
    expect(sizeLabel(-0.4597)).toBe("46.0%");
    expect(sizeLabel(0.0004)).toBe("less than 0.1%");
  });
});

describe("revisedValue and changeLabel", () => {
  it("formats values as the site does, with rates to the hundredth", () => {
    expect(revisedValue(83024.39, group({}))).toBe("$83,024");
    expect(revisedValue(6.81, group({ unit: "percent", metric_id: "mortgage_rate_30y" }))).toBe(
      "6.81%",
    );
    expect(revisedValue(0.2205, group({ unit: "ratio", metric_id: "rent_to_income" }))).toBe(
      "22.1%",
    );
    expect(revisedValue(null, group({}))).toBe("—");
  });

  it("gives the change relative to the earlier value", () => {
    expect(changeLabel(place({ change: -0.4597 }))).toBe("-46.0%");
    expect(changeLabel(place({ change: 0.0649 }))).toBe("+6.5%");
    expect(changeLabel(place({ change: null }))).toBe("—");
  });
});
