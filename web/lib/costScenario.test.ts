import { afterEach, describe, expect, it, vi } from "vitest";

import { parseAmount, readPersonal, writePersonal } from "@/lib/costScenario";

/** A stand-in for `window.localStorage`, so the tests run without a browser. */
function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("a typed amount", () => {
  it("reads dollars, commas and percent signs as a number", () => {
    expect(parseAmount("$500,000")).toBe(500_000);
    expect(parseAmount("6.25%")).toBe(6.25);
  });
  it("is null when empty, negative or not a number", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("the reader's own inputs", () => {
  it("keep only known keys holding finite numbers", () => {
    fakeStorage({
      "hip.cost.personal.v1": JSON.stringify({ downPct: 10, price: 900_000, ratePct: "6", years: null }),
    });
    // A price is never carried between pages, so a stored one is ignored.
    expect(readPersonal()).toEqual({ downPct: 10 });
  });
  it("are empty when storage is unreadable or refuses to answer", () => {
    fakeStorage({ "hip.cost.personal.v1": "{not json" });
    expect(readPersonal()).toEqual({});
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(readPersonal()).toEqual({});
  });
  it("are removed from storage when the reader clears them all", () => {
    const store = fakeStorage();
    writePersonal({ ratePct: 6.5 });
    expect(store.get("hip.cost.personal.v1")).toBe('{"ratePct":6.5}');
    writePersonal({});
    expect(store.has("hip.cost.personal.v1")).toBe(false);
  });
});
