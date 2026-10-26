// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("keeps all four URL selections while showing a chosen pair on phones", async () => {
    window.history.replaceState(null, "", "/compare?places=1,2,3,4");
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/search.json" ? new Response("[]") : new Response(JSON.stringify(packet(Number(url.match(/regions\/(\d+)/)?.[1]), `Town ${url.match(/regions\/(\d+)/)?.[1]}`)))));
    render(<ComparePlaces artifactUrl="https://data.test" rate={{ value: 6.5, asOf: "Oct 2026" }} />);
    await screen.findByRole("link", { name: "Town 2" });
    expect(screen.queryByRole("link", { name: "Town 3" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Compare the starting place with"), { target: { value: "4" } });
    expect(screen.getByRole("link", { name: "Town 4" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Town 1" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Town 2" })).toBeNull();
    expect(window.location.search).toBe("?places=1,2,3,4");
  });
  it("starts with an overview and reveals supporting measures by topic", async () => {
    window.history.replaceState(null, "", "/compare?places=1,2");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/search.json" ? new Response("[]") : new Response(JSON.stringify(packet(Number(url.match(/regions\/(\d+)/)?.[1]), url.includes("/1/") ? "Alpha" : "Beta")))));
    render(<ComparePlaces artifactUrl="https://data.test" rate={{ value: 6.5, asOf: "Oct 2026" }} />);
    await screen.findByRole("link", { name: "Beta" });
    expect(screen.queryByText("Median sale price")).toBeNull();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "How homes sell" } });
    expect(screen.getByText("Median sale price")).toBeTruthy();
    expect(screen.queryByText("Typical home value")).toBeNull();
    expect(window.location.search).toBe("?places=1,2");
  });
  it("withholds differences for mismatched observation periods", async () => {
    window.history.replaceState(null, "", "/compare?places=1,2");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/search.json") return new Response("[]");
      const id = Number(url.match(/regions\/(\d+)/)?.[1]);
      const data = packet(id, id === 1 ? "Alpha" : "Beta");
      if (id === 2) data.levels[0].period_end = "2026-08-31";
      return new Response(JSON.stringify(data));
    }));
    render(<ComparePlaces artifactUrl="https://data.test" rate={{ value: 6.5, asOf: "Oct 2026" }} />);
    expect(await screen.findByText("Different periods or units · no difference calculated")).toBeTruthy();
  });
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
