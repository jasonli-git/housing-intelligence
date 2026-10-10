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
