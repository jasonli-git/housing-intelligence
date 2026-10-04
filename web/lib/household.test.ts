import { afterEach, describe, expect, it } from "vitest";

import {
  type IncomeLimits,
  lineFor,
  positionOf,
  positionSentence,
  readHousehold,
  writeHousehold,
} from "@/lib/household";

// Hudson County's FY2026 lines as HUD publishes them, one to eight people.
const HUDSON: IncomeLimits = {
  region_id: 4,
  county_id: 4,
  county_name: "Hudson",
  via: "self",
  fiscal_year: 2026,
  median_income: 110100,
  source: "HUD User, Income Limits",
  bands: [
    { band: 80, hud_name: "low income", limits: [82550, 94350, 106150, 117900, 127350, 136800, 146250, 155650] },
    { band: 30, hud_name: "extremely low income", limits: [30950, 35350, 39800, 44200, 47750, 51300, 54850, 58350] },
    { band: 50, hud_name: "very low income", limits: [51550, 58900, 66300, 73700, 79600, 85500, 91400, 97300] },
  ],
};

describe("positionOf", () => {
  it("reads each household size's own line", () => {
    const low = HUDSON.bands[0];
    expect(lineFor(low, 1)).toBe(82550);
    expect(lineFor(low, 8)).toBe(155650);
  });

  it("puts an income exactly on a line within it, since HUD's lines are ceilings", () => {
    expect(positionOf(HUDSON, 3, 66300).within?.band).toBe(50);
    expect(positionOf(HUDSON, 3, 66301).within?.band).toBe(80);
  });

  it("orders the lines lowest first, whatever order they arrive in", () => {
    expect(positionOf(HUDSON, 3, 0).lines.map((l) => l.band.band)).toEqual([30, 50, 80]);
  });

  it("has nothing below the lowest line and nothing within above the highest", () => {
    const below = positionOf(HUDSON, 3, 20000);
    expect([below.within?.band, below.above]).toEqual([30, null]);
    const over = positionOf(HUDSON, 3, 200000);
    expect([over.within, over.above?.band]).toEqual([null, 80]);
  });
});

describe("positionSentence", () => {
  it("names the line plainly, then as HUD does, with the line's own dollar figure", () => {
    expect(positionSentence(HUDSON, 3, 68000)).toBe(
      "$68,000 for a household of 3 is at or below Hudson County’s 80% line ($106,150) — " +
        "80% of the area’s median income, what HUD calls “low income” — and above its 50% " +
        "line ($66,300).",
    );
  });

  it("says when an income is below the lowest line, and above all three", () => {
    expect(positionSentence(HUDSON, 1, 25000)).toContain("the lowest of its three lines");
    expect(positionSentence(HUDSON, 1, 25000)).toContain("“extremely low income”");
    expect(positionSentence(HUDSON, 8, 300000)).toContain("above all three of HUD’s lines");
  });

  it("never says a household qualifies", () => {
    for (const income of [10000, 50000, 90000, 300000]) {
      expect(positionSentence(HUDSON, 4, income)).not.toMatch(/qualif|eligib/i);
    }
  });
});

describe("the remembered household", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  afterEach(() => store.clear());

  it("keeps a whole household size from 1 to 8 and amounts that are numbers", () => {
    (globalThis as { window?: unknown }).window = { localStorage: storage };
    store.set("hip.household.v1", JSON.stringify({ size: 9, income: "lots", rent: 2100 }));
    expect(readHousehold()).toEqual({ rent: 2100 });
    writeHousehold({ size: 3, income: 68000 });
    expect(readHousehold()).toEqual({ size: 3, income: 68000 });
    writeHousehold({});
    expect(store.has("hip.household.v1")).toBe(false);
  });

  it("reads nothing, and throws nothing, when storage refuses", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(readHousehold()).toEqual({});
  });
  it("remembers available cash, including zero, but not invalid amounts", () => {
    (globalThis as { window?: unknown }).window = { localStorage: storage };
    writeHousehold({ income: 100000, cash: 0 });
    expect(readHousehold()).toEqual({ income: 100000, cash: 0 });
    store.set("hip.household.v1", JSON.stringify({ cash: -1, income: 100000 }));
    expect(readHousehold()).toEqual({ income: 100000 });
  });
});
