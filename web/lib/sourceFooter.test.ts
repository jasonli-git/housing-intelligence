import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SourceFooter } from "@/components/SourceFooter";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { sources: vi.fn() } }));
vi.mock("@/components/BuiltAgo", () => ({ BuiltAgo: () => null }));

describe("SourceFooter", () => {
  it("shows required notices before provenance, history and the site notice", async () => {
    vi.mocked(api.sources).mockResolvedValue([{
      source_id: "census_acs", name: "ACS", publisher: "Census Bureau",
      license: "Public domain", homepage: "https://www.census.gov/", cadence: "annual",
      url: "https://www.census.gov/", releases: [],
      notices: ["Publisher statement https://www.census.gov/"],
    }]);
    const html = renderToStaticMarkup((await SourceFooter())!);
    const cards = ["foot-notices", "foot-sources", "foot-links", 'class="foot-notice"'];
    const positions = cards.map((card) => html.indexOf(card));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.indexOf("Publisher statement")).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain('href="https://www.census.gov/"');
    expect(html).toContain('href="/sources"');
  });

  it("keeps three notices in the footer and leaves the rest to /sources", async () => {
    const source = (source_id: string, notices: string[]) => ({
      source_id, name: source_id, publisher: source_id, license: "Public domain",
      homepage: "https://example.gov/", cadence: "annual", url: "https://example.gov/", releases: [], notices,
    });
    vi.mocked(api.sources).mockResolvedValue([
      source("census_acs", ["Census API notice"]),
      source("fred", ["This product uses the FRED® API notice", "Freddie Mac series citation"]),
      source("zillow_zhvi", ["Data Provided by Zillow Group."]),
      source("fhfa_hpi", ["FHFA notice"]),
      source("njdep_lead_lines", ["NJDEP notice"]),
    ]);
    const html = renderToStaticMarkup((await SourceFooter())!);
    const notices = html.slice(html.indexOf("foot-notices"), html.indexOf("foot-sources"));
    for (const shown of ["Census API notice", "FRED® API notice", "Data Provided by Zillow Group."]) expect(notices).toContain(shown);
    for (const moved of ["Freddie Mac series citation", "FHFA notice", "NJDEP notice"]) expect(notices).not.toContain(moved);
    expect(notices).toContain('href="/sources"');
  });

  it("omits the publisher card when sources have no required statements", async () => {
    vi.mocked(api.sources).mockResolvedValue([{
      source_id: "hud_lihtc", name: "LIHTC", publisher: "HUD",
      license: "Public domain", homepage: "https://www.hud.gov/", cadence: "annual",
      url: "https://www.hud.gov/", releases: [],
    }]);
    const html = renderToStaticMarkup((await SourceFooter())!);
    expect(html).not.toContain("foot-notices");
    expect(html).toContain("Data provenance");
    expect(html).toContain('class="foot-notice-head"');
    expect(html).toContain('class="notice-external-icon"');
    expect(html).toContain('aria-label="Site policies"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="https://github.com/jasonli-git/housing-intelligence/blob/main/LICENSE"');
    expect(html).toContain("The data is not ours to relicense");
    expect(html).toContain("its source is public");
  });
});
