// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConstructionExhibit, HistoryExhibit, MigrationExhibit, PaycheckExhibit, SaleExhibit } from "./ExhibitCharts";
import { ExhibitGallery } from "./ExhibitGallery";
import type { Migration, PacketMetric, Persistence } from "@/lib/api";

afterEach(cleanup);
describe("learning exhibits",()=>{
  it("switches price and rent without mixing ratios or periods",()=>{
    const metrics=[{metric_id:"price_to_income",start_value:3,end_value:4,window_start:"2019-01-01",window_end:"2024-12-31"},{metric_id:"rent_to_income",start_value:.2,end_value:.25,window_start:"2020-01-01",window_end:"2025-12-31"}] as PacketMetric[];
    render(<PaycheckExhibit metrics={metrics}/>);
    expect(screen.getByText("4.00×")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Rent"}));
    expect(screen.getByText("25.0%")).toBeTruthy();
    expect(screen.getByText("2025")).toBeTruthy();
    expect(screen.queryByText("4.00×")).toBeNull();
  });
  it("uses a keyboard-accessible historical slider and respects withheld comparisons",()=>{
    const data={series:[{year:2020,vs_median:-10},{year:2022,vs_median:20}],withheld:null} as Persistence;
    const {rerender}=render(<HistoryExhibit data={data}/>);
    expect(screen.getByText("2022")).toBeTruthy();
    fireEvent.change(screen.getByRole("slider"),{target:{value:"0"}});
    expect(screen.getByText("2020")).toBeTruthy();
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toContain("2020");
    rerender(<HistoryExhibit data={{...data,withheld:"Too few years"}}/>);
    expect(screen.queryByRole("slider")).toBeNull();
  });
  it("keeps a missing demolition figure distinct from zero",()=>{
    render(<ConstructionExhibit rows={[{year:2025,completed:20,demolished:null,net:null,permitted:30,preliminary:true},{year:2024,completed:10,demolished:0,net:10,permitted:15,preliminary:false}]}/>);
    expect(screen.getByText("Not reported")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"2024"}));
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.queryByText("Not reported")).toBeNull();
  });
  it("switches migration directions on one scale and styles verified county links",()=>{
    const data={county_name:"Somerset",flows_year:2023,arrivals:[{rank:1,name:"Mercer",region_id:12,returns:100,share:.1}],departures:[{rank:1,name:"Elsewhere",region_id:null,returns:50,share:.05}]} as Migration;
    const {container}=render(<MigrationExhibit data={data}/>);
    expect(screen.getByRole("link",{name:"Mercer"}).className).toBe("destination-county");
    expect(container.querySelector<HTMLElement>(".exhibit-track i")?.style.width).toBe("100%");
    fireEvent.click(screen.getByRole("button",{name:"Where leavers went"}));
    expect(container.querySelector<HTMLElement>(".exhibit-track i")?.style.width).toBe("50%");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("never invents sale quartiles when only a median is supplied",()=>{
    render(<SaleExhibit median={300000} period="Jan 2024 to Jun 2026"/>);
    expect(screen.queryByRole("button",{name:"Lower quartile"})).toBeNull();
    expect(screen.getByText("$300,000")).toBeTruthy();
  });
  it("allows decorative looping motion to pause without changing the content",()=>{
    const {container}=render(<ExhibitGallery><p>Published figure</p></ExhibitGallery>);
    fireEvent.click(screen.getByRole("button",{name:"Pause artwork"}));
    expect(container.querySelector("[data-motion=paused]")).toBeTruthy();
    expect(screen.getByText("Published figure")).toBeTruthy();
  });
});
