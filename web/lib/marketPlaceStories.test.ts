import { expect, it } from "vitest";
import type { HousingPressure, Migration, Observation, PacketLevel, Persistence } from "./api";
import { makePlaceStoryRecord, summarizePlaceStory } from "./placeStories";
import { placeStoryPreviewNote } from "./marketPlaceStories";
import { stampPlaceStory } from "./placeStoryData";
const place = { region_id: 224, name: "Princeton", level: "municipality", state_code: "NJ" };
const level = (metric_id: string, value: number, extra = {}) => ({ metric_id, value, unit: "usd", period_start: "2023-07-01", period_end: "2026-06-30", ...extra }) as PacketLevel;
it("keeps recorded-sale quartiles on one window and describes transactions rather than all homes", () => {
  const levels = [level("sr1a_median_sale_price", 1300000),level("sr1a_sales_count",461),level("sr1a_price_lower_quartile",890000),level("sr1a_price_upper_quartile",1905000,{period_end:"2025-06-30"})];
  const summary = summarizePlaceStory(makePlaceStoryRecord("sales",place,levels));
  expect(summary.headline).toContain("$1,300,000");expect(summary.period).toBe("Jul 2023–Jun 2026");expect(summary.rows).toHaveLength(2);
  expect(summary.qualifier).toContain("461 usable one- to four-family sales");
  levels[1].period_end="2025-06-30";
  expect(summarizePlaceStory(makePlaceStoryRecord("sales",place,levels)).available).toBe(false);
});
it("retains tract-estimate and historical-offer limits on financing, including real zero program shares", () => {
  const record=makePlaceStoryRecord("lending",place,[level("hmda_purchase_loans",136,{match_method:"tract_homes"}),level("hmda_median_loan_amount",955000),level("hmda_fha_share",0),level("hmda_va_share",0.3,{period_end:"2024-12-31"})]);
  const summary=summarizePlaceStory(record);
  expect(summary.qualifier).toContain("Estimated from census tracts");expect(summary.qualifier).toContain("not current offers");
  expect(summary.rows).toEqual([{label:"FHA",value:0,formatted:"0.0%"}]);expect(placeStoryPreviewNote(record)).toContain("Tract-based estimate");
});
const annual=(metric_id:string,value:number,vintage="2025-ytd"):Observation=>({metric_id,value,period_start:"2025-01-01",period_end:"2025-12-31",source_id:"fixture",vintage,match_method:"fixture"});
it("calculates net building only from same-year reports and labels preliminary data", () => {
  const record=makePlaceStoryRecord("building",place,[],{history:[{metricId:"nj_units_certified",observations:[annual("nj_units_certified",25)]},{metricId:"nj_units_demolished",observations:[annual("nj_units_demolished",18)]}]});
  const summary=summarizePlaceStory(record);expect(summary.headline).toBe("7 net homes added");expect(summary.period).toContain("Preliminary");
  expect(summary.qualifier).toContain("missing reports are not zero");
  record.history[1].observations=[];expect(summarizePlaceStory(record).available).toBe(false);
});
it("does not annualize an unfinished monthly permit year into reported construction", () => {
  const record=makePlaceStoryRecord("building",place,[],{history:[{metricId:"nj_units_certified",observations:[{...annual("nj_units_certified",25),period_end:"2025-06-30"}]},{metricId:"nj_units_demolished",observations:[annual("nj_units_demolished",18)]}]});
  expect(summarizePlaceStory(record).available).toBe(false);
});
const pressure={region_id:224,period:"2018–2022",bands:[{tenure:"renter",band:0,total:505,burdened:240,severe:175,unknown:120,share:240/505,margin:.167}]} as HousingPressure;
it("uses the published CHAS denominator and uncertainty without excluding uncomputed households", () => {
  const summary=summarizePlaceStory(makePlaceStoryRecord("pressure",place,[],{pressure}));
  expect(summary.headline).toContain("48%");expect(summary.rows[0].aside).toContain("120 uncomputed");expect(summary.rows[0].aside).toContain("16.7 points");
  expect(summary.qualifier).toContain("not eligibility limits");
  expect(summarizePlaceStory(makePlaceStoryRecord("pressure",place,[],{pressure:{...pressure,region_id:11}})).available).toBe(false);
});
it("retains county scope for parent migration, never calls it Princeton moves", () => {
  const migration={region_id:224,county_id:11,county_name:"Mercer",via:"parent",years:[{year:2023,inflow_returns:8722,outflow_returns:10622}]} as Migration;
  const summary=summarizePlaceStory(makePlaceStoryRecord("migration",place,[],{migration}));
  expect(summary.headline).toBe("Mercer County: 1,900 more tax returns leaving");expect(summary.qualifier).toContain("not town-level migration");expect(summary.period).toBe("2022–2023");
  expect(summarizePlaceStory(makePlaceStoryRecord("migration",place,[],{migration:{...migration,region_id:11}})).available).toBe(false);
});

const countyHistory = { region_id: 11, name: "Mercer County", data: { region_id: 11, first_year: 1989, last_year: 2024, vs_median: 22.00285, vs_median_low: 17.3, vs_median_high: 27.1, withheld: null, series: Array.from({length: 10}, (_,i) => ({year:2015+i, vs_median:i-4})) } as Persistence };
it("keeps Mercer history bound to Princeton's verified county and labels index, date, uncertainty and forecast limits", () => {
  const record=makePlaceStoryRecord("past",{...place,county_id:11},[],{countyHistory});
  const summary=summarizePlaceStory(record);
  expect(summary.headline).toBe("Mercer County: prices against income 22% above its usual level");
  expect(summary.period).toBe("2024 · History 1989–2024");
  expect(summary.qualifier).toContain("not town-level price pressure");expect(summary.qualifier).toContain("not a forecast");expect(summary.qualifier).toContain("17% above");
  expect(placeStoryPreviewNote(record)).toContain("County history");expect(summary.rows).toEqual([]);
  expect(stampPlaceStory({...record,countyHistory:{...countyHistory,data:{...countyHistory.data,vs_median:23}}}).snapshot).not.toBe(stampPlaceStory(record).snapshot);
});
it("refuses unverified or mismatched county history and does not use the pilot county for other places", () => {
  expect(summarizePlaceStory(makePlaceStoryRecord("past",place,[],{countyHistory})).available).toBe(false);
  expect(summarizePlaceStory(makePlaceStoryRecord("past",{...place,county_id:12},[],{countyHistory})).available).toBe(false);
  expect(summarizePlaceStory(makePlaceStoryRecord("past",{...place,county_id:11},[],{countyHistory:{...countyHistory,data:{...countyHistory.data,region_id:12}}})).available).toBe(false);
  expect(summarizePlaceStory(makePlaceStoryRecord("past",{...place,level:"county",region_id:11},[],{countyHistory})).available).toBe(true);
});
it("honors withheld history and rejects short or non-finite series", () => {
  const make=(data:Persistence)=>summarizePlaceStory(makePlaceStoryRecord("past",{...place,county_id:11},[],{countyHistory:{...countyHistory,data}}));
  expect(make({...countyHistory.data,withheld:"Publisher comparison disagrees"}).available).toBe(false);
  expect(make({...countyHistory.data,withheld:"Publisher comparison disagrees"}).qualifier).toContain("Publisher comparison disagrees");
  expect(make({...countyHistory.data,series:countyHistory.data.series.slice(0,3)}).available).toBe(false);
  expect(make({...countyHistory.data,vs_median:NaN}).available).toBe(false);
});
