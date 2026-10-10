import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AffordableHousing, HousingHelpDisclosure } from "./AffordableHousing";
import type { AffordableHousing as HousingData } from "@/lib/affordableHousing";

const data: HousingData = {region_id: 12, level: "county", records: [], county_inventory_region_id: null, limitations: ["Missing is not zero"], overview: true, stats: {}};
describe("Programme panel presentation", () => {
  it("pre-expands reports and properties, but not sources or the outer panel", () => {
    const html = renderToStaticMarkup(<HousingHelpDisclosure enabled><AffordableHousing data={data} hideRoutes /></HousingHelpDisclosure>);
    expect(html).toContain('<details open=""><summary>What towns report');
    expect(html).toContain('<details open=""><summary>Explore reported properties');
    expect(html).toContain('<details class="assistance-method"><summary>Sources &amp; limits');
    expect(html).toContain('<details class="quiet-disclosure">');
  });
  it("keeps independent inventory disclosures unchanged outside the local wrapper", () => {
    const html = renderToStaticMarkup(<AffordableHousing data={data} />);
    expect(html).not.toContain('<details open=""');
  });
});
