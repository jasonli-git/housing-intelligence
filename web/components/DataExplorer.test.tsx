// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DataExplorer } from "./DataExplorer";
import type { Catalog } from "@/lib/dataCatalog";

afterEach(() => { cleanup(); history.replaceState(null, "", location.pathname); });

const catalog: Catalog = {
  sources: [{ id: "fred", name: "FRED", publisher: "St. Louis Fed", cadence: "weekly", homepage: "" }],
  models: [{ name: "stg_fred", description: "", rows: 10, columns: [{ name: "value", type: "double" }], tests: 2, upstream: [], sources: ["fred"], metrics: ["median_rent"] }],
  tables: [{ name: "regions", rows: 5, bytes: 2048, columns: [{ name: "region_id", type: "integer", null_share: 0, distinct: 5 }], foreign_keys: [] }],
  metrics: [{ id: "median_rent", label: "Median rent", unit: "usd", frequency: "annual", kind: "survey", description: "Maintainer's wording", source: "fred", inputs: [], observations: 3, places: 2, first: "2020-01-01", last: "2024-01-01" }],
};

it("searches the catalog and traces a figure into lineage", () => {
  render(<DataExplorer catalog={catalog} />);
  expect(screen.getByRole("status").textContent).toBe("1 matching");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing like it" } });
  expect(screen.getByRole("status").textContent).toBe("0 matching");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rent" } });
  fireEvent.click(screen.getByRole("button", { name: /Trace this figure/ }));
  expect(screen.getByRole("tab", { name: "Interactive lineage" }).getAttribute("aria-selected")).toBe("true");
  expect(location.hash).toBe("#lineage");
  expect(screen.getByRole("button", { name: "stg_fred" })).toBeTruthy();
});

it("opens the area named in the address", () => {
  history.replaceState(null, "", "#profiling");
  render(<DataExplorer catalog={catalog} />);
  expect(screen.getByRole("tab", { name: "Data profiling" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText(/tests are declared/)).toBeTruthy();
});
