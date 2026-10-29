import { expect,it } from "vitest";
import type { CommunityContext, PacketLevel, Utilities } from "./api";
import { makePlaceStoryRecord,summarizePlaceStory } from "./placeStories";
import { electricRecords } from "./livingPlaceStories";
const place={region_id:224,name:"Princeton",level:"municipality",state_code:"NJ"};
const row=(metric_id:string,value:number,period_end="2026-12-31")=>({metric_id,value,period_start:"2026-01-01",period_end,unit:"count"}) as PacketLevel;
it("keeps site categories separate, including a real zero, and omits mismatched snapshots",()=>{
 const summary=summarizePlaceStory(makePlaceStoryRecord("sites",place,[row("njdep_sites_open",22),row("njdep_sites_post_remedy",8),row("njdep_sites_heating_oil",0),row("njdep_sites_post_remedy",99,"2025-12-31")]));
 expect(summary.headline).toContain("22 site cleanups");expect(summary.rows.map(r=>r.value)).toEqual([22,8,0]);expect(summary.qualifier).toContain("Categories may overlap");expect(summary.qualifier).toContain("not affected homes");
 expect(summarizePlaceStory(makePlaceStoryRecord("sites",place,[])).available).toBe(false);
});
it("withholds flood-zone shares for incomplete maps rather than calling unmapped homes safe",()=>{
 const levels=[row("fema_flood_homes_share",.04),row("fema_mapped_homes_share",.94)];
 expect(summarizePlaceStory(makePlaceStoryRecord("flood",place,levels)).available).toBe(false);
 levels[1].value=.99;const summary=summarizePlaceStory(makePlaceStoryRecord("flood",place,levels));
 expect(summary.headline).toContain("4.0%");expect(summary.period).toContain("2020 homes");expect(summary.qualifier).toContain("Outside a mapped zone is not safe");
});
const utilities={region_id:224,providers:[{fuel:"electric",provider:"Fixture Electric",electricity:{record_id:"123",payload:{year:2025,method:"IEEE",saidi_all:66.25,saidi_normal:42.57,sales:[]}}}],energy_context:null} as unknown as Utilities;
it("describes utility-wide SAIDI and never sums alternative major-event bases",()=>{
 const summary=summarizePlaceStory(makePlaceStoryRecord("utilities",place,[],{utilities}));
 expect(summary.headline).toBe("66.3 minutes without power per customer");expect(summary.rows.map(r=>r.value)).toEqual([66.25,42.57]);expect(summary.qualifier).toContain("not town outages");expect(summary.qualifier).toContain("not quantities to add");
 expect(electricRecords({...utilities,providers:[...utilities.providers,...utilities.providers]})).toHaveLength(1);
 expect(summarizePlaceStory(makePlaceStoryRecord("utilities",place,[],{utilities:{...utilities,region_id:11}})).available).toBe(false);
});
it("does not turn a missing outage figure into zero",()=>{
 const missing={...utilities,providers:[{...utilities.providers[0],electricity:{...utilities.providers[0].electricity!,payload:{...utilities.providers[0].electricity!.payload,saidi_all:null}}}]};
 expect(summarizePlaceStory(makePlaceStoryRecord("utilities",place,[],{utilities:missing})).available).toBe(false);
});
const community={region_id:224,districts:[],crime:[],health:[],broadband_area:"Mercer County",broadband_level:"county",broadband:[{payload:{name:"Mercer County",technology:"All Wired",as_of:"2025-12-31",revision:"2026-09-29",total_units:167676,shares:{speed_100_20:.99}}}],broadband_place:{payload:{locations:6903,fiber:6825,unserved_wired:5,unserved_terrestrial:5,as_of:"2025-12-31",revision:"2026-10-13"}}} as unknown as CommunityContext;
it("uses town serviceable locations rather than county units or households",()=>{
 const summary=summarizePlaceStory(makePlaceStoryRecord("broadband",place,[],{community}));
 expect(summary.headline).toBe("98.9% of mapped locations have a fiber offer");expect(summary.rows[0].value).toBe(6825/6903);expect(summary.qualifier).toContain("6,903 broadband-serviceable locations");expect(summary.qualifier).not.toContain("167,676");expect(summary.qualifier).toContain("not speed tests");
});
it("labels county unit context and refuses it for a ZIP without local records",()=>{
 const without={...community,broadband_place:null};
 const summary=summarizePlaceStory(makePlaceStoryRecord("broadband",place,[],{community:without}));
 expect(summary.headline).toContain("Mercer County:");expect(summary.qualifier).toContain("not a town’s location count");
 expect(summarizePlaceStory(makePlaceStoryRecord("broadband",{...place,level:"zip"},[],{community:without})).available).toBe(false);
 expect(summarizePlaceStory(makePlaceStoryRecord("broadband",place,[],{community:{...community,region_id:11}})).available).toBe(false);
});
it("refuses impossible local counts rather than replacing them with a county percentage",()=>{
 const invalid={...community,broadband_place:{...community.broadband_place!,payload:{...community.broadband_place!.payload,fiber:7000}}};
 expect(summarizePlaceStory(makePlaceStoryRecord("broadband",place,[],{community:invalid})).available).toBe(false);
});
