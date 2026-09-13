import { describe, expect, it } from "vitest";

import { firstEnd, ordinal, rankWords } from "@/lib/ranks";

describe("ordinal", () => {
  it("suffixes the way English does, teens included", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st",
      "111th", "112th",
    ]);
  });
});

describe("firstEnd", () => {
  it("names the end rank 1 is, following the measure's direction", () => {
    expect(firstEnd("change", "neutral")).toBe("largest rise first");
    expect(firstEnd("change", "higher_is_better")).toBe("largest rise first");
    expect(firstEnd("change", "lower_is_better")).toBe("smallest rise first");
    expect(firstEnd("value", "neutral")).toBe("highest first");
    expect(firstEnd("value", "lower_is_better")).toBe("lowest first");
  });
});

describe("rankWords", () => {
  it("says the basis, the cohort and the first end", () => {
    expect(rankWords(9, 21, "change", "neutral")).toBe(
      "9th of 21 by change over five years, largest rise first",
    );
    expect(rankWords(14, 21, "value", "neutral")).toBe("14th of 21 by value, highest first");
  });

  it("names the window a change rank covers", () => {
    expect(rankWords(3, 21, "change", "lower_is_better", "since 2019")).toBe(
      "3rd of 21 by change since 2019, smallest rise first",
    );
  });
});
