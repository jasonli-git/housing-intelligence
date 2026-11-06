// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HomeStories } from "./HomeStories";
import { LIBRARY_STORIES } from "@/lib/storyLibrary";
import { BLUESKY_URL, X_URL } from "@/lib/site";

afterEach(cleanup);

it("provides one collection gateway with the real story count and decorative chart fragments", () => {
  render(<HomeStories />);
  const section = screen.getByRole("region", { name: "Visual stories" });
  // One gateway into the collection, then the follow line's two plain links beneath it.
  const links = within(section).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/stories", X_URL, BLUESKY_URL]);
  expect(within(section).getByRole("link", { name: "X" })).toBeTruthy();
  expect(within(section).getByRole("link", { name: "Bluesky" })).toBeTruthy();
  expect(within(section).getByText(`${LIBRARY_STORIES.length} stories`)).toBeTruthy();
  expect(links[0].textContent).toContain("New Jersey");
  expect(within(section).queryByText(/Explore collection/)).toBeNull();
  expect(section.querySelectorAll(".gallery-fragment")).toHaveLength(3);
  expect(section.querySelector(".home-stories-gallery")?.getAttribute("aria-hidden")).toBe("true");
  expect(section.querySelectorAll("img")).toHaveLength(6);
  expect(section.querySelector('img[src*="stories-index"]')).toBeNull();
  expect(within(section).queryByRole("button")).toBeNull();
  expect(within(section).queryByRole("list")).toBeNull();
});
