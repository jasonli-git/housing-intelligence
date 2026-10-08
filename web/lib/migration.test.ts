import { describe, expect, it } from "vitest";

import type { Migration, MigrationYear } from "./api";
import { incomeSentence, latestYear, movesSentence, whose } from "./migration";

const year: MigrationYear = {
  year: 2023, inflow_returns: 29_898, outflow_returns: 31_040, net_returns: -1_142, net_per_1000: -3.703,
  inflow_income: 109_007, outflow_income: 133_226, stayer_income: 104_598, arrival_income_ratio: 1.042,
};

const hudson: Migration = {
  region_id: 344, county_id: 3, county_name: "Hudson", via: "parent",
  years: [{ ...year, year: 2022, inflow_returns: 28_000 }, year, { ...year, year: 2024, outflow_returns: null }],
  flows_year: 2023, arrivals: [], departures: [], fetched_at: null, source: "IRS",
};

describe("who is moving here", () => {
  it("reads the newest year with moves both ways", () => {
    expect(latestYear(hudson)?.year).toBe(2023);
  });

  it("says the balance as a gain or a loss, with its rate", () => {
    expect(movesSentence(year, "Hudson County")).toBe(
      "In 2023, 29,898 households moved into Hudson County and 31,040 moved out: a net loss of 1,142, or 3.7 for every 1,000 households there.",
    );
    expect(movesSentence({ ...year, outflow_returns: 28_000, net_per_1000: 5.8 }, "Hudson County")).toContain("a net gain of 1,898");
  });

  it("sets arrivals' income against stayers' and leavers', rounded to the thousand", () => {
    expect(incomeSentence(year)).toBe(
      "Households moving in reported an average income of $109,000, 4% more than households who stayed ($105,000); those who left reported $133,000.",
    );
    expect(incomeSentence({ ...year, inflow_income: 90_000 })).toContain("14% less than");
  });

  it("names the county a town's figures belong to", () => {
    expect(whose(hudson, "Hoboken")).toBe(
      "These are Hudson County’s figures: the IRS publishes moves by county only, not for Hoboken.",
    );
    expect(whose({ ...hudson, via: "self" }, "Hudson County")).toBeNull();
  });
});
