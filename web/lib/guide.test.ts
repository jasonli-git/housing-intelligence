import { describe, expect, it } from "vitest";

import type { Observation, PacketLevel } from "./api";
import { eachMonth } from "./ownership";
import { ownershipInputs } from "./budgetScenario";
import {
  affordAnswer,
  bandOf,
  breakEvenYear,
  checklist,
  type GuideData,
  RADON,
  rentOrBuy,
  turnoverPicture,
} from "./guide";

function level(metric_id: string, value: number, extra: Partial<PacketLevel> = {}): PacketLevel {
  return {
    metric_id, label: metric_id, unit: "usd", direction: "neutral", value,
    period_start: "2024-01-01", period_end: "2024-12-31", rank: null, of: null, percentile: null,
    release_id: 1, source_id: "src", match_method: "fips", ...extra,
  };
}

function turnover(start: string, end: string, value: number): Observation {
  return { metric_id: "sr1a_turnover_per_1000", period_start: start, period_end: end, value, source_id: "hip_derived", vintage: "x", match_method: "derived" };
}

const NOW = "2026-10-07";

function place(levels: PacketLevel[], more: Partial<GuideData> = {}): GuideData {
  return {
    region: { region_id: 7, geoid: "3401730000", level: "municipality", name: "Hoboken", label: "Hoboken, NJ", state_code: "NJ", parent: { region_id: 3, name: "Hudson", level: "county" } },
    levels,
    countyLevels: [level("hud_fha_limit_1unit", 600_000, { period_end: "2026-12-31" })],
    sources: [{ source_id: "zillow", name: "Zillow Home Value Index", publisher: "Zillow", license: "", url: "", vintage: "", fetched_at: "", release_ids: [] }],
    incomeLimits: null,
    turnover: [],
    water: null,
    community: null,
    utilities: null,
    newest: {},
    ...more,
  };
}

const typical = [
  level("zhvi_sfr", 500_000, { source_id: "zillow", match_method: "name_county", period_end: "2026-08-31" }),
  level("modiv_median_tax_bill", 12_000, { match_method: "nj_cd_code" }),
  level("acs_median_home_insurance", 1_800, { survey: true, margin_of_error: 200 }),
  level("acs_median_electricity", 150, { survey: true, margin_of_error: 10 }),
  level("zori_all", 2_800, { period_end: "2026-08-31", match_method: "name_county" }),
];

describe("can I afford to buy here?", () => {
  it("bands a monthly cost by HUD's 30% and 50% lines, a share exactly on a line within it", () => {
    expect(bandOf(0.3)).toBe("within");
    expect(bandOf(0.31)).toBe("burdened");
    expect(bandOf(0.5)).toBe("burdened");
    expect(bandOf(0.51)).toBe("severe");
  });

  it("is the site's own cost of owning as a share of the reader's income", () => {
    const answer = affordAnswer(place(typical), { income: 150_000, size: 3, ratePct: 6.5, personal: { downPct: 20 }, now: NOW })!;
    const expected = eachMonth(ownershipInputs({ price: 500_000, ratePct: 6.5, taxYear: 12_000, insuranceYear: 1_800, utilitiesMonth: 150, rentMonth: 2_800 }, { downPct: 20 }));
    expect(answer.month.total).toBeCloseTo(expected.total);
    expect(answer.share).toBeCloseTo(expected.total / 12_500);
    expect(answer.band).toBe(bandOf(answer.share));
    expect(answer.evidence.strength).toBe("strong");
  });

  it("checks an FHA loan against the county's limit", () => {
    const answer = affordAnswer(place(typical), { income: 150_000, size: 3, ratePct: 6.5, personal: { downPct: 3.5 }, now: NOW })!;
    // $500,000 less 3.5% is $482,500, under the county's $600,000.
    expect(answer.fha).toMatchObject({ limit: 600_000, base: 482_500, over: false });
  });

  it("gives no answer without a price, and a limited one without a tax bill", () => {
    expect(affordAnswer(place(typical.slice(1)), { income: 150_000, size: 3, ratePct: 6.5, personal: {}, now: NOW })).toBeNull();
    const noTax = affordAnswer(place(typical.filter((l) => l.metric_id !== "modiv_median_tax_bill")), { income: 150_000, size: 3, ratePct: 6.5, personal: {}, now: NOW })!;
    expect(noTax.evidence).toMatchObject({ strength: "limited", reasons: ["no property tax figure for this place"] });
  });
});

