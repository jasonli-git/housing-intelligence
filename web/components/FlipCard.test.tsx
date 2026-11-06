// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FlipCard } from "./FlipCard";

afterEach(cleanup);

it("turns with a button, and the face turned away cannot be reached", () => {
  const { container } = render(<FlipCard front={<p>The takeaway</p>} back={<p>The figures</p>} />);
  const [front, back] = container.querySelectorAll("article > div");
  expect(back.hasAttribute("inert")).toBe(true);
  expect(front.hasAttribute("inert")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /See the figures/ }));
  expect(container.querySelector("article")!.hasAttribute("data-flipped")).toBe(true);
  expect(front.hasAttribute("inert")).toBe(true);
  expect(back.hasAttribute("inert")).toBe(false);
});
