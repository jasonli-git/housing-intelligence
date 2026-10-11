// @vitest-environment jsdom
import {afterEach,expect,it} from "vitest";
import {readGuideTransfer,writeGuideTransfer} from "./guideTransfer";
afterEach(()=>sessionStorage.clear());
it("transfers home figures only to the deliberately selected place",()=>{
  writeGuideTransfer(12,{price:350000,taxYear:0,hoaMonth:200},2100);
  expect(readGuideTransfer(12)).toEqual({home:{price:350000,taxYear:0,hoaMonth:200},rent:2100});
  expect(readGuideTransfer(224)).toEqual({home:{},rent:null});
});
it("ignores corrupt or non-finite stored inputs",()=>{
  sessionStorage.setItem("hip.guide.home.v1",JSON.stringify({placeId:12,home:{price:-1,taxYear:"9000",hoaMonth:0},rent:-3}));
  expect(readGuideTransfer(12)).toEqual({home:{hoaMonth:0},rent:null});
  sessionStorage.setItem("hip.guide.home.v1","broken");
  expect(readGuideTransfer(12)).toEqual({home:{},rent:null});
});
