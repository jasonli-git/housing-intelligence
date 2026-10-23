// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoryLibrary } from "./StoryLibrary";
import { STORIES } from "@/lib/stories";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", () => 0);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the feature and six labelled rails with real story links", () => {
  render(<StoryLibrary />);
  expect(screen.queryByText("Chart detail")).toBeNull();
  expect(screen.getByRole("link", { name: "Explore The Wawa line" }).getAttribute("href")).toBe("/stories/the-wawa-line");
  expect(screen.getAllByRole("region")).toHaveLength(6);
  const rail = screen.getByRole("region", { name: "Only in New Jersey" });
  expect(within(rail).getAllByRole("link")).toHaveLength(9);
  expect(rail.querySelector('button[aria-label="Previous stories in Only in New Jersey"]')?.hasAttribute("disabled")).toBe(true);
});

it("switches the featured artwork and destination only on explicit selection", () => {
  render(<StoryLibrary />);
  const feature = screen.getByRole("article", { name: "Featured story" });
  const selectors = within(feature).getByRole("group", { name: "Featured stories" });
  expect(within(selectors).getAllByRole("button")).toHaveLength(4);
  expect(within(selectors).getByRole("button", { name: "Feature The Wawa line" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(within(selectors).getByRole("button", { name: "Feature Twin towns, different price tags" }));
  expect(within(feature).getByRole("link", { name: "Explore Twin towns, different price tags" }).getAttribute("href")).toBe("/stories/twin-towns");
  expect(within(selectors).getByRole("button", { name: "Feature The Wawa line" }).getAttribute("aria-pressed")).toBe("false");
  expect(within(feature).getByRole("heading", { name: "Twin towns, different price tags" })).toBeTruthy();
});
it("provides every story in a searchable normal grid", () => {
  render(<StoryLibrary />);
  fireEvent.click(screen.getByRole("button", { name: /All stories/ }));
  expect(screen.getAllByRole("link")).toHaveLength(STORIES.length);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search stories" }), { target: { value: "Wawa" } });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toContain("1 story");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "not-a-story" } });
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Show all stories" }));
  expect(screen.getAllByRole("link")).toHaveLength(STORIES.length);
});
it("view all opens the chosen collection without losing other stories", () => {
  render(<StoryLibrary />);
  fireEvent.click(within(screen.getByRole("region", { name: "Only in New Jersey" })).getByRole("button", { name: /View all/ }));
  expect((screen.getByRole("combobox", { name: "Collection" }) as HTMLSelectElement).value).toBe("jersey");
  expect(screen.getAllByRole("link")).toHaveLength(9);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
  expect(screen.getAllByRole("link")).toHaveLength(STORIES.length);
});

it("moves focus between story links with the keyboard", () => {
  render(<StoryLibrary />);
  const rail = screen.getByRole("region", { name: "Only in New Jersey" });
  const links = within(rail).getAllByRole("link");
  links[0].focus();
  fireEvent.keyDown(links[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(links[1]);
  fireEvent.keyDown(links[1], { key: "End" });
  expect(document.activeElement).toBe(links.at(-1));
  fireEvent.keyDown(links.at(-1)!, { key: "Home" });
  expect(document.activeElement).toBe(links[0]);
});
