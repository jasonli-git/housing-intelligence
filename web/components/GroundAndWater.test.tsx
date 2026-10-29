// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { PacketLevel, WaterSystems } from "@/lib/api";
import { GroundAndWater } from "./GroundAndWater";
afterEach(cleanup);
const water={first_year:2020,last_year:2025,systems:[.1,.4,.2,.3].map((share,i)=>({pwsid:`NJTEST${i}`,name:`System ${i}`,share_of_homes:share,violations:0,latest_violation:null,pfas_samples:[]}))} as unknown as WaterSystems;
it("previews the two largest systems and retains the rest without ranking safety",()=>{
 const {container}=render(<GroundAndWater name="Example" levels={[]} water={water} compact />);
 const main=container.querySelector(".water-systems tbody")!;
 expect(main.children).toHaveLength(2);
 expect(main.textContent).toContain("System 1");
 expect(main.textContent).not.toContain("System 0");
 expect(screen.getByText("2 more water systems")).toBeTruthy();
 expect(container.querySelector(".water-more-systems tbody")?.textContent).toContain("System 0");
 expect(screen.getByText(/not ranked by water quality/)).toBeTruthy();
});
it("leaves the default full table used elsewhere unchanged",()=>{
 const {container}=render(<GroundAndWater name="Example" levels={[]} water={water} />);
 expect(container.querySelector(".water-systems tbody")?.children).toHaveLength(4);
 expect(container.querySelector(".water-more-systems")).toBeNull();
});
it("retains site records without duplicating the moved water-system detail",()=>{
 const {container}=render(<GroundAndWater name="Example" levels={[{metric_id:"njdep_sites_open",value:22},{metric_id:"water_homes_share_public",value:.7}] as PacketLevel[]} water={water} scope="sites" />);
 expect(screen.getByRole("heading",{name:"Contaminated-site records"})).toBeTruthy();
 expect(container.textContent).toContain("22");
 expect(container.querySelector(".water-systems")).toBeNull();
 expect(container.textContent).not.toContain("70% are on public water");
});
it("shows water records in the story without importing contaminated-site counts",()=>{
 const {container}=render(<GroundAndWater name="Example" levels={[{metric_id:"njdep_sites_open",value:22}] as PacketLevel[]} water={water} scope="water" />);
 expect(screen.getByRole("heading",{name:"Water systems and records"})).toBeTruthy();
 expect(container.querySelector(".water-systems tbody")?.children).toHaveLength(4);
 expect(container.textContent).not.toContain("contaminated sites in");
});
