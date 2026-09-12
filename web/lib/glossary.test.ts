import { describe, expect, it } from "vitest";

import { withTerms } from "@/lib/glossary";

describe("withTerms", () => {
  it("marks a term inside a label", () => {
    const segments = withTerms("Low-income limit, 80% AMI, 4-person household");

    expect(segments.map((s) => s.text)).toEqual([
      "Low-income limit, 80% ",
      "AMI",
      ", 4-person household",
    ]);
    expect(segments[1].term?.key).toBe("ami");
  });

  it("marks each term once per page", () => {
    const defined = new Set<string>();

    expect(withTerms("Renters paying over 30% of income, HUD CHAS", defined).some((s) => s.term))
      .toBe(true);
    expect(withTerms("Owners paying over 30% of income, HUD CHAS", defined).some((s) => s.term))
      .toBe(false);
  });

  it("marks several different terms in one string, in order", () => {
    const keys = withTerms("ACS and CHAS").flatMap((s) => (s.term ? [s.term.key] : []));

    expect(keys).toEqual(["acs", "chas"]);
  });

  it("matches whole words only", () => {
    // "CHASE" is not CHAS, and lowercase "family" is not AMI.
    expect(withTerms("CHASE family").every((s) => !s.term)).toBe(true);
  });

  it("leaves text with no term as one plain segment", () => {
    expect(withTerms("Median household income")).toEqual([{ text: "Median household income" }]);
  });
});
