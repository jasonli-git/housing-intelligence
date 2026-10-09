import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SourceFooter } from "@/components/SourceFooter";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { sources: vi.fn() } }));
vi.mock("@/components/BuiltAgo", () => ({ BuiltAgo: () => null }));

describe("SourceFooter", () => {
  it("shows required notices before provenance, history and the site notice", async () => {
    vi.mocked(api.sources).mockResolvedValue([{
      source_id: "hud_assisted", name: "HUD properties", publisher: "HUD",
      license: "Public domain", homepage: "https://www.hud.gov/", cadence: "monthly",
      url: "https://www.hud.gov/", releases: [],
      notices: ["Publisher statement https://www.hud.gov/"],
    }]);
    const html = renderToStaticMarkup((await SourceFooter())!);
    const cards = ["foot-notices", "foot-sources", "foot-links", 'class="foot-notice"'];
    const positions = cards.map((card) => html.indexOf(card));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.indexOf("Publisher statement")).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain('href="https://www.hud.gov/"');
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
    expect(html).toContain('aria-label="Site policies"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="https://github.com/jasonli-git/housing-intelligence/blob/main/LICENSE"');
    expect(html).toContain("The data is not ours to relicense");
    expect(html).toContain("its source is public");
  });
});
