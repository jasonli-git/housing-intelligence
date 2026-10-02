import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  matchStreets,
  normaliser,
  numberMatches,
  parcelsOn,
  parseAddress,
  parseQuery,
  placesFor,
  shardOf,
  type StreetMeta,
  type StreetShard,
  type StreetWords,
} from "@/lib/addressSearch";
import { countyLookup } from "@/lib/countyLookups";

// The table and the cases are the Python side's own files, so the page and the index
// builder are tested against one definition (Milestone 38).
const ROOT = resolve(__dirname, "../..");
const WORDS: StreetWords = JSON.parse(readFileSync(resolve(ROOT, "src/hip/street_words.json"), "utf8"));
delete (WORDS as Record<string, unknown>)._comment;
const CASES = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/address_cases.json"), "utf8")) as {
  same: [string, string][];
  parsed: [string, string | null, string][];
};
const N = normaliser(WORDS);

describe("parseAddress", () => {
  it.each(CASES.same)("reads %s as the assessor's %s", (typed, assessor) => {
    expect(parseAddress(typed, N)).toEqual(parseAddress(assessor, N));
  });

  it.each(CASES.parsed)("parses %s", (address, number, street) => {
    expect(parseAddress(address, N)).toEqual({ number, street });
  });
});

const SHARD: StreetShard = {
  "DANBY CT": { "3403547580": ["1", "2", "3", "4", "5", "6"] },
  "DANBY PL": { "3402959910": ["3", "5", "20"] },
};
const MAIN: StreetShard = {
  "MAIN ST": {
    "3401732250": ["4", "100"],
    "3402160900": ["4"],
    "3403547580": ["2-6"],
  },
  "MAIN ST EXT": { "3402160900": ["4"] },
};
const META: StreetMeta = {
  shards: ["DA", "MA"],
  towns: {
    "3403547580": ["Montgomery", "Somerset", "1813"],
    "3402160900": ["Princeton", "Mercer", "1114"],
    "3402959910": ["Point Pleasant Beach", "Ocean", "1525"],
    "3401732250": ["Hoboken", "Hudson", "0905"],
  },
  zips: { "08540": ["3402160900", "3402180240", "3403547580"] },
  words: WORDS,
};

describe("parseQuery", () => {
  it("takes apart a full mailing address", () => {
    expect(parseQuery("4 Danby Ct, Princeton NJ 08540", N)).toEqual({
      number: "4",
      street: ["DANBY", "CT"],
      partial: "",
      hint: ["PRINCETON"],
      zip: "08540",
    });
  });

  it("waits for two characters of street", () => {
    expect(parseQuery("4 D", N)).toBeNull();
    expect(parseQuery("4 Da", N)?.street).toEqual(["DA"]);
  });
});

describe("matchStreets and placesFor", () => {
  const find = (text: string, shard: StreetShard) => {
    const query = parseQuery(text, N)!;
    expect(shardOf(query.street.join(" "))).toBe(shardOf(Object.keys(shard)[0]));
    return placesFor(matchStreets(shard, query, N), query, META, N);
  };

  it("finds Danby Court in Montgomery, though the mail says Princeton", () => {
    expect(find("4 Danby Ct, Princeton NJ 08540", SHARD)).toEqual([
      { street: "DANBY CT", geoid: "3403547580" },
    ]);
  });

  it("matches a suffix still being typed, in any spelling", () => {
    for (const text of ["4 danby c", "4 danby cou", "4 danby court"]) {
      expect(find(text, SHARD).map((h) => h.street)).toEqual(["DANBY CT"]);
    }
  });

  it("lists every street a half-typed name begins, without a number", () => {
    expect(find("danb", SHARD).map((h) => h.street)).toEqual(["DANBY CT", "DANBY PL"]);
  });

  it("only offers towns that have the house number", () => {
    expect(find("20 danby", SHARD).map((h) => h.geoid)).toEqual(["3402959910"]);
    expect(find("9 danby ct", SHARD)).toEqual([]);
  });

  it("ranks a ZIP's towns first, then a named town, and prefers the street typed in full", () => {
    expect(find("4 Main St 08540", MAIN).map((h) => h.geoid)).toEqual([
      "3402160900",
      "3403547580",
      "3401732250",
    ]);
    expect(find("4 Main St Hoboken", MAIN)[0].geoid).toBe("3401732250");
    // "Main St Ext" is not "Main St".
    expect(find("4 Main St", MAIN).every((h) => h.street === "MAIN ST")).toBe(true);
  });

  it("reads a range of house numbers as one side of the street", () => {
    expect(numberMatches("2-6", "6")).toBe(true);
    expect(numberMatches("2-6", "4")).toBe(true);
    expect(numberMatches("2-6", "3")).toBe(false);
    expect(numberMatches("2-6", "8")).toBe(false);
    expect(numberMatches("14", "4")).toBe(false);
  });
});

describe("countyLookup", () => {
  it("opens the county boards' shared search on the town", () => {
    expect(countyLookup("Somerset", "1813")).toBe(
      "https://taxrecords-nj.com/pub/cgi/prc6.cgi?district=1813&ms_user=ctb18",
    );
  });

  it("sends Camden and Ocean to their own", () => {
    expect(countyLookup("Camden", "0401")).toContain("taxdatahub.com");
    expect(countyLookup("Ocean", "1525")).toContain("tax.co.ocean.nj.us");
  });
});

describe("parcelsOn", () => {
  const parcels = [
    { address: "6 DANBY COURT" },
    { address: "4 DANBY COURT" },
    { address: "4 DANBY PL" },
    { address: "2-6 MAIN ST" },
    { address: null },
  ];

  it("finds a house on its street, units and spelling aside", () => {
    expect(parcelsOn(parcels, "DANBY CT", "4", N)).toEqual([{ address: "4 DANBY COURT" }]);
    expect(parcelsOn(parcels, "MAIN ST", "4", N)).toEqual([{ address: "2-6 MAIN ST" }]);
  });

  it("lists a whole street in house-number order without a number", () => {
    expect(parcelsOn(parcels, "DANBY CT", null, N).map((p) => p.address)).toEqual([
      "4 DANBY COURT",
      "6 DANBY COURT",
    ]);
  });
});