describe("should I rent or buy?", () => {
  it("finds the first year owning then selling costs no more than renting", () => {
    const base = ownershipInputs({ price: 500_000, ratePct: 6.5, taxYear: 12_000, insuranceYear: 1_800, utilitiesMonth: 150, rentMonth: 4_500 }, { appreciationPct: 4 });
    const year = breakEvenYear(base);
    expect(year).not.toBeNull();
    // Renting is still cheaper the year before.
    expect(breakEvenYear({ ...base, rentMonth: 4_500 }, year! - 1)).toBeNull();
    // A cheap rent and flat prices never break even.
    expect(breakEvenYear({ ...base, rentMonth: 1_000, appreciationPct: 0 })).toBeNull();
  });

  it("uses the reader's rent over the published one, and leaves it out of the evidence", () => {
    const choice = rentOrBuy(place(typical), { ratePct: 6.5, personal: { years: 10 }, rent: 3_500, now: NOW })!;
    expect(choice).toMatchObject({ rent: 3_500, ownRent: true });
    expect(choice.planned.years).toBe(10);
    expect(rentOrBuy(place(typical), { ratePct: 6.5, personal: {}, now: NOW })!.rent).toBe(2_800);
  });
});

describe("market turnover", () => {
  it("places the newest window among the place's own since 2020", () => {
    const series = [
      turnover("2020-01-01", "2022-12-31", 60),
      turnover("2021-01-01", "2023-12-31", 56),
      turnover("2024-01-01", "2026-06-30", 35.5),
    ];
    expect(turnoverPicture(series, [])).toMatchObject({ low: 35.5, high: 60, position: "lowest" });
    expect(turnoverPicture(series.slice(0, 1), [])?.position).toBe("only");
    expect(turnoverPicture([], [])).toBeNull();
  });
});

describe("what should I check before an offer?", () => {
  const items = checklist(
    place([...typical, level("fema_flood_homes_share", 0.42), level("fema_mapped_homes_share", 1), level("nj_revaluation_year", 2019)], {
      turnover: [turnover("2020-01-01", "2022-12-31", 60), turnover("2024-01-01", "2026-06-30", 35.5)],
    }),
    { place: "/regions/7", tax: "/tax?town=3401730000" },
  );

  it("covers every item the milestone names, radon always with its test advice", () => {
    expect(items.map((i) => i.key)).toEqual([
      "flood", "water", "sites", "radon", "utilities", "tax", "school", "commute", "turnover", "mortgage",
    ]);
    expect(items.find((i) => i.key === "radon")).toBe(RADON);
    expect(RADON.finding).toContain("recommends testing every home");
    expect(RADON.evidence).toBeNull();
  });

  it("states what is published, and says so where nothing is", () => {
    expect(items.find((i) => i.key === "flood")!.finding).toBe("42% of homes here are in FEMA’s high-risk flood zone.");
    expect(items.find((i) => i.key === "tax")!.finding).toContain("last brought back to market value in 2019");
    expect(items.find((i) => i.key === "turnover")!.finding).toContain("the lowest rate here since 2020");
    const school = items.find((i) => i.key === "school")!;
    expect(school.finding).toBe("No school district is published for this place.");
    expect(school.evidence?.strength).toBe("limited");
  });

  it("gives every item an official next step", () => {
    for (const item of items) expect(item.steps.length).toBeGreaterThan(0);
  });

  it("withholds a flood share where FEMA's digital map covers too few homes", () => {
    const [flood] = checklist(place([level("fema_flood_homes_share", 0.1), level("fema_mapped_homes_share", 0.5)]), { place: "/", tax: "/tax" });
    expect(flood.finding).toBe("FEMA’s digital flood map covers 50% of homes here, too few to say what share is in a flood zone.");
  });
});
