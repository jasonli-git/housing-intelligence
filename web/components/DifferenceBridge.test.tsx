// @vitest-environment jsdom
import {afterEach,expect,it} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {DifferenceBridge,sentenceCostLabel} from "./DifferenceBridge";
afterEach(cleanup);
it.each(["more","less","about"] as const)("retains the computed %s verdict, spending amounts and separate principal",kind=>{
  const {container}=render(<DifferenceBridge own={2000} rent={1800} principal={300} kind={kind} gap={200} missing={["Flood insurance","HOA or condo fees"]}/>);
  expect(screen.getByText("$2,000")).toBeTruthy();expect(screen.getByText("$1,800")).toBeTruthy();
  expect(screen.getByText(kind==="about" ? "About the same" : `a month ${kind} to own`)).toBeTruthy();
  expect(screen.getByText(/Utilities excluded from both/).textContent).toContain("flood insurance, HOA or condo fees");
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});
it("uses sentence case without corrupting acronyms",()=>{
  expect(sentenceCostLabel("Flood insurance")).toBe("flood insurance");
  expect(sentenceCostLabel("HOA or condo fees")).toBe("HOA or condo fees");
});
