// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { StoryScroller } from "./StoryScroller";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

it("wraps a row of stories in previous and next buttons that control it", () => {
  render(<StoryScroller label="visual stories about Princeton"><li><a href="/stories/a">A</a></li><li><a href="/stories/b">B</a></li></StoryScroller>);
  const list = screen.getByRole("list", { name: "visual stories about Princeton" });
  const previous = screen.getByRole("button", { name: "Previous visual stories about Princeton" });
  const next = screen.getByRole("button", { name: "Next visual stories about Princeton" });
  expect(previous.getAttribute("aria-controls")).toBe(list.id);
  expect(next.getAttribute("aria-controls")).toBe(list.id);
  // At the start there is nowhere to go back to.
  expect((previous as HTMLButtonElement).disabled).toBe(true);
  expect(list.getAttribute("tabindex")).toBe("0");
});
