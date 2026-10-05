import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Masthead } from "@/components/Masthead";

vi.mock("@/components/PlaceSearch", () => ({ PlaceSearch: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/SiteStatus", () => ({ SiteStatus: () => null }));
vi.mock("@/components/LicenceLine", () => ({ LicenceLine: () => null }));
describe("budget entry availability", () => {
  it("renders a truly disabled, neutral entry when coverage must be chosen first", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "disabled", reason: "Choose a covered state first" }, budgetLabel: "Find within my budget" }));
    expect(html).toContain('type="button" disabled=""');
    expect(html).toContain("Find within my budget");
    expect(html).not.toContain("Budget · NJ");
    expect(html).not.toContain('href="/afford?county=all"');
  });
  it("keeps the statewide entry navigable on supported pages", () => {
    const html = renderToStaticMarkup(createElement(Masthead, { affordability: { kind: "route" } }));
    expect(html).toContain('href="/afford?county=all"');
    expect(html).toContain("Find places · NJ");
  });
});
