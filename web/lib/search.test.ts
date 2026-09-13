import { describe, expect, it } from "vitest";

import type { Region } from "@/lib/api";
import { matchEntries, searchEntries } from "@/lib/search";

function region(region_id: number, level: string, name: string, name_lsad: string, parent_id: number | null = null): Region {
  return { region_id, geoid: String(region_id), level, name, name_lsad, state_code: "NJ", parent_id };
}

const REGIONS = [
  region(14, "county", "Morris", "Morris County"),
  region(11, "county", "Mercer", "Mercer County"),
  region(301, "municipality", "Boonton", "Boonton town", 14),
  region(302, "municipality", "Boonton", "Boonton township", 14),
  region(303, "municipality", "Mercerville", "Mercerville CDP", 11),
  region(304, "municipality", "West Windsor", "West Windsor township", 11),
  region(3091, "zip", "08540", "08540"),
  region(1, "state", "New Jersey", "New Jersey"),
];

describe("searchEntries", () => {
  it("tells two same-named places apart by legal type and county", () => {
    const boontons = searchEntries(REGIONS).filter((e) => e.name === "Boonton");

    expect(boontons.map((e) => e.detail).sort()).toEqual([
      "Town in Morris County",
      "Township in Morris County",
    ]);
  });

  it("names counties and ZIPs as a reader does, and leaves the state out", () => {
    const entries = searchEntries(REGIONS);

    expect(entries.find((e) => e.id === 11)).toEqual({ id: 11, name: "Mercer County", detail: "County", level: "county" });
    expect(entries.find((e) => e.id === 3091)?.name).toBe("ZIP 08540");
    expect(entries.some((e) => e.level === "state")).toBe(false);
  });
});

describe("matchEntries", () => {
  const entries = searchEntries(REGIONS);

  it("ranks a name that starts with the query above one that merely contains it", () => {
    expect(matchEntries(entries, "mercer").map((e) => e.name)).toEqual(["Mercer County", "Mercerville"]);
  });

  it("matches the start of any word, and ZIP digits", () => {
    expect(matchEntries(entries, "wind").map((e) => e.name)).toEqual(["West Windsor"]);
    expect(matchEntries(entries, "085").map((e) => e.name)).toEqual(["ZIP 08540"]);
  });

  it("ignores case and extra spaces, and finds nothing for nothing", () => {
    expect(matchEntries(entries, "  BOONTON ")).toHaveLength(2);
    expect(matchEntries(entries, "   ")).toEqual([]);
  });
});
