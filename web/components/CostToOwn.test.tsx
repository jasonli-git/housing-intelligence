// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CostToOwn, type CostProps } from "./CostToOwn";

afterEach(() => { cleanup(); localStorage.clear(); });
const inputs: CostProps = {
  home: { basis: "index", value: 400000, asOf: "Aug 2026" },
  rate: { value: 6.81, asOf: "Sep 2026" },
  tax: null, insurance: null, utilities: null, rentersPayUtilities: null,
  rent: { value: 2000, asOf: "Aug 2026" },
  noTax: "No ZIP-level tax estimate", gain: null, rateThen: null,
};
describe("local monthly budget", () => {
  it("updates monthly layers from existing inputs without changing the starting estimate", () => {
    const {container}=render(createElement(CostToOwn,{...inputs,quiet:true,showHelp:false}));
    const bill=container.querySelector(".monthly-bill")!;
    const baseline=bill.querySelector(".bill-head > div:last-child > small")?.textContent;
    const total=bill.querySelector(".bill-head strong")?.textContent;
    fireEvent.change(screen.getByLabelText("HOA or condo fees a month"),{target:{value:"250"}});
    expect(bill.querySelector('[data-cost="hoa"]')?.textContent).toContain("$250");
    expect(bill.querySelector(".bill-head strong")?.textContent).not.toBe(total);
    expect(bill.querySelector(".bill-head > div:last-child > small")?.textContent).toBe(baseline);
    fireEvent.click(bill.querySelector('[data-cost="hoa"]')!);
    expect(bill.querySelector(".bill-reading")?.textContent).toContain("Your input.");
    expect(bill.textContent).toContain("Missing is not zero");
    expect(bill.textContent).toContain("Principal into the home");
  });
  it("previews upfront cash and uses the selected planning horizon", () => {
    localStorage.setItem("hip.cost.personal.v1", JSON.stringify({years:5}));
    const {container}=render(createElement(CostToOwn,{...inputs,quiet:true,showHelp:false}));
    const summary=container.querySelector(".planning-preview > summary");
    expect(summary?.textContent).toContain("Upfront cash & the next 5 years");
    expect(summary?.textContent).toContain("upfront · estimate");
    expect(summary?.textContent).toContain("Cash at closing");
    expect(summary?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
  it("exposes the budget and rent inputs without opening a disclosure", () => {
    const {container}=render(createElement(CostToOwn,{...inputs,quiet:true,showHelp:false}));
    const income=screen.getByLabelText("Yearly household income before tax");
    const rent=screen.getByLabelText("Rent you’d pay instead, a month");
    expect(income.closest("details")).toBeNull();
    expect(rent.closest("details")).toBeNull();
    expect(container.querySelector(".cost-yours summary")?.textContent).toContain("Fine-tune the costs");
  });
  it("keeps published monthly costs and the breakdown without planning panels", () => {
    localStorage.setItem("hip.cost.personal.v1", JSON.stringify({downPct: 3.5, insuranceYear: 20000}));
    const {container} = render(createElement(CostToOwn, {...inputs, planning:false, control:false, quiet:true, showHelp:false}));
    expect(container.querySelector(".cost-yours")).toBeNull();
    expect(container.querySelector(".quiet-tool-group")).toBeNull();
    expect(screen.queryByText("Make it yours")).toBeNull();
    expect(screen.getByText("20% down payment")).toBeTruthy();
    expect(screen.getByRole("button", {name:"See the breakdown"})).toBeTruthy();
  });
  it("opens one shared breakdown from the cost-card footer and closes it again", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, quiet: true, showHelp: false }));
    const toggle = screen.getByRole("button", { name: "See the breakdown" });
    expect(toggle.parentElement?.className).toBe("cost-cards");
    const panel = container.querySelector(".shared-calculation") as HTMLElement;
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-controls")).toBe(panel.id);
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(false);
    expect(screen.getByRole("button", { name: "Hide the breakdown" }).getAttribute("aria-expanded")).toBe("true");
    expect(panel.querySelector("details")).toBeNull();
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(true);
  });
  it("works without a cross-place ID and preserves incomplete-cost caveats", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, quiet: true, showHelp: false }));
    const budget = screen.getByRole("complementary", { name: "Your budget fit", hidden: true });
    expect(budget.textContent).toContain("Add your income to check");
    fireEvent.change(screen.getByLabelText("Yearly household income before tax"), { target: { value: "100000" } });
    expect(budget.textContent).toContain("Missing:");
    expect(budget.textContent).toContain("Rent alone uses 24%");
    expect(container.querySelector('.cost-budget-fit a[href^="/afford"]')).toBeNull();
  });
  it("keeps supported county comparison links", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, comparePlaceId: 12, quiet: true, showHelp: false }));
    expect(container.querySelector('.cost-budget-fit a')?.getAttribute("href")).toBe("/afford?county=all&place=12");
  });
  it("does not render an empty budget disclosure in non-interactive reports", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, control: false, quiet: true, showHelp: false }));
    expect(container.textContent).not.toContain("Check your monthly budget");
  });
});
