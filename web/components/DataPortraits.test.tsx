// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Observation } from "@/lib/api";
import { connectedStock, costSlices, vacancyPair } from "@/lib/dataPortraits";
import { CostComposition, CountyConstellation, StockFlow, VacancyPortrait } from "./DataPortraits";

const observation = (year: number, value: number): Observation => ({ metric_id: "acs_vacancy_rate", value, period_start: `${year-4}-01-01`, period_end: `${year}-12-31`, source_id: "acs", vintage: String(year), match_method: "exact", margin_of_error: .01 });
beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("requires valid same-source estimates five years apart", () => {
  expect(vacancyPair([observation(2024,.12), observation(2019,.1)])?.latest.value).toBe(.12);
  expect(vacancyPair([observation(2024,.12), observation(2020,.1)])).toBeNull();
  expect(vacancyPair([observation(2024,NaN), observation(2019,2)])).toBeNull();
  expect(vacancyPair([{...observation(2019,.1),source_id:"other"}, observation(2024,.12)])).toBeNull();
});
it("does not silently join inconsistent or missing stock figures", () => {
  const row = {year:2024,permitted:500,completed:100,demolished:20,net:80,preliminary:false};
  expect(connectedStock(row)).toBe(true);
  expect(connectedStock({...row,net:79})).toBe(false);
  expect(connectedStock({...row,demolished:null})).toBe(false);
  const {container} = render(<StockFlow row={{...row,net:79}} />);
  expect(container.innerHTML).toBe("");
});
it("keeps principal separate and retains unrounded included amounts", () => {
  const slices=costSlices([{key:"interest",label:"Interest",value:100.25,color:"red"},{key:"missing",label:"Missing",value:NaN,color:"blue"}],25.5);
  expect(slices.map(p=>p.key)).toEqual(["interest","principal"]);
  expect(slices.reduce((n,p)=>n+p.value,0)).toBe(125.75);
});
it("lets readers select the earlier portrait without auto-playing reduced motion", () => {
  const {container}=render(<VacancyPortrait earlier={observation(2019,.1)} latest={observation(2024,.12)} />);
  expect(container.querySelectorAll('[data-empty="true"]').length).toBe(12);
  fireEvent.click(screen.getByRole("button",{name:"Earlier estimate"}));
  expect(container.querySelectorAll('[data-empty="true"]').length).toBe(10);
  expect(screen.getByText(/Not actual properties/)).toBeTruthy();
});
it("exposes each county through focus and tap with its own period", () => {
  render(<CountyConstellation selected={1} rows={[{id:1,name:"First",value:.1,start:"2020-01-01",end:"2024-12-31",margin:.01},{id:2,name:"Second",value:.2,start:"2019-01-01",end:"2023-12-31",margin:null}]} />);
  fireEvent.focus(screen.getByRole("button",{name:"Second, 20.0% vacant"}));
  expect(screen.getByText("Second · 20.0%")).toBeTruthy();
  expect(screen.getByText(/2019–2023/)).toBeTruthy();
  expect(screen.getByRole("link",{name:"Explore county →"}).getAttribute("href")).toBe("/regions/2");
});
it("discloses excluded inputs and updates the cost graphic when inputs change", () => {
  const parts=[{key:"interest",label:"Interest",value:100,color:"red"}];
  const {rerender}=render(<CostComposition parts={parts} principal={25} missing={["Insurance"]} optional={["HOA"]} />);
  fireEvent.focus(screen.getByRole("button",{name:/Principal/}));
  fireEvent.click(screen.getByRole("button",{name:/Principal/}));
  expect(screen.getByText(/20.0% of the included total/)).toBeTruthy();
  expect(screen.getByText(/Partial estimate. Missing: Insurance/)).toBeTruthy();
  rerender(<CostComposition parts={parts} principal={100} missing={[]} optional={[]} />);
  expect(screen.getByText(/50.0% of the included total/)).toBeTruthy();
});
