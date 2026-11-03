// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoryLibrary } from "./StoryLibrary";
import { LIBRARY_STORIES } from "@/lib/storyLibrary";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", () => 0);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the feature and four labelled rails with real story links", () => {
  render(<StoryLibrary />);
  expect(screen.queryByText("Chart detail")).toBeNull();
  expect(screen.getByRole("link", { name: /Where South Jersey/ }).getAttribute("href")).toBe("/stories/the-wawa-line");
  expect(screen.getAllByRole("region")).toHaveLength(4);
  const rail = screen.getByRole("region", { name: "Only in New Jersey" });
  expect(within(rail).getAllByRole("link")).toHaveLength(8);
  expect(screen.getByRole("button", { name: "Previous stories in Only in New Jersey" }).hasAttribute("disabled")).toBe(true);
  expect(rail.querySelector(".library-rail-head .library-arrow")).toBeNull();
  expect(rail.querySelectorAll(".library-rail-stage > .library-arrow")).toHaveLength(2);
  expect(rail.querySelector(".library-rail-stage > .library-track")).toBeTruthy();
});
it("provides every story in a searchable normal grid", () => {
  render(<StoryLibrary />);
  fireEvent.click(screen.getByRole("button", { name: /^See all \d+ stories/ }));
  expect(screen.getAllByRole("link")).toHaveLength(LIBRARY_STORIES.length);
  fireEvent.click(screen.getByRole("button", { name: "← Discover" }));
  expect(screen.getAllByRole("region")).toHaveLength(4);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search stories" }), { target: { value: "Wawa" } });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toContain("1 story");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "not-a-story" } });
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Show all stories" }));
  expect(screen.getAllByRole("link")).toHaveLength(LIBRARY_STORIES.length);
});
it("view all opens the chosen collection without losing other stories", () => {
  render(<StoryLibrary />);
  fireEvent.click(within(screen.getByRole("region", { name: "Only in New Jersey" })).getByRole("button", { name: /View all/ }));
  expect((screen.getByRole("combobox", { name: "Collection" }) as HTMLSelectElement).value).toBe("jersey");
  expect(screen.getAllByRole("link")).toHaveLength(8);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
  expect(screen.getAllByRole("link")).toHaveLength(LIBRARY_STORIES.length);
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

it("searching from the discover page swaps the rails for matches", () => {
  render(<StoryLibrary />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search stories" }), { target: { value: "Wawa" } });
  expect(screen.queryByRole("region", { name: "Only in New Jersey" })).toBeNull();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getByRole("region", { name: "Only in New Jersey" })).toBeTruthy();
});
