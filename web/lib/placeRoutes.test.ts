import { describe, expect, it } from "vitest";
import type { Region } from "./api";
import registry from "./placeRoutes.json";
import { allocatePlaceSlugs } from "./placeSlugs";
import { placeRouteParams, readablePlaceHref, regionPath, resolvePlace } from "./placeRoutes";

const town = (id: number, name: string, kind = "township", parent = 11): Region => ({
  region_id: id, name, name_lsad: `${name} ${kind}`, geoid: `34000${id}`, level: "municipality", state_code: "NJ", parent_id: parent,
});
const county: Region = { region_id: 11, name: "Mercer", geoid: "34021", level: "county", state_code: "NJ", parent_id: 1 };

describe("readable public place URLs", () => {
  it("puts the state in every place address and preserves ZIP leading zeroes", () => {
    expect(regionPath(224)).toBe("/nj/princeton");
    expect(regionPath(12)).toBe("/nj/somerset-county");
    expect(regionPath(3283)).toBe("/nj/zip-07030");
    expect(regionPath(1)).toBe("/states/new-jersey");
    expect(regionPath(16828)).toBe("/");
  });

  it("resolves every address to exactly its own data ID, and addresses are unique", () => {
    for (const [id, r] of Object.entries(registry)) {
      expect(resolvePlace(r.state, r.slug)).toBe(Number(id));
      expect(regionPath(id)).toBe(`/${r.state}/${r.slug}`);
    }
    const paths = Object.values(registry).map(r => `${r.state}/${r.slug}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("rejects unknown or mis-stated addresses rather than guessing an ID", () => {
    for (const [state, slug] of [["nj", ""], ["nj", "224"], ["nj", "does-not-exist"], ["pa", "princeton"], ["NJ", "princeton"]]) {
      expect(resolvePlace(state, slug)).toBeNull();
    }
  });

  it("rewrites page links with queries/fragments, but leaves data endpoints alone", () => {
    expect(readablePlaceHref("/regions/224/report?print=1#sources")).toBe("/nj/princeton/report?print=1#sources");
    expect(readablePlaceHref("/regions/12#housing-assistance")).toBe("/nj/somerset-county#housing-assistance");
    expect(readablePlaceHref("/regions/1/report")).toBe("/states/new-jersey");
    for (const s of ["/regions/224/summary/5y.json", "/regions/224/report/5y.md", "https://data.example/regions/224", "/tax?town=224"]) expect(readablePlaceHref(s)).toBe(s);
  });

  it("enumerates one page per place and refuses identity drift", () => {
    expect(placeRouteParams([{ ...town(224, "Princeton"), geoid: registry["224"].geoid }])).toEqual([{ state: "nj", place: "princeton" }]);
    expect(() => placeRouteParams([town(99999, "New place")])).toThrow("No public address");
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
    expect(() => allocatePlaceSlugs([town(2, "A"), town(3, "B")], { 2: "same", 3: "same" })).toThrow("Duplicate pinned");
  });

  it("lets two states share a name, since the state is in the address", () => {
    const pa: Region = { ...county, region_id: 50, geoid: "42027", state_code: "PA" };
    const r = allocatePlaceSlugs([county, pa]);
    expect(r[11]).toBe("mercer-county");
    expect(r[50]).toBe("mercer-county");
  });
});
