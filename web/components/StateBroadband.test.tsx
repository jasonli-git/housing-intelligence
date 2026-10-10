import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StateBroadband } from "./StateBroadband";
import type { CommunityContext } from "@/lib/api";

describe("state broadband presentation", () => {
  it("keeps missing records explicit with an address-check link", () => {
    const html = renderToStaticMarkup(<StateBroadband data={null} />);
    expect(html).toContain("No statewide availability summary is loaded");
    expect(html).toContain("https://broadbandmap.fcc.gov/");
  });
  it("shows dated offers with the correct denominator and no additive claims", () => {
    const data = { broadband: [{ payload: { technology: "All Wired", shares: {speed_100_20: .98, speed_1000_100: .79}, total_units: 4000000, as_of: "2025-12-31", revision: "2026-09-29", url: "https://broadbandmap.fcc.gov/data-download" } }] } as unknown as CommunityContext;
    const html = renderToStaticMarkup(<StateBroadband data={data} />);
    expect(html).toContain("98.0%");
    expect(html).toContain("79.0%");
    expect(html).toContain("2025-12-31");
    expect(html).toContain("4,000,000 FCC mapped units");
    expect(html).toContain("not households or people");
    expect(html).toContain("do not add their percentages");
  });
});
