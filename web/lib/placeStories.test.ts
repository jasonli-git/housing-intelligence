import { expect, it } from "vitest";
import type { PacketLevel, WaterSystems } from "./api";
import { makePlaceStoryRecord, placeStoryHref, storyPlaceId, summarizePlaceStory } from "./placeStories";
import { stampPlaceStory } from "./placeStoryData";

const place = { region_id: 224, name: "Princeton", state_code: "NJ", level: "municipality" };
const row = (metric_id: string, value: number, unit = "usd") => ({ metric_id, value, unit, period_start: "2020-01-01", period_end: "2024-12-31", margin_of_error: 10 }) as PacketLevel;
it("makes a market preview from the exact same-period survey values, not a current Zillow value", () => {
  const summary = summarizePlaceStory(makePlaceStoryRecord("market", place, [row("acs_median_home_value", 600000), row("acs_median_hh_income", 120000), row("zhvi_sfr", 900000)]));
  expect(summary.headline).toContain("$600,000"); expect(summary.headline).not.toContain("$900,000");
  expect(summary.period).toBe("2020–2024"); expect(summary.qualifier).toContain("not current asking prices");
});
it("does not join survey figures from different periods", () => {
  const income = { ...row("acs_median_hh_income", 120000), period_end: "2023-12-31" };
  expect(summarizePlaceStory(makePlaceStoryRecord("market", place, [row("acs_median_home_value", 600000), income])).available).toBe(false);
});
it("preserves zero transit share and omits a missing mode instead of inventing zero", () => {
  const summary = summarizePlaceStory(makePlaceStoryRecord("commute", place, [row("acs_mean_commute_minutes", 24, "minutes"), row("acs_commute_transit_share", 0, "ratio")]));
  expect(summary.headline).toBe("24-minute average commute"); expect(summary.rows).toHaveLength(1); expect(summary.rows[0].value).toBe(0);
  expect(summary.qualifier).toContain("not your route");
});
it("counts distinct systems with historical violations, not affected homes or current risk", () => {
  const water = { region_id: 224, first_year: 2021, last_year: 2025, systems: [{ pwsid: "1", name: "System", homes: 100, violations: 4 }] } as WaterSystems;
  const summary = summarizePlaceStory(makePlaceStoryRecord("water", place, [], { water }));
  expect(summary.headline).toBe("1 of 1 water systems with past health-based violations");
  expect(summary.rows[0].formatted).toBe("100 homes"); expect(summary.qualifier).toContain("not today’s tap water");
  expect(summarizePlaceStory(makePlaceStoryRecord("water", place, [], { water: { ...water, systems: [...water.systems, ...water.systems] } })).available).toBe(false);
});
it("refuses another geography's water records and never treats missing records as clean", () => {
  const water = { region_id: 11, first_year: 2021, last_year: 2025, systems: [] } as WaterSystems;
  const record = makePlaceStoryRecord("water", place, [], { water });
  expect(record.water).toBeNull(); expect(summarizePlaceStory(record).available).toBe(false);
  expect(summarizePlaceStory(record).qualifier).toContain("not a zero or a clean result");
});
it("keeps shareable place selections strict", () => {
  expect(storyPlaceId("?place=224")).toBe(224); expect(storyPlaceId("?place=224abc")).toBeNull();
  expect(storyPlaceId("?place=-1")).toBeNull(); expect(placeStoryHref("water", 224)).toBe("/stories/water-you-can-check?place=224");
});
it("changes screenshot identity when a value or its period changes", () => {
  const record = makePlaceStoryRecord("commute", place, [row("acs_mean_commute_minutes", 24, "minutes")]);
  const first = stampPlaceStory(record).snapshot;
  expect(first).toHaveLength(16); expect(stampPlaceStory(record).snapshot).toBe(first);
  expect(stampPlaceStory({ ...record, levels: [row("acs_mean_commute_minutes", 25, "minutes")] }).snapshot).not.toBe(first);
  expect(stampPlaceStory({ ...record, levels: [{ ...record.levels[0], period_end: "2023-12-31" }] }).snapshot).not.toBe(first);
});

it("canonicalizes history metadata so the same preview and story share one snapshot", () => {
  const history = [{ metricId: "zhvi_sfr", short: "home values", observations: [] }];
  const fromPlace = makePlaceStoryRecord("market", place, [], { history });
  const fromStory = makePlaceStoryRecord("market", place, [], { history: [{ metricId: "zhvi_sfr", observations: [] }] });
  expect(stampPlaceStory(fromPlace).snapshot).toBe(stampPlaceStory(fromStory).snapshot);
});
