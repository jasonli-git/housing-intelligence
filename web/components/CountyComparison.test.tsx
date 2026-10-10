// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CountyComparison } from "./CountyComparison";
import type { Measure } from "@/lib/measures";

afterEach(cleanup);
const measure: Measure = {
  metric_id: "acs_median_hh_income", label: "Household income", unit: "usd", direction: "higher_better",
  windows: { "5y": { start: "2019-01-01", end: "2024-12-31", rows: [
    { id: 5, name: "Atlantic County", rank: 2, of: 21, change: 10, latest: 70000, best: 1, worst: 8, changeMargin: 2, latestMargin: 1000 },
  ] } },
};
describe("table-only county comparison", () => {
  it("keeps source uncertainty and rank basis visible without a map", () => {
    const { container } = render(createElement(CountyComparison, { initial: measure.metric_id, sections: [{ key: "incomes", title: "Incomes", rows: [measure] }] }));
    container.querySelector("details")!.open = true;
    expect(screen.getByRole("link", { name: "Atlantic County" }).getAttribute("href")).toBe("/regions/atlantic-county");
    expect(container.textContent).toContain("1–8 / 21");
    expect(container.textContent).toContain("± $1,000");
    expect(container.textContent).toContain("± 2.0%");
    expect(container.textContent).toContain("Change rank");
    expect(container.querySelector(".globe-stage")).toBeNull();
    expect(screen.getByRole("option", { name: "10 years" }).hasAttribute("disabled")).toBe(true);
  });
  it("switches the metric without silently using an unavailable window", () => {
    const other = { ...measure, metric_id: "zhvi_sfr", label: "Home value", windows: { "10y": measure.windows["5y"] } };
    const { container } = render(createElement(CountyComparison, { initial: measure.metric_id, sections: [{ key: "prices", title: "Prices", rows: [measure, other] }] }));
    container.querySelector("details")!.open = true;
    fireEvent.change(screen.getByLabelText("Measure"), { target: { value: "zhvi_sfr" } });
    expect((screen.getByLabelText("Change") as HTMLSelectElement).value).toBe("10y");
  });
  it("keeps the empty-comparison state explicit", () => {
    const { container } = render(createElement(CountyComparison, { initial: "", sections: [] }));
    expect(container.textContent).toContain("No county comparisons");
  });
});
