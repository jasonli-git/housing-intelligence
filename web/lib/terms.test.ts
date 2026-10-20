import { describe, expect, it } from "vitest";

import { DEFINITIONS } from "@/lib/definitions";
import { TERMS } from "@/lib/glossary";
import { MAP_DEFINITIONS } from "@/lib/mapDefinitions";
import { TERMS_BY_ID, termOf } from "@/lib/terms";

describe("one dictionary of terms (#387)", () => {
  it("gives every entry a definition, and every titled entry a title", () => {
    for (const [id, entry] of Object.entries(TERMS_BY_ID)) {
      expect(entry.what.trim(), id).not.toBe("");
      if (entry.phrases) expect(entry.title, id).toBeTruthy();
    }
  });

  it("splits into metrics, glossary words and labels, each in one view", () => {
    const labels = Object.entries(TERMS_BY_ID).filter(([, e]) => e.title && !e.phrases?.length).map(([id]) => id);
    expect(labels).toEqual(expect.arrayContaining(["computed", "ai-interpretation", "fhfa-us-annual-change"]));
    for (const id of labels) {
      expect(DEFINITIONS[id], id).toBeUndefined();
      expect(TERMS.some((t) => t.key === id), id).toBe(false);
    }
    expect(Object.keys(DEFINITIONS).length + TERMS.length + labels.length).toBe(Object.keys(TERMS_BY_ID).length);
    for (const id of Object.keys(MAP_DEFINITIONS)) expect(DEFINITIONS[id], id).toBeDefined();
  });

  it("returns null for an id it does not know", () => {
    expect(termOf("not-a-term")).toBeNull();
  });
});
