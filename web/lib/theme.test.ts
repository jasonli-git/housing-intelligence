import { describe, expect, it } from "vitest";

import { THEME_KEY, THEME_SCRIPT, applyTheme, parseTheme } from "@/lib/theme";

function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
}

/** Run the pre-paint script against a stand-in document and storage. */
function runScript(stored: string | null, { throws = false } = {}) {
  const root = fakeRoot();
  const storage = {
    getItem: (key: string) => {
      if (throws) throw new Error("storage blocked");
      return key === THEME_KEY ? stored : null;
    },
  };
  new Function("localStorage", "document", THEME_SCRIPT)(storage, { documentElement: root });
  return root.attributes.get("data-theme");
}

describe("parseTheme", () => {
  it("keeps a real choice", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("reads anything else, or nothing, as following the system", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("purple")).toBe("system");
  });
});

describe("applyTheme", () => {
  it("sets the attribute for a choice and clears it for the system", () => {
    const root = fakeRoot();

    applyTheme(root, "dark");
    expect(root.attributes.get("data-theme")).toBe("dark");

    applyTheme(root, "system");
    expect(root.attributes.has("data-theme")).toBe(false);
  });
});

describe("the pre-paint script", () => {
  it("applies a stored choice before React is on the page", () => {
    expect(runScript("dark")).toBe("dark");
    expect(runScript("light")).toBe("light");
  });

  it("leaves the page to the system for anything else", () => {
    expect(runScript(null)).toBeUndefined();
    expect(runScript("purple")).toBeUndefined();
  });

  it("lets the page render when storage cannot be read", () => {
    expect(() => runScript("dark", { throws: true })).not.toThrow();
  });
});
