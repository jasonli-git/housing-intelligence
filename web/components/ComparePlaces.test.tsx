// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComparePlaces } from "./ComparePlaces";

const packet = (id: number, label: string, state = "NJ") => ({
  region: { region_id: id, label, name: label, level: "municipality", state_code: state, geoid: "x", parent: null },
  levels: [
    { metric_id: "zhvi_sfr", label: "Home value", unit: "usd", value: 400000, period_start: "2026-09-01", period_end: "2026-09-30", survey: false },
    { metric_id: "acs_median_hh_income", label: "Income", unit: "usd", value: 90000, period_start: "2020-01-01", period_end: "2024-12-31", survey: true, margin_of_error: 5000 },
  ],
  metrics: [],
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

describe("compare places", () => {
  it("reads the places from the address and their published packets, storing nothing", async () => {
    window.history.replaceState(null, "", "/compare?places=1,2");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/search.json") return new Response("[]");
      const id = Number(url.match(/regions\/(\d+)/)?.[1]);
      return new Response(JSON.stringify(packet(id, id === 1 ? "Alpha, NJ" : "Beta, NJ")));
    }));
    render(<ComparePlaces artifactUrl="https://data.test" rate={{ value: 6.5, asOf: "Oct 2026" }} />);
    await waitFor(() => expect(screen.getByRole("link", { name: "Beta, NJ" })).toBeTruthy());
    expect(screen.getByRole("link", { name: "Alpha, NJ" })).toBeTruthy();
    expect(screen.getAllByText("$400,000")).toHaveLength(2);
    expect(screen.getAllByText("Not published").length).toBeGreaterThan(0);
    expect(localStorage.length).toBe(0);
  });
  it("says a place could not be loaded rather than leaving it blank", async () => {
    window.history.replaceState(null, "", "/compare?places=9");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/search.json" ? new Response("[]") : new Response("", { status: 404 })));
    render(<ComparePlaces artifactUrl="https://data.test" rate={{ value: 6.5, asOf: "Oct 2026" }} />);
    await waitFor(() => expect(screen.getAllByText("Could not load").length).toBeGreaterThan(0));
  });
});
