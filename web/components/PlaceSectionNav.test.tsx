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
  expect(screen.getAllByRole("link").map(o => o.textContent)).toEqual(["Overview", "Sources"]);
});

it("opens source disclosures, transfers focus and respects reduced motion", () => {
  render(<><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1><footer><details><summary>Evidence</summary><h2 id="sources">Source records</h2></details></footer></>);
  fireEvent.click(screen.getByRole("link", { name: "Sources" }));
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

it("opens a collapsed destination itself and focuses its summary", () => {
  render(<><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1><details id="sources"><summary>Living there</summary><p>Evidence</p></details></>);
  fireEvent.click(screen.getByRole('link', { name: 'Sources' }));
  expect(document.querySelector('details')?.open).toBe(true);
  expect(document.activeElement).toBe(document.querySelector('details > summary'));
});

it("leaves the skip link's focus on main rather than moving it to the first heading", () => {
  render(<><PlaceSectionNav sections={sections} /><main id="main-content" tabIndex={-1}><h1 id="overview">Place</h1></main></>);
  const main = document.getElementById('main-content')!;
  main.focus();
  history.replaceState(null, '', '#main-content');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(document.activeElement).toBe(main);
});

it("reveals an initial deep link inside nested closed evidence without adding history", () => {
  history.replaceState(null, '', '#source-record');
  const push = vi.spyOn(history, 'pushState');
  render(<><PlaceSectionNav sections={sections} /><h1 id="overview">Place</h1><details><summary>Living there</summary><details><summary>Sources</summary><h2 id="source-record">Record</h2></details></details></>);
  expect([...document.querySelectorAll('details')].every(d => d.open)).toBe(true);
  expect(document.activeElement?.id).toBe('source-record');
  expect(push).not.toHaveBeenCalled();
});
