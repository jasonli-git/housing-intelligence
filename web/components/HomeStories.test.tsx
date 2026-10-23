// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HomeStories } from "./HomeStories";
import { STORIES } from "@/lib/stories";

afterEach(cleanup);

it("shows three curated direct story links and a separate complete-library link", () => {
  render(<HomeStories />);
  const section = screen.getByRole("region", { name: "Visual stories" });
  expect(within(section).getByText("New Jersey")).toBeTruthy();
  expect(within(section).getByRole("link", { name: `Browse all ${STORIES.length}` }).getAttribute("href")).toBe("/stories");
  const picks = within(screen.getByRole("list", { name: "Selected visual stories" })).getAllByRole("link");
  expect(picks.map((link) => link.getAttribute("href"))).toEqual([
    "/stories/the-wawa-line", "/stories/twin-towns", "/stories/the-flood-claims-calendar",
  ]);
  expect(section.querySelectorAll(".library-cover")).toHaveLength(3);
  expect(section.querySelector('img[src*="stories-index"]')).toBeNull();
  expect(within(section).queryByRole("button")).toBeNull();
});
