// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AbstractField } from "./AbstractField";
import { QuietDisclosure, QuietToolGroup } from "./QuietCounty";

afterEach(cleanup);
describe("abstract section artwork", () => {
  it.each(["household", "contours", "evidence"] as const)("keeps %s decorative and out of keyboard navigation", kind => {
    const { container } = render(<AbstractField kind={kind} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(container.querySelectorAll("text, a, button, [tabindex]").length).toBe(0);
  });
  it("preserves the native disclosure and content", () => {
    const { container } = render(<QuietDisclosure enabled title="The local market" note="Market detail"><p>Actual figures</p></QuietDisclosure>);
    expect(container.querySelector("details > summary")?.textContent).toContain("The local market");
    expect(screen.getByText("Actual figures")).toBeTruthy();
    expect(container.querySelector(".abstract-field-contours")).not.toBeNull();
  });
  it("does not add experimental wrappers or artwork when disabled", () => {
    const { container } = render(<QuietToolGroup enabled={false}><QuietDisclosure enabled={false} title="The local market"><p>Content</p></QuietDisclosure></QuietToolGroup>);
    expect(container.querySelector("svg, details, .quiet-tool-group")).toBeNull();
    expect(screen.getByText("Content")).toBeTruthy();
  });
});
