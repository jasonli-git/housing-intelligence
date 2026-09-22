import { describe, expect, it } from "vitest";
import type { PacketLevel } from "@/lib/api";
import { stateProfile } from "./stateProfile";

function level(metric_id: string, value = 442.7): PacketLevel {
  return { metric_id, label: metric_id, unit: "index", direction: "neutral", value,
    period_start: "2026-04-01", period_end: "2026-06-30", rank: null, of: null,
    percentile: null, release_id: 1, source_id: "fhfa_hpi", match_method: "exact" };
}

describe("statewide profile", () => {
  it("keeps population in the separate population card, not in the profile carousel", () => {
    expect(stateProfile([level("pep_population"), level("acs_population")])).toEqual([]);
  });
  it("retains both indexes and their distinct baselines and dates without inventing ranks", () => {
    const items = stateProfile([level("fhfa_hpi"), level("fhfa_hpi_all_transactions", 967.6)]);
    expect(items.map((item) => item.value)).toEqual(["442.7", "967.6"]);
    expect(items[0].context).toEqual({ words: "Q2 2026 · 1991 Q1 = 100", rank: null });
    expect(items[1].context).toEqual({ words: "Q2 2026 · 1980 Q1 = 100", rank: null });
    expect(items[0].definition).toContain("An index, not a price");
  });
  it("preserves other published levels and handles missing data without placeholder figures", () => {
    expect(stateProfile([])).toEqual([]);
    const item = stateProfile([{ ...level("sr1a_median_sale_price", 520000), unit: "usd" }])[0];
    expect(item.value).toBe("$520,000");
    expect(item.context).toEqual({ words: "Jun 2026", rank: null });
    expect(item.definition).toContain("open-market");
  });
});
