import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalEvidenceCharts } from "./LocalEvidenceCharts";
import type { PacketLevel } from "@/lib/api";

const ids = ["lodes_resident_jobs", "lodes_work_home_county_share", "lodes_work_other_nj_share", "lodes_work_nyc_share", "lodes_work_pennsylvania_share", "lodes_work_other_state_share"];
const levels = ids.map((metric_id, i) => ({ metric_id, value: i ? .2 : 1000, period_end: "2023-12-31" })) as PacketLevel[];
describe("Local evidence charts", () => {
  it("shows complete job shares with their year and unit caveats", () => {
    const html = renderToStaticMarkup(<LocalEvidenceCharts name="Example" level="county" levels={levels} series={[[], [], [], []]} />);
    expect(html).toContain("2023"); expect(html).toContain("not people or commuters"); expect(html).toContain("20.0%");
  });
  it("does not turn an absent work share into zero", () => {
    const html = renderToStaticMarkup(<LocalEvidenceCharts name="Example" level="county" levels={levels.slice(0, -1)} series={[[], [], [], []]} />);
    expect(html).not.toContain("Where residents work");
  });
  it("does not reuse county charts for ZIPs", () => {
    expect(renderToStaticMarkup(<LocalEvidenceCharts name="ZIP" level="zip" levels={levels} series={[[], [], [], []]} />)).not.toContain("Where residents work");
  });
});
it("can place only the work exhibit and omits it when unsupported",()=>{
 const row=(metric_id:string,value:number)=>({metric_id,value,period_end:"2023-12-31"}) as PacketLevel;
 const levels=[row("lodes_resident_jobs",100),row("lodes_work_home_county_share",.4),row("lodes_work_other_nj_share",.3),row("lodes_work_nyc_share",.2),row("lodes_work_pennsylvania_share",.1),row("lodes_work_other_state_share",0)];
 const html=renderToStaticMarkup(<LocalEvidenceCharts kind="work" name="Example" level="county" levels={levels} series={[[],[],[],[]]} />);
 expect(html).toContain('data-exhibit="Job geography"');
 expect(html).not.toContain('data-exhibit="Annual building"');
 expect(renderToStaticMarkup(<LocalEvidenceCharts kind="work" name="Example" level="zip" levels={[]} series={[[],[],[],[]]} />)).toBe("");
});
