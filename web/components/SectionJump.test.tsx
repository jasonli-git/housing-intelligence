// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { pageDestinations, SectionJump } from "./SectionJump";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("lists destinations in reading order, including closed disclosures but excluding hidden modes", () => {
  render(<main><SectionJump /><section id="quiet-highlights" />
    <details><summary>Evidence</summary><section id="region-detailed-data" /></details>
    <div style={{ display: "none" }}><section id="housing-assistance" /></div>
    <section id="quiet-cost" /></main>);
  expect(pageDestinations().map(s => s.label)).toEqual(["Highlights & rankings", "Explore the evidence", "Costs to own & rent"]);
});

it("finds legal headings and dynamically arriving budget results", async () => {
  const view = render(<main className="legal-page"><SectionJump /><section><h2 id="policy-first">Your privacy</h2></section></main>);
  expect(screen.getByRole("option", { name: "Your privacy" })).toBeTruthy();
  view.rerender(<main className="legal-page"><SectionJump /><section><h2 id="policy-first">Your privacy</h2></section><section className="budget-town-results" /></main>);
  await waitFor(() => expect(screen.getByRole("option", { name: "Towns within reach" })).toBeTruthy());
});

it("opens all disclosure ancestors, focuses the destination, and respects reduced motion", () => {
  render(<main><SectionJump /><details><summary>Tools</summary><details className="budget-place-check"><summary>Check one place</summary></details></details></main>);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: ".budget-place-check" } });
  expect([...document.querySelectorAll("details")].every(d => d.open)).toBe(true);
  expect(document.activeElement).toBe(document.querySelector(".budget-place-check > summary"));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
});

it("ignores an empty selection without issuing an invalid query", () => {
  render(<main><SectionJump /><section id="quiet-cost" /></main>);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it("discovers cadence groups without offering footer destinations", () => {
  render(<><main><SectionJump /><section id="weekly" data-jump-label="Weekly" /></main>
    <footer><section id="footer" data-jump-label="Footer" /></footer></>);
  expect(pageDestinations().map(s => s.label)).toEqual(["Weekly"]);
});
