import { describe, expect, it } from "vitest";

import type { PacketLevel } from "@/lib/api";
import { commutePicture, ofHomes, sentence, transitPicture, workPicture } from "@/lib/gettingAround";

function level(metric_id: string, value: number): PacketLevel {
  return { metric_id, value, period_end: "2023-12-31" } as PacketLevel;
}

// Hoboken's 2023 LODES shares, rounded.
const hoboken = [
  level("lodes_resident_jobs", 34044),
  level("lodes_work_same_town_share", 0.083),
  level("lodes_work_home_county_share", 0.175),
  level("lodes_work_other_nj_share", 0.275),
  level("lodes_work_nyc_share", 0.507),
  level("lodes_work_pennsylvania_share", 0.005),
  level("lodes_work_other_state_share", 0.038),
];

describe("workPicture", () => {
  it("splits a town's own share out of its county's, so the places add to the whole", () => {
    const work = workPicture(hoboken, "municipality", "Hoboken")!;
    expect(work.year).toBe(2023);
    expect(work.shares.map((s) => s.key)).toEqual(["nyc", "nj", "county", "town", "other", "pa"]);
    expect(work.shares.find((s) => s.key === "county")!.share).toBeCloseTo(0.092);
    expect(work.shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 2);
    expect(work.shares.find((s) => s.key === "town")!.label).toBe("in Hoboken");
  });

  it("keeps the county whole above the town level, and says whose county", () => {
    const zip = workPicture(hoboken, "zip", "ZIP 07030")!;
    expect(zip.shares.some((s) => s.key === "town")).toBe(false);
    expect(zip.shares.find((s) => s.key === "county")!.label).toBe("in their home county");
    const county = workPicture(hoboken, "county", "Hudson County")!;
    expect(county.shares.find((s) => s.key === "county")!.label).toBe("in the county");
  });

  it("is absent where LODES's shares are not published", () => {
    expect(workPicture([level("lodes_resident_jobs", 1)], "municipality", "Pine Valley")).toBeNull();
  });

  it("drops a destination holding none of the jobs", () => {
    const work = workPicture(
      [...hoboken.filter((l) => l.metric_id !== "lodes_work_pennsylvania_share"), level("lodes_work_pennsylvania_share", 0)],
      "municipality",
      "Hoboken",
    )!;
    expect(work.shares.some((s) => s.key === "pa")).toBe(false);
  });
});

describe("transitPicture and commutePicture", () => {
  it("reads nearness to stops, and is absent without it", () => {
    expect(transitPicture([level("transit_rail_homes_share", 0.745), level("transit_bus_homes_share", 0.992)]))
      .toEqual({ rail: 0.745, bus: 0.992, any: null });
    expect(transitPicture([])).toBeNull();
  });

  it("reads the survey's commute, and is absent without it", () => {
    expect(commutePicture([level("acs_mean_commute_minutes", 33.4)])?.minutes).toBe(33.4);
    expect(commutePicture([])).toBeNull();
  });
});

describe("ofHomes and sentence", () => {
  it("reads a zero as none of the homes, and opens a sentence on a capital", () => {
    expect(sentence(`${ofHomes(0)} here are near a stop`)).toBe("None of the homes here are near a stop");
    expect(ofHomes(0.745)).toBe("75% of homes");
    expect(sentence("none drive alone")).toBe("None drive alone");
  });
});
