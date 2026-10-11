// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ReaderDetails } from "./ReaderDetails";

afterEach(cleanup);
it("preserves a native, initially closed disclosure with a decorative chevron", () => {
  const { container } = render(createElement(ReaderDetails, { title: "How this works", className: "income-limit-explainer", children: createElement("p", null, "Supporting explanation") }));
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false);
  expect(details.classList.contains("income-limit-explainer")).toBe(true);
  expect(screen.getByText("How this works").closest("summary")).not.toBeNull();
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(container.querySelector(".reader-details-body")?.textContent).toBe("Supporting explanation");
});
