// @vitest-environment jsdom
import {afterEach,expect,it} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {CostRibbon} from "./CostRibbon";
afterEach(cleanup);
it("encodes unrounded payment shares in band end thickness and keeps principal separate",()=>{
  const {container}=render(<CostRibbon parts={[{key:"interest",value:75,color:"gray"}]} principal={25} label="Interest 75; principal 25" />);
  const paths=container.querySelectorAll("path");
  expect(paths[0].getAttribute("d")).toContain("L400 42"); // 18 + 24 = 75% of 32
  expect(paths[1].getAttribute("d")).toContain("L400 90"); // 82 + 8 = 25% of 32
  expect(paths[1].getAttribute("data-part")).toBe("principal");
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Interest 75; principal 25");
});
it("does not invent bands for unavailable, negative or zero inputs",()=>{
  const {container}=render(<CostRibbon parts={[{key:"missing",value:NaN,color:"gray"},{key:"zero",value:0,color:"gray"}]} principal={0} label="No included costs" />);
  expect(container.querySelector("svg")).toBeNull();
});
it("updates the diagram without rounding or adding costs",()=>{
  const {container,rerender}=render(<CostRibbon parts={[{key:"interest",value:75,color:"gray"}]} principal={25} label="Initial" />);
  rerender(<CostRibbon parts={[{key:"interest",value:25,color:"gray"}]} principal={75} label="Updated" />);
  expect(container.querySelector('[data-part="interest"]')?.getAttribute("d")).toContain("L400 26");
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Updated");
});
