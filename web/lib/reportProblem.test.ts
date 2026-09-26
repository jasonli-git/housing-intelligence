import { describe, expect, it } from "vitest";

import type { Packet } from "@/lib/api";
import { reportProblemUrl, resolveFigureSource } from "@/lib/reportProblem";

function source(fields: Partial<Packet["sources"][number]>): Packet["sources"][number] {
  return {
    source_id: "zillow_zhvi",
    name: "Zillow Home Value Index",
    publisher: "Zillow Group",
    license: "Non-commercial use with attribution",
    url: "https://www.zillow.com/research/data/",
    vintage: "current",
    fetched_at: "2026-09-23T00:00:00Z",
    release_ids: [1],
    ...fields,
  };
}

describe("resolveFigureSource", () => {
  it("matches by release id first", () => {
    const sources = [
      source({ source_id: "nj_modiv", vintage: "2023", release_ids: [10] }),
      source({ source_id: "nj_modiv", vintage: "2024", release_ids: [11] }),
    ];
    expect(resolveFigureSource(sources, "nj_modiv", 11)?.vintage).toBe("2024");
  });

  it("falls back to source id when release id is null (a derived figure)", () => {
    const sources = [source({ source_id: "hip_derived", release_ids: [1, 2] })];
    expect(resolveFigureSource(sources, "hip_derived", null)).toEqual({
      name: sources[0].name,
      publisher: sources[0].publisher,
      vintage: sources[0].vintage,
      url: sources[0].url,
    });
  });

  it("returns null rather than guessing when nothing matches", () => {
    const sources = [source({ release_ids: [1] })];
    expect(resolveFigureSource(sources, "nj_modiv", 999)).toBeNull();
    expect(resolveFigureSource(sources, null, null)).toBeNull();
  });

  it("prefers the release match over a same-source-id decoy", () => {
    // Two nj_modiv rows (different tax years): a bare source_id fallback could pick
    // the wrong one, so a real release id must never fall through to it.
    const sources = [
      source({ source_id: "nj_modiv", vintage: "2023", release_ids: [10] }),
      source({ source_id: "nj_modiv", vintage: "2024", release_ids: [11] }),
    ];
    expect(resolveFigureSource(sources, "nj_modiv", 10)?.vintage).toBe("2023");
  });
});

describe("reportProblemUrl", () => {
  const base = {
    regionLabel: "Bergen County",
    metricLabel: "Home value index, single-family",
    displayValue: "$793,874",
    periodLabel: "Aug 2026",
    path: "/regions/8",
  };

  it("opens an issue on this project's own repo", () => {
    const url = new URL(reportProblemUrl({ ...base, source: null }));
    expect(url.origin + url.pathname).toBe(
      "https://github.com/jasonli-git/housing-intelligence/issues/new",
    );
  });

  it("names the region and metric in the title", () => {
    const url = new URL(reportProblemUrl({ ...base, source: null }));
    expect(url.searchParams.get("title")).toBe(
      "Figure looks wrong: Home value index, single-family, Bergen County",
    );
  });

  it("includes the value, period, page and a labels param", () => {
    const url = new URL(reportProblemUrl({ ...base, source: null }));
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("$793,874");
    expect(body).toContain("Aug 2026");
    expect(body).toContain("https://housing.jasonli.app/regions/8");
    expect(url.searchParams.get("labels")).toBe("data-quality");
  });

  it("builds the page URL from the given path, never from window", () => {
    // Statically exported: window.location at render time is either undefined (server)
    // or stale (baked into the exported HTML), so the URL must come from `path` alone.
    const url = new URL(reportProblemUrl({ ...base, source: null, path: "/regions/51" }));
    expect(url.searchParams.get("body")).toContain("https://housing.jasonli.app/regions/51");
  });

  it("names the source and its vintage when one resolved", () => {
    const url = new URL(
      reportProblemUrl({
        ...base,
        source: {
          name: "Zillow Home Value Index",
          publisher: "Zillow Group",
          vintage: "current",
          url: "https://www.zillow.com/research/data/",
        },
      }),
    );
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("Zillow Home Value Index");
    expect(body).toContain("Zillow Group");
    expect(body).toContain("vintage current");
  });

  it("says plainly when no source resolved, rather than omitting the line", () => {
    const url = new URL(reportProblemUrl({ ...base, source: null }));
    expect(url.searchParams.get("body")).toContain("Not resolved");
  });
});
