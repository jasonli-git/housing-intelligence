import { describe, expect, it } from "vitest";
import type { Observation, PacketLevel, Region } from "./api";
import { marketDistribution, marketHistory, marketLine, matchedMarketPeers } from "./marketPortrait";

const regions = [{ region_id: 1, name: "One", level: "municipality", state_code: "NJ" }, { region_id: 2, name: "Two", level: "municipality", state_code: "NJ" }] as Region[];
describe("measured-town distribution",()=>{
  it("interpolates quartiles without mutating the source and retains actual extrema",()=>{
    const values=[400,100,300,200];expect(marketDistribution(values)).toEqual({min:100,q1:175,median:250,q3:325,max:400});expect(values).toEqual([400,100,300,200]);
    expect(marketDistribution([100,200,300,400,10000])?.max).toBe(10000);
  });
  it("handles ties and refuses missing or invalid values rather than inventing zero",()=>{
    expect(marketDistribution([500,500,500])).toEqual({min:500,q1:500,median:500,q3:500,max:500});
    for(const values of [[],[1],[1,NaN],[1,Infinity],[0,2],[-1,2]])expect(marketDistribution(values)).toBeNull();
  });
});
describe("same-month values, not latest ranks", () => {
  it("keeps only registered towns and the exact requested month on the actual dollar scale", () => {
    const points = matchedMarketPeers({ regions: [
      { region_id: 1, series: [{ period_start: "2026-09-01", value: 500 }, { period_start: "2026-08-01", value: 900 }] },
      { region_id: 2, series: [{ period_start: "2026-08-01", value: 800 }] },
      { region_id: 9, series: [{ period_start: "2026-09-01", value: 300 }] },
    ] }, regions, "2026-09-01");
    expect(points).toEqual([{ id: 1, name: "One", value: 500 }]);
  });
  it("refuses duplicate months rather than silently picking one", () => {
    expect(() => matchedMarketPeers({ regions: [{ region_id: 1, series: [{ period_start: "2026-09-01", value: 5 }, { period_start: "2026-09-01", value: 6 }] }] }, regions, "2026-09-01")).toThrow(/Duplicate month/);
  });
  it("does not turn missing or invalid values into zero", () => {
    expect(matchedMarketPeers({ regions: [{ region_id: 1, series: [{ period_start: "2026-09-01", value: NaN }] }] }, regions, "2026-09-01")).toEqual([]);
  });
});
describe("honest historical lines", () => {
  const row = { metric_id: "zhvi_sfr", source_id: "zillow_zhvi", period_end: "2026-09-30", value: 500 } as PacketLevel;
  const obs = (date: string, value: number) => ({ metric_id: "zhvi_sfr", source_id: "zillow_zhvi", period_end: date, value }) as Observation;
  it("rejects a series whose end date or value does not match the headline", () => {
    expect(marketHistory(row, [obs("2026-08-31", 500)])).toEqual([]);
    expect(marketHistory(row, [obs("2026-09-30", 499)])).toEqual([]);
    expect(marketHistory(row, [obs("2026-09-30", 500)])).toEqual([{ date: "2026-09-30", value: 500 }]);
  });
  it("bounds the history and excludes a different source", () => {
    expect(marketHistory(row, [obs("2019-01-31", 30), { ...obs("2026-08-31", 400), source_id: "other" }, obs("2026-09-30", 500)])).toHaveLength(1);
  });
  it("breaks the drawn line over missing months instead of inventing a smooth bridge", () => {
    expect(marketLine([{ date: "2026-01-31", value: 10 }, { date: "2026-02-28", value: 20 }, { date: "2026-09-30", value: 30 }], () => 1, v => v)).toBe("M1.00,10.00 L1.00,20.00 M1.00,30.00");
  });
});
