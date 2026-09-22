import { describe, expect, it } from "vitest";

import { housingModeAt } from "@/lib/housingMode";

describe("housing mode URLs", () => {
  it("reads local affordability mode from the query string", () => {
    expect(housingModeAt("/", "?mode=afford")).toBe("afford");
    expect(housingModeAt("/regions/12", "?mode=afford&perf=1")).toBe("afford");
  });

  it("treats the durable affordability route as affordability mode", () => {
    expect(housingModeAt("/afford", "")).toBe("afford");
  });

  it("leaves ordinary pages in their standard mode", () => {
    expect(housingModeAt("/regions/415", "?perf=1")).toBe("state");
  });
});
