import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AffordExplorer } from "@/components/AffordExplorer";
import type { Place } from "./afford";

const county: Place = { id: 5, name: "Atlantic County", level: "county", detail: null, home: 300000, rent: 1800, tax: 6000 };
const base = { counties: [county], towns: [], rate: { value: 6, asOf: "2026-09-01" }, asOf: { home: "2026-08", rent: "2026-08", tax: "2025" } };
describe("budget explorer presentation", () => {
  it("makes statewide scope and the empty-income starting point explicit", () => {
    const html = renderToStaticMarkup(createElement(AffordExplorer, base));
    expect(html).toContain("all New Jersey");
    expect(html).toContain("Start with your income");
    expect(html).toContain("not loan approval");
    expect(html).toContain('data-view="list"');
    expect(html).not.toContain('class="globe-stage"');
  });
  it("names a local scope and offers a statewide escape", () => {
    const html = renderToStaticMarkup(createElement(AffordExplorer, { ...base, scope: { countyId: 5, countyName: county.name } }));
    expect(html).toContain("Searching <b>Atlantic County</b>");
    expect(html).toContain("Search all New Jersey");
    expect(html).toContain("Check one place · Atlantic County");
  });
});
