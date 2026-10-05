import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Utilities } from "@/components/Utilities";
import type { Utilities as UtilityData } from "@/lib/api";

describe("ACE public filing route", () => {
  it("uses the agency search portal without claiming ACE figures are imported", () => {
    const provenance = { source_id: "eia861", kind: "electric_utility", entity_id: "utility:963",
      record_id: "963", vintage: "2024", snapshot: "2024-12-31", release_id: 1,
      file_sha256: "a".repeat(64), fetched_at: "2026-10-04" };
    const data: UtilityData = { region_id: 5, energy_context: null, providers: [{
      fuel: "electric", provider: "Atlantic City Electric", approximate_share: 1,
      territory: { ...provenance, payload: { fuel: "electric", provider: "Atlantic City Electric", eia_id: "963" } },
      electricity: { ...provenance, payload: { name: "Atlantic City Electric", year: 2024, sales: [], method: "IEEE",
        saidi_all: null, saifi_all: null, saidi_normal: null, saifi_normal: null } },
      regulatory_reliability: [],
    }] };
    const html = renderToStaticMarkup(createElement(Utilities, { data }));
    expect(html).toContain('href="https://publicaccess.bpu.state.nj.us/"');
    expect(html).toContain("Search BPU public filings");
    expect(html).toContain("BPU annual figures are not imported for this supplier");
    expect(html).not.toContain("atlanticcityelectric.com");
    expect(html).not.toContain("Read its 2024 BPU filing");
  });
});
