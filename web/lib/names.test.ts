import { describe, expect, it } from "vitest";

import { displayName, peerNoun, scopeName } from "@/lib/names";

describe("displayName", () => {
  it("names a county as one", () => {
    expect(displayName({ name: "Mercer", level: "county" })).toBe("Mercer County");
  });

  it("names a ZIP as one rather than as a bare number", () => {
    expect(displayName({ name: "08540", level: "zip" })).toBe("ZIP 08540");
  });

  it("leaves a municipality's name as the warehouse has it", () => {
    expect(displayName({ name: "Montgomery", level: "municipality" })).toBe("Montgomery");
  });
});

describe("peerNoun and scopeName", () => {
  it("count the peers a rank is taken among", () => {
    expect(peerNoun("county")).toBe("counties");
    expect(peerNoun("zip")).toBe("ZIP codes");
    expect(scopeName("NJ")).toBe("New Jersey");
  });
});
