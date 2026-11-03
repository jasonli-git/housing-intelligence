// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StoryShare } from "./StoryShare";

afterEach(cleanup);

it("stays hidden until its image loads, then offers to save it and copy the link", () => {
  const { container } = render(<StoryShare slug="the-wawa-line" title="The Wawa line" />);
  const section = container.querySelector("section")!;
  const img = container.querySelector("img")!;
  expect(img.getAttribute("src")).toMatch(/\/screenshots\/share\/the-wawa-line-4x5\.jpg$/);
  expect(section.hidden).toBe(true);
  fireEvent.load(img);
  expect(section.hidden).toBe(false);
  expect(screen.getByRole("button", { name: "Save image" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
});

it("offers nothing when the story has no image yet", () => {
  const { container } = render(<StoryShare slug="no-such-story" title="Nothing" />);
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("section")).toBeNull();
});
