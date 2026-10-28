import {it,expect} from "vitest";
import type {CommunityContext} from "./api";
import {makePlaceStoryRecord,summarizePlaceStory} from "./placeStories";
const place={region_id:224,name:"Princeton",level:"municipality",state_code:"NJ"};
const community={region_id:224,health_area:"Mercer",health_level:"county",health:[{payload:{measure:"A",label:"Fixture adult measure",value:12,low:10,high:14,confidence:95,year:2023,release:"2025"}}],districts:[],crime:[],broadband:[]} as unknown as CommunityContext;
it("keeps county geography, year, uncertainty and adult population limits with the chart",()=>{
  const record=makePlaceStoryRecord("health",place,[],{community});
  const summary=summarizePlaceStory(record);
  expect(summary.headline).toBe("Mercer County: health in context");
  expect(summary.period).toBe("2023 basis · 2025 release");
  expect(summary.qualifier).toContain("not a local headcount or measurements of this town");
  expect(summary.qualifier).toContain("percentages cannot be added");
  expect(summary.rows[0].aside).toBe("95% interval 10.0–14.0%");
  expect(record.community?.districts).toEqual([]);
});
it("does not turn suppressed, invalid, mismatched or mixed-release records into estimates",()=>{
  const summarize=(c:CommunityContext)=>summarizePlaceStory(makePlaceStoryRecord("health",place,[],{community:c}));
  expect(summarize({...community,region_id:11}).available).toBe(false);
  for(const value of [null,NaN,Infinity,-1,101])expect(summarize({...community,health:[{...community.health[0],payload:{...community.health[0].payload,value}}]}).available).toBe(false);
  expect(summarize({...community,health:[...community.health,{...community.health[0],payload:{...community.health[0].payload,measure:"B",release:"2024"}}]}).available).toBe(false);
  expect(summarize({...community,health:[{...community.health[0],payload:{...community.health[0].payload,value:0,low:0,high:1}}]}).rows[0].value).toBe(0);
});
