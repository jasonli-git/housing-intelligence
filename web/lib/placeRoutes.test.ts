import { describe, expect, it } from "vitest";
import type { Region } from "./api";
import registry from "./placeRoutes.json";
import { allocatePlaceSlugs } from "./placeSlugs";
import { placeRouteParams, readablePlaceHref, regionPath, resolveRegionId } from "./placeRoutes";

const town = (id: number, name: string, kind = "township", parent = 11): Region => ({
  region_id: id, name, name_lsad: `${name} ${kind}`, geoid: `34000${id}`, level: "municipality", state_code: "NJ", parent_id: parent,
});
const county: Region = { region_id: 11, name: "Mercer", geoid: "34021", level: "county", state_code: "NJ", parent_id: 1 };

describe("readable public place URLs", () => {
  it("uses readable names and preserves ZIP leading zeroes", () => {
    expect(regionPath(224)).toBe("/regions/princeton");
    expect(regionPath(12)).toBe("/regions/somerset-county");
    expect(regionPath(3283)).toBe("/regions/zip-07030");
    expect(regionPath(1)).toBe("/states/new-jersey");
  });

  it("resolves numeric compatibility and named routes to exactly the same data ID", () => {
    for (const [id, r] of Object.entries(registry)) {
      expect(resolveRegionId(id)).toBe(Number(id));
      expect(resolveRegionId(r.slug)).toBe(Number(id));
      expect(regionPath(r.slug)).toBe(regionPath(id));
    }
    expect(new Set(Object.values(registry).map(r => r.slug)).size).toBe(Object.keys(registry).length);
  });

  it("rejects malformed or unknown route segments, not NaN API requests", () => {
    for (const s of ["", "-224", "224junk", "0224", "1e2", "does-not-exist", "99999"]) expect(resolveRegionId(s)).toBeNull();
  });

  it("rewrites page links with queries/fragments, but leaves data endpoints alone", () => {
    expect(readablePlaceHref("/regions/224/report?print=1#sources")).toBe("/regions/princeton/report?print=1#sources");
    expect(readablePlaceHref("/regions/12#housing-assistance")).toBe("/regions/somerset-county#housing-assistance");
    expect(readablePlaceHref("/regions/1/report")).toBe("/states/new-jersey");
    for (const s of ["/regions/224/summary/5y.json", "/regions/224/report/5y.md", "https://data.example/regions/224", "/tax?town=224"]) expect(readablePlaceHref(s)).toBe(s);
  });

  it("enumerates readable and compatible pages and refuses identity drift", () => {
    expect(placeRouteParams([{ ...town(224, "Princeton"), geoid: registry["224"].geoid }])).toEqual([{ id: "princeton" }]);
    expect(() => placeRouteParams([town(99999, "New place")])).toThrow("No public slug");
    expect(() => placeRouteParams([{ ...town(224, "Princeton"), geoid: "wrong" }])).toThrow("Geographic identity changed");
  });
});

describe("stable slug allocation", () => {
  it("qualifies duplicate names by legal type and county", () => {
    const r = allocatePlaceSlugs([county, town(2, "Boonton", "town"), town(3, "Boonton")]);
    expect(r[2]).toBe("boonton-town-mercer-county");
    expect(r[3]).toBe("boonton-township-mercer-county");
  });

  it("reserves old addresses through renames and newly added namesakes", () => {
    const r = allocatePlaceSlugs([county, town(2, "Renamed"), town(3, "Princeton")], { 2: "princeton" });
    expect(r[2]).toBe("princeton");
    expect(r[3]).toBe("princeton-township-mercer-county");
  });

  it("is independent of API ordering, resolves further collisions and rejects corrupt pins", () => {
    const input = [county, town(2, "Same"), town(3, "Same")];
    expect(allocatePlaceSlugs(input)).toEqual(allocatePlaceSlugs([...input].reverse()));
    const r = allocatePlaceSlugs(input);
    expect(new Set(Object.values(r)).size).toBe(input.length);
    expect(() => allocatePlaceSlugs([], { 2: "same", 3: "same" })).toThrow("Duplicate pinned");
  });
});
