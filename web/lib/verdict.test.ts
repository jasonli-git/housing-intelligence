import { describe, expect, it } from "vitest";

import type { PacketLevel, PacketMetric } from "@/lib/api";
import {
  housingProfile,
  pace,
  paycheckAnswers,
  paychecks,
  rankBasisExample,
  standing,
  tradeoff,
  verdict,
} from "@/lib/verdict";

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
    period_start: "2026-07-31",
    period_end: "2026-07-31",
    rank: null,
    of: null,
    percentile: null,
    release_id: null,
    source_id: null,
    match_method: null,
    ...fields,
  };
}

const COUNTY = { name: "Mercer County", count: 21, noun: "counties", scope: "New Jersey" };
const TOWN = { name: "Princeton", count: 564, noun: "municipalities", scope: "New Jersey" };

describe("standing", () => {
  it("reads a value rank as price, from whichever end is nearer", () => {
    expect(standing(1, 21)).toBe("the most expensive");
    expect(standing(2, 21)).toBe("the 2nd most expensive");
    expect(standing(11, 21)).toBe("the 11th most expensive");
    expect(standing(14, 21)).toBe("the 8th least expensive");
    expect(standing(21, 21)).toBe("the least expensive");
  });
});

describe("pace", () => {
  it("reads a change rank in fifths of the cohort", () => {
    expect(pace(1, 21)).toBe("faster than almost all");
    expect(pace(9, 21)).toBe("faster than most");
    expect(pace(11, 21)).toBe("at about the typical pace");
    expect(pace(14, 21)).toBe("more slowly than most");
    expect(pace(21, 21)).toBe("more slowly than almost all");
  });
});

describe("verdict", () => {
  it("states price and pace, and says which rank each is", () => {
    // Mercer on 2026-09-13: 14th of 21 by value, 9th of 21 by five-year rise.
    const metrics = [metric("zhvi_sfr", { pct_change: 35.83, rank: 9, of: 21 })];
    const levels = [level("zhvi_sfr", { value: 450985.169, rank: 14, of: 21 })];

    expect(verdict(COUNTY, metrics, levels)).toBe(
      "Mercer County is the 8th least expensive of New Jersey’s 21 counties, by typical " +
        "single-family home value ($450,985), but its value rose faster than most over " +
        "five years (+35.8%, 9th of 21 by change).",
    );
  });

  it("joins with 'and' when price and pace agree", () => {
    const metrics = [metric("zhvi_sfr", { pct_change: 40, rank: 2, of: 21 })];
    const levels = [level("zhvi_sfr", { value: 800000, rank: 3, of: 21 })];

    expect(verdict(COUNTY, metrics, levels)).toContain(
      "the 3rd most expensive of New Jersey’s 21 counties",
    );
    expect(verdict(COUNTY, metrics, levels)).toContain(", and its value rose faster than almost all");
  });

  it("names the cohort when it is smaller than the level", () => {
    const levels = [level("zhvi_sfr", { value: 979904.815, rank: 77, of: 388 })];

    expect(verdict(TOWN, [], levels)).toBe(
      "Princeton is the 77th most expensive of the 388 New Jersey municipalities Zillow " +
        "covers, by typical single-family home value ($979,905).",
    );
  });

  it("falls back to the ACS home value where Zillow has none", () => {
    const levels = [level("acs_median_home_value", { value: 1040400, rank: 27, of: 561 })];

    expect(verdict(TOWN, [], levels)).toContain("by median owner-reported home value ($1,040,400)");
  });

  it("says a fall plainly", () => {
    const metrics = [metric("zhvi_sfr", { pct_change: -3.2, rank: 20, of: 21 })];
    const levels = [level("zhvi_sfr", { value: 300000, rank: 18, of: 21 })];

    expect(verdict(COUNTY, metrics, levels)).toContain(
      ", and its value fell 3.2% over five years (20th of 21 by change).",
    );
  });

  it("is absent without a ranked home value", () => {
    expect(verdict(COUNTY, [], [level("zhvi_sfr", { value: 1 })])).toBeNull();
  });
});

describe("paychecks", () => {
  const years = { window_start: "2019-12-31", window_end: "2023-12-31", unit: "ratio" };

  it("compares prices with incomes over the same years", () => {
    const metrics = [
      metric("price_to_income", { ...years, start_value: 3.423, end_value: 4.126 }),
      metric("rent_to_income", { ...years, start_value: 0.256, end_value: 0.292 }),
    ];

    expect(paychecks(metrics)).toBe(
      "From 2019 to 2023, the typical home went from 3.42× to 4.13× the typical household " +
        "income here: home values outpaced incomes. A year’s typical rent went from 25.6% " +
        "to 29.2% of income: rents outpaced incomes.",
    );
  });

  it("calls a move under two percent even, and an income gain a gain", () => {
    expect(
      paychecks([metric("price_to_income", { ...years, start_value: 4, end_value: 4.05 })]),
    ).toContain("home values and incomes moved about in step");
    expect(
      paychecks([metric("price_to_income", { ...years, start_value: 4.765, end_value: 4.483 })]),
    ).toContain("incomes outpaced home values");
  });

  it("gives rent its own years when they differ", () => {
    const metrics = [
      metric("price_to_income", { ...years, start_value: 3, end_value: 3.5 }),
      metric("rent_to_income", { ...years, window_start: "2020-12-31", start_value: 0.3, end_value: 0.3 }),
    ];

    expect(paychecks(metrics)).toContain("of income (from 2020 to 2023): rents and incomes");
  });

  it("is absent without price-to-income", () => {
    expect(paychecks([metric("rent_to_income", years)])).toBeNull();
  });
});

