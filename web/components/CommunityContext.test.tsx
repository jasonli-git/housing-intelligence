import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityContext } from "./CommunityContext";
import type { CommunityContext as Data, CommunityRecord, CrimeAgency, HealthEstimate, BroadbandSummary } from "@/lib/api";

function record<T>(payload: T): CommunityRecord<T> {
  return { source_id: "test", kind: "test", entity_id: "county:34021", record_id: "test", payload, snapshot: null, release_id: 1, release_layer: "test", vintage: "current", file_sha256: "sha", fetched_at: "2026-10-07" };
}
const empty: Data = { region_id: 1, districts: [], health: [], health_area: null, health_level: null, crime: [], crime_county: null, broadband_status: "pending_download", broadband: [], broadband_area: null, broadband_level: null };

describe("community components", () => {
  it("states missingness, not safety or availability", () => {
    const html = renderToStaticMarkup(<CommunityContext data={empty} level="zip" />);
    expect(html).toContain("ZIP areas do not identify a police jurisdiction");
    expect(html).toContain("does not mean zero crime");
    expect(html).toContain("No ZIP-level summary has been matched");
    expect(html).toContain("public website downloads do not require an account");
  });
  it("hides incomplete annual counts but keeps legitimate reported zero", () => {
    const crime = (complete: boolean, total: number): CrimeAgency => ({ agency: "Agency", ori: complete ? "full" : "partial", county: "Mercer", year: 2023, months_reported: complete ? 12 : 0, complete, reported_offenses: total, counts: {}, url: "https://nj.gov/" });
    const html = renderToStaticMarkup(<CommunityContext data={{ ...empty, crime_county: "Mercer", crime: [record(crime(false, 123456)), record(crime(true, 0))] }} level="municipality" />);
    expect(html).toContain("Incomplete reporting");
    expect(html).not.toContain("123,456");
    expect(html).toContain('class="num">0</td>');
    expect(html).toContain("not this town’s crime rate");
    expect(html).toContain("1/2 listed agencies reported 12 months");
  });
  it("labels county health, year and 95% interval without repurposing survey margins", () => {
    const health: HealthEstimate = { measure: "GHLTH", label: "Fair or poor health among adults", year: 2023, release: "2025", value: 12, low: 10, high: 14, confidence: 95, suppression: null, basis: "Modelled", url: "https://data.cdc.gov/" };
    const html = renderToStaticMarkup(<CommunityContext data={{ ...empty, health: [record(health)], health_area: "Mercer", health_level: "county" }} level="municipality" />);
    expect(html).toContain("county’s estimates, not measurements of this town");
    expect(html).toContain("2023 measurement basis");
    expect(html).toContain("2025 release");
    expect(html).toContain("95% interval 10.0–14.0%");
  });
  it("keeps school suppression and unmatched district performance visible", () => {
    const boundary = record({ district_id: "01-0010", name: "District", district_type: "unified", approximate_share: 1 });
    const performance = record({ district_id: "01-0010", name: "District", school_year: "2024-2025", url: "https://nj.gov/", notes: ["Publisher caution"], indicators: [{ id: "math", label: "Math", value: null, suppression: "Fewer than 10 valid scores", basis: "All Students" }] });
    const html = renderToStaticMarkup(<CommunityContext data={{ ...empty, districts: [{ boundary, performance }, { boundary: { ...boundary, record_id: "other" }, performance: null }] }} level="county" />);
    expect(html).toContain("Fewer than 10 valid scores");
    expect(html).toContain("No matching performance record");
    expect(html).toContain("Publisher caution");
    expect(html).toContain("A district is not a school assignment");
  });
  it("labels county broadband as unit shares, not town or household coverage", () => {
    const summary: BroadbandSummary = { name: "Mercer", technology: "All Wired", as_of: "2025-12-31", revision: "2026-09-29", total_units: 1000, biz_res: "R", area_data_type: "Total", shares: { speed_100_20: 0.98, speed_1000_100: 0 }, basis: "Published", denominator: "FCC units", url: "https://broadbandmap.fcc.gov/data-download" };
    const html = renderToStaticMarkup(<CommunityContext data={{ ...empty, broadband: [record(summary)], broadband_area: "Mercer", broadband_level: "county", broadband_status: "published_summary" }} level="municipality" />);
    expect(html).toContain("County context, not this town’s availability");
    expect(html).toContain("98.0%");
    expect(html).toContain("0.0%");
    expect(html).toContain("not shares of people, subscribers or households");
    expect(html).toContain("Availability as of 2025-12-31");
    expect(html).toContain("revised 2026-09-29");
    expect(html).not.toContain("No matching availability summary");
  });
});
