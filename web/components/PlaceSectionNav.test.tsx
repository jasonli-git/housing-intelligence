// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlaceSectionNav } from "./PlaceSectionNav";

const sections = [{ id: "overview", label: "Overview" }, { id: "sources", label: "Sources" }, { id: "missing", label: "Missing" }];
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); history.replaceState(null, "", location.pathname); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("discovers the shared footer outside main and excludes absent destinations", () => {
  render(<><main><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1></main><footer><details><summary>Evidence</summary><h2 id="sources">Source records</h2></details></footer></>);
  expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual(["Overview", "Sources"]);
});

it("opens source disclosures, transfers focus and respects reduced motion", () => {
  render(<><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1><footer><details><summary>Evidence</summary><h2 id="sources">Source records</h2></details></footer></>);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "sources" } });
  expect(document.querySelector("details")?.open).toBe(true);
  expect(document.activeElement?.id).toBe("sources");
  expect(location.hash).toBe("#sources");
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
});

it("adds a streamed destination and supports anchor navigation", async () => {
  const view = render(<><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1></>);
  view.rerender(<><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1><h2 id="sources">Records</h2></>);
  await waitFor(() => expect(screen.getByRole("link", { name: "Sources" })).toBeTruthy());
  fireEvent.click(screen.getByRole("link", { name: "Sources" }));
  expect(document.activeElement?.id).toBe("sources");
  expect(location.hash).toBe("#sources");
});
