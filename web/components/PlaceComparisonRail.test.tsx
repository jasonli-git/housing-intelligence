import {renderToStaticMarkup} from "react-dom/server";
import {it,expect} from "vitest";
import type {PacketLevel} from "@/lib/api";
import {PlaceComparisonRail} from "./PlaceComparisonRail";

it("retains a supplied revision notice alongside its current-value comparison",()=>{
  const level={metric_id:"acs_renter_cost_burden",label:"Renters",value:.36,unit:"ratio",direction:"lower_is_better",rank:4,of:500,period_start:"2020-01-01",period_end:"2024-12-31"} as PacketLevel;
  const html=renderToStaticMarkup(<PlaceComparisonRail name="Fixture" peers="NJ municipalities" levels={[level]} uncertainties={{value:new Map(),change:new Map()}} reportHref="/nj/princeton/report" revisions={new Map([[level.metric_id,{from:"33.3%",on:"2026-09-26"}],["not-displayed",{from:"unrelated",on:"2026-09-26"}]])}/>);
  expect(html).toContain('href="/changes"');
  expect(html).toContain('first published as 33.3%');
  expect(html).not.toContain('unrelated');
  expect(html).toContain('href="/nj/princeton/report#report-current"');
  const container=document.createElement('div');container.innerHTML=html;
  expect(container.querySelector('.figure-updated')?.closest('[data-comparison-card]')?.getAttribute('data-comparison-card')).toBe(level.metric_id);
});
// @vitest-environment jsdom