describe("paycheckAnswers", () => {
  const years = { window_start: "2019-12-31", window_end: "2023-12-31", unit: "ratio" };

  it("answers homes and rent apart, by the paychecks rule", () => {
    const metrics = [
      metric("price_to_income", { ...years, start_value: 3.423, end_value: 4.126 }),
      metric("rent_to_income", { ...years, start_value: 0.3, end_value: 0.29 }),
    ];

    expect(paycheckAnswers(metrics)).toEqual({ homes: "No", rent: "Yes" });
  });

  it("calls a move under two percent about even, and answers homes alone without rent", () => {
    expect(
      paycheckAnswers([metric("price_to_income", { ...years, start_value: 4, end_value: 4.05 })]),
    ).toEqual({ homes: "About even", rent: null });
  });

  it("is absent without price-to-income", () => {
    expect(paycheckAnswers([metric("rent_to_income", years)])).toBeNull();
  });
});

describe("housingProfile", () => {
  it("lists what the region has, in a fixed order", () => {
    const levels = [
      level("permits_total_units", { unit: "count", value: 205, period_end: "2024-12-31" }),
      level("acs_homeownership_rate", { unit: "ratio", value: 0.56 }),
      level("modiv_median_year_built", { unit: "year", value: 1958 }),
      level("modiv_multifamily_share", { unit: "ratio", value: 0.012 }),
      level("modiv_median_lot_acres", { unit: "acres", value: 0.46 }),
    ];

    const profile = housingProfile(levels);

    expect(profile.map((item) => [item.label, item.value])).toEqual([
      ["Typical home built", "1958"],
      ["Median lot", "0.46 acres"],
      ["Households that own", "56.0%"],
      ["Apartment buildings", "1.2%"],
      ["Homes permitted in 2024", "205"],
    ]);
    // Every item says what was counted, because a short label cannot.
    expect(profile.every((item) => item.definition.length > 40)).toBe(true);
  });

  it("places each figure among its peers, and gives people their change", () => {
    const levels = [
      level("modiv_median_year_built", { unit: "year", value: 1960, rank: 13, of: 21 }),
      level("acs_homeownership_rate", { unit: "ratio", value: 0.619, rank: 17, of: 21 }),
      level("modiv_multifamily_share", { unit: "ratio", value: 0.005, rank: 6, of: 21 }),
      level("acs_vacancy_rate", { unit: "ratio", value: 0.061, rank: 11, of: 21 }),
      level("acs_population", {
        unit: "count",
        value: 383286,
        period_start: "2019-01-01",
        period_end: "2023-12-31",
      }),
    ];
    const metrics = [
      metric("acs_population", {
        unit: "count",
        pct_change: 4.18,
        window_start: "2018-12-31",
        window_end: "2023-12-31",
      }),
    ];

    const context = Object.fromEntries(
      housingProfile(levels, metrics).map((item) => [item.label, item.context]),
    );

    expect(context).toEqual({
      "Typical home built": "older than most · 13th of 21",
      "Households that own": "fewer than most · 17th of 21",
      "Apartment buildings": "more than most · 6th of 21",
      "Homes standing empty": "near the middle · 11th of 21",
      People: "up 4.2%, 2018 to 2023",
    });
  });

  it("is empty when the region has none of them", () => {
    expect(housingProfile([level("zhvi_sfr", { value: 1 })])).toEqual([]);
  });
});

describe("rankBasisExample", () => {
  it("sets one figure's two ranks side by side", () => {
    const metrics = [metric("zhvi_sfr", { rank: 9, of: 21 })];
    const levels = [level("zhvi_sfr", { rank: 14, of: 21 })];

    expect(rankBasisExample("Mercer County", metrics, levels)).toBe(
      "Mercer County’s typical single-family home value is 9th of 21 by its five-year " +
        "rise and 14th of 21 by value.",
    );
  });

  it("is absent without both ranks", () => {
    expect(rankBasisExample("X", [], [level("zhvi_sfr", { rank: 1, of: 2 })])).toBeNull();
  });
});

describe("tradeoff", () => {
  const bill = (rank: number, value: number) =>
    level("modiv_median_tax_bill", { value, rank, of: 21 });

  it("names a high tax bill behind cheaper homes", () => {
    const levels = [level("zhvi_sfr", { value: 400000, rank: 15, of: 21 }), bill(2, 12038.4)];

    expect(tradeoff(COUNTY, levels)).toBe(
      "Homes here cost less than in most counties, but the typical property tax bill, " +
        "$12,038 a year, is the 2nd highest of 21.",
    );
  });

  it("names a low tax bill behind dearer homes", () => {
    const levels = [level("zhvi_sfr", { value: 700000, rank: 3, of: 21 }), bill(19, 6022)];

    expect(tradeoff(COUNTY, levels)).toBe(
      "Homes here cost more than in most counties, but the typical property tax bill, " +
        "$6,022 a year, is the 3rd lowest of 21.",
    );
  });

  it("says 'the highest' for rank 1", () => {
    const levels = [level("zhvi_sfr", { value: 1, rank: 20, of: 21 }), bill(1, 12238)];

    expect(tradeoff(COUNTY, levels)).toContain("is the highest of 21.");
  });

  it("stays silent when price and tax do not pull apart", () => {
    // Mercer on 2026-09-13: 14th of 21 by home value, 12th by tax bill.
    const levels = [level("zhvi_sfr", { value: 450985, rank: 14, of: 21 }), bill(12, 7791)];

    expect(tradeoff(COUNTY, levels)).toBeNull();
  });

  it("is absent without a tax bill", () => {
    expect(tradeoff(COUNTY, [level("zhvi_sfr", { value: 1, rank: 20, of: 21 })])).toBeNull();
  });
});
