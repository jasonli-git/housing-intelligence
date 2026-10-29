// @vitest-environment jsdom
import {afterEach,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {BroadbandStoryExplorer,UtilityOutageExplorer} from "./LivingStoryExplorers";
import type {CommunityContext,Utilities} from "@/lib/api";
afterEach(cleanup);
const data={region_id:224,providers:[{provider:"Fixture Electric",fuel:"electric",electricity:{record_id:"1",payload:{year:2025,method:"IEEE",saidi_all:66.25,saidi_normal:42.57}}}]} as unknown as Utilities;
it("switches reporting basis, preserves company scope and keeps missing values explicit",()=>{
 const {rerender}=render(<UtilityOutageExplorer data={data}/>);
 expect(screen.getByText("66.3 min")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Major-event days excluded"}));expect(screen.getByText("42.6 min")).toBeTruthy();expect(screen.getByText(/not the town’s outages/)).toBeTruthy();
 rerender(<UtilityOutageExplorer data={{...data,providers:[{...data.providers[0],electricity:{...data.providers[0].electricity!,payload:{...data.providers[0].electricity!.payload,saidi_normal:null}}}]}}/>);
 expect(screen.getByText("Not reported")).toBeTruthy();expect(screen.queryByText("0.0 min")).toBeNull();
});
it("switches broadband denominator without hiding the county scope or reusing town location counts",()=>{
 const community={region_id:224,districts:[],health:[],crime:[],broadband_area:"Mercer",broadband_level:"county",broadband:[{payload:{technology:"All Wired",name:"Mercer County",shares:{speed_100_20:.99,speed_1000_100:.8},total_units:167676,as_of:"2025-12-31",revision:"2026-09-29",url:"https://example.test/fcc"}}],broadband_place:{payload:{locations:6903,fiber:6825,unserved_wired:5,unserved_terrestrial:5,as_of:"2025-12-31",revision:"2026-10-13",url:"https://example.test/locations"}}} as unknown as CommunityContext;
 render(<BroadbandStoryExplorer data={community} level="municipality"/>);
 expect(screen.getByText(/Of 6,903 broadband-serviceable locations/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Published area units'}));
 expect(screen.getByRole('heading',{name:'Mercer County · published county units'})).toBeTruthy();
 expect(screen.getByText(/County context—not this town/)).toBeTruthy();expect(screen.getByText(/Shares of 167,676 FCC mapped units/)).toBeTruthy();
 expect(screen.queryByText(/Of 6,903 broadband-serviceable locations/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Mapped locations'}));expect(screen.getByText(/Of 6,903 broadband-serviceable locations/)).toBeTruthy();
});
