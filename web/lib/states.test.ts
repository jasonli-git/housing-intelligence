import { describe, expect, it } from "vitest";

import { STATE_DESTINATIONS } from "./coverageMap";
import { regionPath } from "./placeRoutes";
import { COVERED_STATES, coveredNames, coveredState, stateCrumbs } from "./states";

describe("covered states", () => {
  it("are one list every page reads", () => {
    for (const state of COVERED_STATES) {
      expect(STATE_DESTINATIONS[state.code]).toBe(state.path);
      expect(regionPath(state.regionId)).toBe(state.path);
    }
    expect(coveredNames()).toBe(COVERED_STATES.map((s) => s.name).join(" and "));
  });
  it("give a state crumb only for a covered state", () => {
    expect(stateCrumbs("nj")).toEqual([{ href: "/states/new-jersey", label: "New Jersey" }]);
    expect(stateCrumbs("PA")).toEqual([]);
    expect(coveredState("PA")).toBeNull();
  });
});
