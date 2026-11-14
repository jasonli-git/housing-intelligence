// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PacketLevel } from "@/lib/api";
import type { GuideData } from "@/lib/guide";
import { slidesFor } from "./briefingSlides";

/** A figure with a statewide standing: `percentile` is the share of towns it does better than. */
function level(metric_id: string, value: number, percentile: number | null, extra: Partial<PacketLevel> = {}): PacketLevel {
  return {
    metric_id, label: metric_id, unit: "usd", direction: "neutral", value,
    period_start: "2025-01-01", period_end: "2025-12-31", rank: percentile == null ? null : 10, of: percentile == null ? null : 564, percentile,
    release_id: 1, source_id: "src", match_method: "fips", ...extra,
  };
}

function town(levels: PacketLevel[]): GuideData {
  return {
    region: { region_id: 344, geoid: "3401732250", level: "municipality", name: "Hoboken", label: "Hoboken, NJ", state_code: "NJ", parent: { region_id: 4, name: "Hudson", level: "county" } },
    levels, countyLevels: [], incomeLimits: null, turnover: [], water: null, community: null, utilities: null, newest: {},
    sources: [{ source_id: "src", name: "A source", publisher: "A publisher", license: "", url: "", vintage: "", fetched_at: "", release_ids: [] }],
  };
}

afterEach(cleanup);

const builtAt = new Date("2026-11-13T15:00:00Z");
const hoboken = town([
  level("sr1a_median_sale_price", 850_000, 86),
  level("modiv_median_tax_bill", 9_000, 37),
  level("fema_flood_homes_share", 0.64, 94, { unit: "share" }),
  level("modiv_median_year_built", 1999, 99, { unit: "year" }),
  level("sr1a_turnover_per_1000", 35, 93, { unit: "rate" }),
  level("acs_mean_commute_minutes", 31, 50, { unit: "minutes" }),
]);

describe("a town's briefing", () => {
  it("is the same seven slides, in the same order, for every town (#520)", () => {
    expect(slidesFor(hoboken, {}, { builtAt }).map((s) => s.key)).toEqual(["title", "bottom", "price", "tax", "flood", "homes", "sources"]);
    expect(slidesFor(town([]), {}, { builtAt }).map((s) => s.key)).toEqual(["title", "bottom", "price", "tax", "flood", "homes", "sources"]);
  });

  it("states each slide's conclusion in its title", () => {
    const by = Object.fromEntries(slidesFor(hoboken, {}, { builtAt }).map((s) => [s.key, s.headline]));
    expect(by.bottom).toBe("Hoboken stands out on the age of its homes, flood risk and how often homes sell");
    expect(by.price).toBe("Homes here cost more than in 86% of NJ towns");
    expect(by.flood).toBe("The share of homes in a flood zone is higher than in 94% of NJ towns");
    expect(by.homes).toBe("Homes here are newer than in 99% of NJ towns");
  });

  it("gives the commute no slide of its own, though At a glance may still pick it", () => {
    const slides = slidesFor(town([level("acs_mean_commute_minutes", 55, 99, { unit: "minutes" })]), {}, { builtAt });
    expect(slides.some((s) => /commute/i.test(s.kicker))).toBe(false);
    expect(slides.find((s) => s.key === "bottom")!.headline).toBe("Hoboken stands out on commutes");
  });

  it("says plainly when a figure is not published", () => {
    const by = Object.fromEntries(slidesFor(town([]), {}, { builtAt }).map((s) => [s.key, s]));
    expect(by.flood.headline).toBe("Flood zones are not published here");
    expect(by.flood.figure).toBeUndefined();
  });

  it("sets each figure beside New Jersey's median town and dates the briefing by its build", () => {
    const slides = slidesFor(hoboken, { fema_flood_homes_share: 0.06 }, { builtAt });
    expect(slides.find((s) => s.key === "flood")!.figure!.versus).toBe("NJ median town: 6%");
    render(<>{slides[0].body}</>);
    expect(screen.getByText(/Prepared November 13, 2026/)).toBeTruthy();
  });

  it("sends every figure to the town's full page", () => {
    render(<>{slidesFor(hoboken, {}, { builtAt }).at(-1)!.body}</>);
    expect(screen.getByRole("link", { name: "Hoboken’s full page" }).getAttribute("href")).toBe("/nj/hoboken/full");
  });
});
