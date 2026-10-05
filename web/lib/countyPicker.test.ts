import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountyPicker } from "@/components/CountyPicker";
import { matchingCounties } from "./countyPicker";

const counties = [{ id: 12, name: "Somerset County" }, { id: 5, name: "Atlantic County" }];
describe("county page discovery", () => {
  it("filters case-insensitively, sorts names and leaves its input intact", () => {
    expect(matchingCounties(counties, " ATL ")).toEqual([counties[1]]);
    expect(matchingCounties(counties, "").map((c) => c.id)).toEqual([5, 12]);
    expect(matchingCounties(counties, "missing")).toEqual([]);
    expect(counties[0].id).toBe(12);
  });
  it("renders real county links in a native disclosure independent of rankings", () => {
    const html = renderToStaticMarkup(createElement(CountyPicker, { counties }));
    expect(html).toContain("Explore counties");
    expect(html).toContain('href="/regions/12"');
    expect(html).toContain('href="/regions/5"');
    expect(html).toContain('type="search"');
    expect(html).not.toContain('role="dialog"');
  });
});
