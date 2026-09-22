import { describe, expect, it } from "vitest";

import { rankPosition } from "@/components/RankOverview";

describe("rank overview", () => {
  it("normalizes different cohort sizes to the same rank-one-to-last axis", () => {
    expect(rankPosition(1, 21)).toBe(0);
    expect(rankPosition(11, 21)).toBe(0.5);
    expect(rankPosition(21, 21)).toBe(1);
    expect(rankPosition(18, 18)).toBe(1);
  });
});
