import { describe, expect, it } from "vitest";

import type { Region } from "@/lib/api";
import { entryPath, matchEntries, searchEntries } from "@/lib/search";

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

  it("names counties and ZIPs as a reader does, and finds states too", () => {
    const entries = searchEntries(REGIONS);

    expect(entries.find((e) => e.id === 11)).toEqual({ id: 11, name: "Mercer County", detail: "County", level: "county" });
    expect(entries.find((e) => e.id === 3091)?.name).toBe("ZIP 08540");
    expect(entries.find((e) => e.level === "state")).toEqual({ id: 1, name: "New Jersey", detail: "State", level: "state", code: "NJ" });
  });

  it("opens a covered state's own page and every other place's region page", () => {
    const entries = searchEntries(REGIONS);

    expect(entryPath(entries.find((e) => e.id === 1)!)).toBe("/states/new-jersey");
    expect(entryPath(entries.find((e) => e.id === 11)!)).toBe("/regions/mercer-county");
    expect(entryPath({ id: 99999, name: "Ohio", detail: "State", level: "state", code: "OH" })).toBe("/regions/99999");
  });
});

describe("matchEntries", () => {
  const entries = searchEntries(REGIONS);

  it("finds a state by its postal code, ahead of places that merely contain it", () => {
    expect(matchEntries(entries, "nj")[0]?.name).toBe("New Jersey");
    expect(matchEntries(entries, "new j")[0]?.name).toBe("New Jersey");
  });

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
