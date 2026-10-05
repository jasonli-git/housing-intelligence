// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeChecks } from "./HomeChecks";

afterEach(cleanup);
describe("moving checks presentation", () => {
  it("links to the general tax lookup without a model tagline", () => {
    render(<HomeChecks levels={[]} />);
    expect(screen.getByRole("link", { name: /Look up the property's tax bill/ }).getAttribute("href")).toBe("/tax");
    expect(screen.queryByText(/Fixed rules, not AI/)).toBeNull();
  });
  it("preserves the municipality in the tax lookup link", () => {
    render(<HomeChecks levels={[]} taxHref="/tax?town=3402151000" />);
    expect(screen.getByRole("link", { name: /Look up the property's tax bill/ }).getAttribute("href")).toBe("/tax?town=3402151000");
  });
});
