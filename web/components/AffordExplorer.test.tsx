// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AffordExplorer } from "./AffordExplorer";
import type { Place } from "@/lib/afford";

const county: Place = { id: 5, name: "Atlantic County", level: "county", state: "NJ", detail: null, home: 300000, rent: 1800, tax: 6000, insurance: 1200, utilities: 200 };
const town: Place = { ...county, id: 194, name: "Absecon", level: "municipality", parentId: 5 };
const props = { counties: [county], towns: [town], rate: { value: 6, asOf: "Oct 2026" }, asOf: { home: "Sep 2026", rent: "Sep 2026", tax: "2025" }, workspace: true };
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

it("restores rent and county scope while keeping the monthly calculation", async () => {
  window.history.replaceState(null, "", "/afford?mode=rent&county=5&income=120000");
  const { container } = render(<AffordExplorer {...props} />);
  await waitFor(() => expect(screen.getByRole("radio", { name: "Rent" }).getAttribute("aria-checked")).toBe("true"));
  expect((screen.getByLabelText("Search in") as HTMLSelectElement).value).toBe("5");
  expect(container.querySelector(".budget-headline")?.textContent).toContain("$3,000");
  expect(screen.getAllByRole("link", { name: "Absecon" }).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole("textbox", { name: /Household income a year, before tax/ }), { target: { value: "80000" } });
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("income")).toBe("80000"));
});

it("preserves the chosen mode without introducing income into a new URL", async () => {
  window.history.replaceState(null, "", "/afford");
  render(<AffordExplorer {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Household income a year, before tax/ }), { target: { value: "100000" } });
  fireEvent.click(screen.getByRole("radio", { name: "Rent" }));
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("mode")).toBe("rent"));
  expect(new URLSearchParams(window.location.search).has("income")).toBe(false);
  expect(screen.queryByText("Advanced assumptions")).toBeNull();
});
