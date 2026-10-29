import {expect,it} from "vitest";
import type {Observation} from "./api";
import {loadFloodStory} from "./placeFloodStory";
const observation=(metric_id:string,value:number,year=2024):Observation=>({metric_id,value,period_start:`${year}-01-01`,period_end:`${year}-12-31`,source_id:"fixture",vintage:"fixture",match_method:"fixture"});
const town={region_id:224,level:"municipality"},county={region_id:11,name:"Mercer County"};
const reader=(placed:number,unplaced:number)=>async(id:number,metric:string)=>{
 if(metric==="fema_flood_claims")return [observation(metric,id===1?1000:id===11?100:placed,id===1?2026:2024)];
 if(metric==="fema_flood_claims_unplaced")return [observation(metric,unplaced)];
 return [observation(metric,id===11?5000:100)];
};
it("retains usable town estimates and anchors partial-year treatment to the state's newest year",async()=>{
 const result=await loadFloodStory(town,county,1,reader(100,1));
 expect(result.place).toBeNull();expect(result.estimated).toBe(true);expect(result.newest).toBe(2026);expect(result.claims[0].value).toBe(100);expect(result.unplaced[0].value).toBe(1);
});
it("keeps the existing ten-percent county fallback and its unseparable label",async()=>{
 const result=await loadFloodStory(town,county,1,reader(9,1));
 expect(result.place).toBe("Mercer County");expect(result.estimated).toBe(false);expect(result.unseparable).toBe(true);expect(result.claims[0].value).toBe(100);expect(result.paid[0].value).toBe(5000);expect(result.unplaced).toEqual([]);
});
it("does not assign a county to a ZIP or an unmatched town",async()=>{
 const zip=await loadFloodStory({...town,level:"zip"},county,1,reader(1,100));
 expect(zip.place).toBeNull();expect(zip.estimated).toBe(false);expect(zip.claims[0].value).toBe(1);
 const unmatched=await loadFloodStory(town,null,1,reader(0,100));expect(unmatched.place).toBeNull();expect(unmatched.claims[0].value).toBe(0);
});
