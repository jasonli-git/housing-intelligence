import { describe, expect, it } from "vitest";
import { contractsFor, inventoryUrl, reportedEnds, reportedSum, soonAfterSnapshot, type HousingRecord } from "./affordableHousing";

const record = (kind: string, payload: HousingRecord["payload"], record_id = "one"): HousingRecord => ({kind, payload, record_id,
  source_id: "test", region_id: 1, place: "A town", snapshot: "2026-08-07", release_id: 1, fetched_at: "2026-10-04", source_url: "https://example.gov"});

describe("affordable housing evidence", () => {
  it("uses a live API path locally and a JSON file on artifact storage", () => {
    expect(inventoryUrl("http://localhost:8000/", "http://localhost:8000", 12)).toBe("http://localhost:8000/regions/12/affordable-housing");
    expect(inventoryUrl("https://data.example.org/", "http://localhost:8000", 12)).toBe("https://data.example.org/regions/12/affordable-housing.json");
  });
  it("keeps missing separate from reported zero and negative balances", () => {
    expect(reportedSum([record("trust_fund", {balance: null})], "balance")).toBeNull();
    expect(reportedSum([record("trust_fund", {balance: 0})], "balance")).toBe(0);
    expect(reportedSum([record("trust_fund", {balance: -100})], "balance")).toBe(-100);
  });
  it("joins contracts by property ID, never by matching a similar name", () => {
    const p = record("hud_property", {name: "Same name"}, "p1");
    const c = record("hud_contract", {name: "Same name", property_id: "other", contract_end: "2028-01-01"});
    expect(contractsFor(p, [c])).toEqual([]);
    expect(reportedEnds(p, [c])).toEqual([]);
  });
  it("does not infer a LIHTC expiry from its service year", () => {
    expect(reportedEnds(record("lihtc_property", {placed_in_service: 1995}), [])).toEqual([]);
  });
  it("filters dates against the snapshot, not the reader's current clock", () => {
    expect(soonAfterSnapshot("2031-08-07", "2026-08-07")).toBe(true);
    expect(soonAfterSnapshot("2031-08-08", "2026-08-07")).toBe(false);
    expect(soonAfterSnapshot("2025-01-01", "2026-08-07")).toBe(false);
    expect(soonAfterSnapshot(null, "2026-08-07")).toBe(false);
  });
});
