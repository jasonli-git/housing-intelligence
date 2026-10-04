import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AffordableHousing } from "@/components/AffordableHousing";
import type { AffordableHousing as HousingData, HousingRecord } from "@/lib/affordableHousing";

function render(payload: HousingRecord["payload"]) {
  const data: HousingData = {
    region_id: 12, level: "county", overview: false, stats: {}, limitations: [],
    county_inventory_region_id: null,
    records: [{source_id: "hud_lihtc", kind: "lihtc_property", record_id: "example",
      region_id: 12, place: "Example County", snapshot: "2024-12-31", release_id: 1,
      fetched_at: "2026-10-04", source_url: "https://www.huduser.gov/", payload}],
  };
  return renderToStaticMarkup(createElement(AffordableHousing, {data}));
}

describe("LIHTC bulk disclosures", () => {
  it("shows coverage, exceptional service years and discontinued monitoring separately", () => {
    const html = render({name: "Example", coverage_through: 2024, placed_in_service: 2025,
      service_year_status: "after coverage year", no_longer_monitored: true,
      affordability_years: 45, resyndicated: true, location_scope: "county"});
    expect(html).toContain("Bulk coverage through 2024");
    expect(html).toContain("reported service year falls after this release");
    expect(html).toContain("No longer monitored for LIHTC compliance");
    expect(html).toContain("continued affordability is not established");
    expect(html).toContain("not an expiration date");
    expect(html).toContain("may repeat an earlier development");
    expect(html).toContain("municipality not established");
    expect(html).not.toContain("public map copy reaches 2020");
  });
  it("does not turn a blank monitoring status into active participation", () => {
    const html = render({coverage_through: 2024, no_longer_monitored: null,
      placed_in_service: null, service_year_status: "unconfirmed"});
    expect(html).toContain("LIHTC monitoring status not reported");
    expect(html).toContain("placed-in-service status unconfirmed");
    expect(html).not.toContain("Not flagged as no longer monitored");
  });
});
