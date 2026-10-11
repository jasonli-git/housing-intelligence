// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HousingMosaic } from "./HousingMosaic";
import type { MosaicView } from "@/lib/housingMosaic";

afterEach(cleanup);
it("uses a subordinate heading without a separate card when embedded", () => {
  render(<HousingMosaic embedded statewide name="New Jersey" views={views} />);
  expect(screen.getByRole("heading", { name: "Explore the mix", level: 3 })).toBeTruthy();
  expect(document.querySelector(".mosaic-embedded")).toBeTruthy();
  expect(document.querySelectorAll(".mosaic-source, .mosaic-caption")).toHaveLength(1);
  expect(document.querySelector(".mosaic-source")?.textContent).toContain("2020–2024");
  expect(document.querySelector(".mosaic-selected")?.textContent).toContain("90% margin");
  expect(screen.queryByText("A state in little pieces")).toBeNull();
});
const views: MosaicView[] = [
  { id: "tenure", label: "Owned / rented", denominator: "Occupied homes", source: "census_acs", period: "2020–2024",
    groups: [{ label: "Owner-occupied", share: .743, margin: "± 1.0 points", note: "Owners." },
      { label: "Renter-occupied", share: .257, margin: "± 1.0 points", note: "Renters." }] },
  { id: "occupancy", label: "Occupied / empty", denominator: "All homes", source: "census_acs", period: "2020–2024",
    groups: [{ label: "Empty", share: .02, margin: "no margin available", note: "Includes seasonal homes." },
      { label: "Occupied", share: .98, margin: "no margin available", note: "Residents." }] },
];
it("renders 100 decorative tiles and exact shares, not rounded tile numbers", () => {
  render(<HousingMosaic name="Somerset County" views={views} />);
  expect(document.querySelectorAll(".mosaic-tile")).toHaveLength(100);
  expect(document.querySelectorAll('.mosaic-tile[data-group="0"]')).toHaveLength(74);
  expect(document.querySelector(".mosaic-selected")?.textContent).toContain("74.3%");
  expect(screen.getByText(/not individual homes or a map/)).toBeTruthy();
});
it("switches views and lets accessible group buttons reveal the estimate", () => {
  render(<HousingMosaic name="Somerset County" views={views} />);
  fireEvent.click(screen.getByRole("button", { name: "Renter-occupied 25.7%" }));
  expect(document.querySelector(".mosaic-selected")?.textContent).toContain("25.7%");
  fireEvent.click(screen.getByRole("button", { name: "Occupied / empty" }));
  expect(screen.getByText("All homes · Somerset County")).toBeTruthy();
  expect(document.querySelector(".mosaic-selected")?.textContent).toContain("Includes seasonal homes.");
  expect(document.querySelector(".mosaic-selected")?.textContent).not.toContain("90% margin");
  expect(document.querySelectorAll('.mosaic-tile[data-group="0"]')).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Occupied / empty" }).getAttribute("aria-pressed")).toBe("true");
});
it("has no empty shell when figures are unavailable", () => {
  const { container } = render(<HousingMosaic name="No data" views={[]} />);
  expect(container.innerHTML).toBe("");
});
it("labels state records by their actual source instead of Census survey uncertainty", () => {
  const stateViews = [{ ...views[0], evidence: "NJ DCA records · 2025. Reporting towns only.",
    groups: views[0].groups.map(g => ({ ...g, margin: null })) }];
  render(<HousingMosaic statewide name="New Jersey" views={stateViews} />);
  expect(screen.getByRole("heading", { name: "Housing in motion" })).toBeTruthy();
  expect(document.querySelector(".mosaic-selected")?.textContent).not.toContain("90% margin");
  expect(document.querySelector(".mosaic-source")?.textContent).toContain("NJ DCA records");
  expect(document.querySelector(".mosaic-source")?.textContent).not.toContain("Census ACS");
});
it("explains why a small but real category has no tile", () => {
  const tiny = [{ ...views[0], groups: [
    { label: "Conventional", share: .996, margin: null, note: "Reported loans." },
    { label: "Other", share: .004, margin: null, note: "Other loans." },
  ] }];
  render(<HousingMosaic statewide name="New Jersey" views={tiny} />);
  fireEvent.click(screen.getByRole("button", { name: "Other 0.4%" }));
  expect(document.querySelectorAll('.mosaic-tile[data-group="1"]')).toHaveLength(0);
  expect(screen.getByText("Smaller than one tile at this scale.")).toBeTruthy();
});
