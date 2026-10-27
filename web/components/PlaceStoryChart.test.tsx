// @vitest-environment jsdom
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PlaceStoryChart } from "./PlaceStoryChart";
import { makePlaceStoryRecord } from "@/lib/placeStories";
import type { Persistence } from "@/lib/api";

it("hydrates county-context SVG year titles without replacing the chart or relabeling it as town history", async () => {
  const data = { region_id:11,first_year:2015,last_year:2024,vs_median:22,vs_median_low:17,vs_median_high:27,withheld:null,series:Array.from({length:10},(_,i)=>({year:2015+i,vs_median:i*3-5})) } as Persistence;
  const record=makePlaceStoryRecord("past",{region_id:224,name:"Princeton",level:"municipality",state_code:"NJ",county_id:11},[],{countyHistory:{region_id:11,name:"Mercer County",data}});
  const element=<PlaceStoryChart record={record}/>;
  const container=document.createElement("div");container.innerHTML=renderToString(element);document.body.append(container);
  const recover=vi.fn(); let root:Root|undefined;
  try {
    await act(async()=>{root=hydrateRoot(container,element,{onRecoverableError:recover});});
    expect(recover).not.toHaveBeenCalled();
    expect(container.querySelector("svg title")?.textContent).toBe("2015: 5% below its usual level");
    expect(container.querySelector("figcaption")?.textContent).toMatch(/^Mercer County/);
    expect(container.textContent).toContain("not town-level price pressure");
  } finally {await act(async()=>root?.unmount());container.remove();}
});
