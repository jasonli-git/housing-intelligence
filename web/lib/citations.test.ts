import { describe as suite, expect, it } from "vitest";

import type { Citation, CitedRelease } from "@/lib/api";
import { describe, period, segment, sourceOf, whatItIs } from "@/lib/citations";

function cite(body: string, text: string, overrides: Partial<Citation> = {}): Citation {
  const start = body.indexOf(text);
  return {
    text,
    start,
    end: start + text.length,
    value: 0,
    packet_value: 0,
    field: "levels[zhvi_sfr].value",
    kind: "value",
    metric_id: "zhvi_sfr",
    label: "Home value",
    period_start: "2026-06-01",
    period_end: "2026-06-30",
    match_method: "fips",
    release_ids: [7],
    alternatives: 0,
    ...overrides,
  };
}

const releases: CitedRelease[] = [
  {
    release_id: 7,
    source_id: "zillow_zhvi",
    name: "Zillow Home Value Index",
    publisher: "Zillow Research",
    vintage: "current",
    fetched_at: "2026-07-15T10:00:00Z",
  },
  {
    release_id: 9,
    source_id: "census_acs",
    name: "American Community Survey, 5-year estimates",
    publisher: "U.S. Census Bureau",
    vintage: "2023",
    fetched_at: "2026-09-01T10:00:00Z",
  },
];

suite("segment", () => {
  it("marks each cited figure and keeps the text around it", () => {
    const body = "Values reached $452,500, up 4.7%.";
    const runs = segment(body, [cite(body, "$452,500"), cite(body, "4.7%")]);

    expect(runs).toHaveLength(1);
    expect(runs[0].map((run) => run.text).join("")).toBe(body);
    expect(runs[0].filter((run) => run.citation).map((run) => run.text)).toEqual([
      "$452,500",
      "4.7%",
    ]);
  });

  it("splits paragraphs on blank lines, as the panel always has", () => {
    const body = "First $1.\n\nSecond $2.";
    const runs = segment(body, [cite(body, "$2")]);

    expect(runs).toHaveLength(2);
    expect(runs[0].map((run) => run.text).join("")).toBe("First $1.");
    expect(runs[1].find((run) => run.citation)?.text).toBe("$2");
  });

  it("drops a citation whose span no longer holds its figure", () => {
    const body = "Values reached $452,500.";
    const stale = { ...cite(body, "$452,500"), start: 0, end: 8 };
    const runs = segment(body, [stale]);

    expect(runs[0]).toEqual([{ text: body }]);
  });

  it("renders unbound text unchanged when there are no citations", () => {
    expect(segment("Plain prose.", [])).toEqual([[{ text: "Plain prose." }]]);
  });
});

suite("describing a citation", () => {
  it("names the metric and the quantity", () => {
    const body = "Rose 4.7%.";
    expect(whatItIs(cite(body, "4.7%", { kind: "change" }))).toBe(
      "Home value — change over the window",
    );
  });

  it("gives a window as a span and a reading as a date", () => {
    const body = "x";
    expect(period(cite(body, "x", { period_start: "2021-06-30" }))).toBe(
      "2021-06-30 → 2026-06-30",
    );
    expect(period(cite(body, "x", { period_start: null }))).toBe("as of 2026-06-30");
    expect(period(cite(body, "x", { period_start: null, period_end: null }))).toBe("—");
  });

  it("identifies a moving file by when it was retrieved and an edition by its year", () => {
    const body = "x";
    expect(sourceOf(cite(body, "x"), releases)).toBe(
      "Zillow Home Value Index, retrieved 2026-07-15",
    );
    expect(sourceOf(cite(body, "x", { release_ids: [9, 7] }), releases)).toBe(
      "American Community Survey, 5-year estimates, 2023; " +
        "Zillow Home Value Index, retrieved 2026-07-15",
    );
  });

  it("says when the same number sits in several fields", () => {
    const body = "x";
    expect(describe(cite(body, "x", { alternatives: 2 }), releases)).toContain(
      "2 other field(s) in the packet hold the same number",
    );
  });
});
