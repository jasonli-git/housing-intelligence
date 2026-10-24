// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HomeStories } from "./HomeStories";
import { STORIES } from "@/lib/stories";

afterEach(cleanup);

it("provides one collection gateway with the real story count and decorative chart fragments", () => {
  render(<HomeStories />);
  const section = screen.getByRole("region", { name: "Visual stories" });
  const links = within(section).getAllByRole("link");
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute("href")).toBe("/stories");
  expect(within(section).getByText(`${STORIES.length} stories`)).toBeTruthy();
  expect(links[0].textContent).toContain("New Jersey");
  expect(within(section).queryByText(/Explore collection/)).toBeNull();
  expect(section.querySelectorAll(".gallery-fragment")).toHaveLength(3);
  expect(section.querySelector(".home-stories-gallery")?.getAttribute("aria-hidden")).toBe("true");
  expect(section.querySelectorAll("img")).toHaveLength(6);
  expect(section.querySelector('img[src*="stories-index"]')).toBeNull();
  expect(within(section).queryByRole("button")).toBeNull();
  expect(within(section).queryByRole("list")).toBeNull();
});
