import { describe, expect, it } from "vitest";

import { DEFINITIONS, definitionOf } from "@/lib/definitions";
import { GROUPS } from "@/lib/groups";

// Every metric a page can show sits in a group (groups.test.ts holds that against the
// catalog), so the groups are the list every definition has to cover.
const METRICS = GROUPS.flatMap((group) => group.metrics);

describe("DEFINITIONS", () => {
  it("defines every metric a page can show", () => {
    expect(METRICS.filter((id) => !DEFINITIONS[id])).toEqual([]);
  });

  it("defines nothing a page cannot show, so none goes stale unseen", () => {
    expect(Object.keys(DEFINITIONS).filter((id) => !METRICS.includes(id))).toEqual([]);
  });

  it("keeps every definition short enough to read in a tooltip", () => {
    for (const [id, { what, why }] of Object.entries(DEFINITIONS)) {
      expect(what.length, id).toBeGreaterThan(20);
      expect(why.length, id).toBeGreaterThan(20);
      expect(`${what} ${why}`.length, id).toBeLessThan(330);
    }
  });
});

describe("definitionOf", () => {
  it("is null for a metric it does not know", () => {
    expect(definitionOf("something_new")).toBeNull();
    expect(definitionOf("zhvi_sfr")?.what).toContain("single-family");
  });
});
