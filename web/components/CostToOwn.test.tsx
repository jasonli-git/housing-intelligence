// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CostToOwn, type CostProps } from "./CostToOwn";

afterEach(() => { cleanup(); localStorage.clear(); });
const inputs: CostProps = {
  state: "NJ",
  home: { basis: "index", value: 400000, asOf: "Aug 2026" },
  rate: { value: 6.81, asOf: "Sep 2026" },
  tax: null, insurance: null, utilities: null, rentersPayUtilities: null,
  rent: { value: 2000, asOf: "Aug 2026" },
  noTax: "No ZIP-level tax estimate", gain: null, rateThen: null,
};
describe("a state whose rules are not held", () => {
  it("shows its costs without New Jersey's fees, deposit cap or relief, and says so", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, state: "PA", quiet: true }));
    const text = container.textContent ?? "";
    expect(text).not.toContain("New Jersey");
    expect(container.querySelector(".cost-relief")).toBeNull();
  });
  it("keeps New Jersey's where they apply", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, quiet: true }));
    expect(container.textContent).toContain("the most a New Jersey landlord may ask");
    expect(container.querySelector(".cost-relief")).not.toBeNull();
  });
});
describe("local monthly budget", () => {
  it("keeps cash as the compact headline and explains equity only inside the breakdown", () => {
    const {container}=render(createElement(CostToOwn,{...inputs,quiet:true,compactOverview:true}));
    expect(container.querySelector('.cost-card .cost-figure')?.textContent).toContain('estimated cash paid each month, including principal');
    expect(container.querySelector('.place-cost-overview > .cost-monthly-headline')).toBeNull();
    const bridge=screen.getByRole('group',{name:'Ownership cost after principal',hidden:true});
    const panel=container.querySelector('.shared-calculation') as HTMLElement;
    expect(panel.contains(bridge)).toBe(true);
    expect(panel.hidden).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'See the breakdown'}));
    expect(panel.hidden).toBe(false);
    expect(bridge.textContent).toContain('This is not the cash needed each month');
    const headline=container.querySelector('.cost-card .cost-figure b')?.textContent;
    fireEvent.change(screen.getByLabelText('Purchase price'),{target:{value:'600000'}});
    expect(container.querySelector('.cost-card .cost-figure b')?.textContent).not.toBe(headline);
    fireEvent.click(screen.getByRole('button',{name:'Use the published figures'}));
    expect(container.querySelector('.cost-card .cost-figure b')?.textContent).toBe(headline);
  });
  it("groups compact scenario controls and resets edited costs to their starting figures", () => {
    const { container } = render(createElement(CostToOwn, { ...inputs, quiet: true, compactOverview: true }));
    const group = screen.getByRole("group", { name: "Use your numbers" });
    expect(group.contains(screen.getByLabelText("Down payment"))).toBe(true);
    expect(group.contains(screen.getByLabelText("Purchase price"))).toBe(true);
    const total = container.querySelector(".cost-card .cost-figure b")?.textContent;
    fireEvent.change(screen.getByLabelText("Purchase price"), { target: { value: "600000" } });
    expect(container.querySelector(".cost-card .cost-figure b")?.textContent).not.toBe(total);
    fireEvent.click(screen.getByRole("button", { name: "Use the published figures" }));
    expect(container.querySelector(".cost-card .cost-figure b")?.textContent).toBe(total);
    expect(container.querySelectorAll(".cost-ownership-breakdown .gone-kept").length).toBe(1);
  });
  it("keeps compact controls visible and sends deeper planning to the tools",()=>{
    const {container}=render(createElement(CostToOwn,{...inputs,quiet:true,compactOverview:true,guidePlaceId:224,comparePlaceId:224}));
    for(const label of ['Purchase price','Down payment','Yearly household income before tax'])expect(screen.getByLabelText(label).closest('details')).toBeNull();
    expect(screen.queryByLabelText('Cash available for buying')).toBeNull();
    expect(screen.queryByLabelText('Rent you’d pay instead, a month')).toBeNull();
    expect(container.querySelector('.planning-preview-grid')).toBeNull();
    expect(container.querySelector('.monthly-bill')).toBeNull();
    expect(screen.getByText('More assumptions').closest('details')?.open).toBe(false);
    fireEvent.change(screen.getByLabelText('Yearly household income before tax'),{target:{value:'100000'}});
    expect(container.querySelector('.cost-budget-result')?.textContent).toContain('% of your income before tax');
    expect(container.querySelector('.cost-budget-result')?.textContent).toContain('missing:');
    expect(screen.getByRole('link',{name:'Find your fit →'}).getAttribute('href')).toContain('income=100000');
    fireEvent.change(screen.getByLabelText('Purchase price'),{target:{value:'600000'}});
    const link=screen.getByRole('link',{name:'Check upfront cash & rent vs. buy →'});
    expect(link.getAttribute('href')).toBe('/guide?place=224');
    fireEvent.click(link);
    expect(JSON.parse(sessionStorage.getItem('hip.guide.home.v1')??'{}').home.price).toBe(600000);
  });
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
  it("describes Zillow's home value only beside a card it priced", () => {
    const zillow = render(createElement(CostToOwn, { ...inputs, quiet: true, showHelp: false }));
    expect(zillow.container.textContent).toContain("while its home value covers single-family houses only");
    cleanup();
    const sales = { basis: "transactions" as const, value: 520000, asOf: "Jun 2026", from: "Jan 2024", to: "Jun 2026" };
    const deeds = render(createElement(CostToOwn, { ...inputs, home: sales, quiet: true, showHelp: false }));
    expect(deeds.container.textContent).toContain("Zillow’s rent covers every kind of rental home, mostly apartments, while the price here is the middle of recent residential sales.");
    expect(deeds.container.textContent).not.toContain("its home value");
  });
});
