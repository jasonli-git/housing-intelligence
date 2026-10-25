// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HOME_TOOLS, HomeTools } from "./HomeTools";

afterEach(cleanup);

it("keeps all six tools directly linked with real text and paired theme previews", () => {
  render(<HomeTools />);
  const tools = screen.getByRole("region", { name: "Tools" });
  const links = within(tools).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/afford", "/guide", "/tax", "/compare", "/help", "/atlas"]);
  for (const [i, link] of links.entries()) {
    // The name is a tag on the screenshot, hidden from screen readers there, and read
    // once from the link's hidden text.
    expect(link.textContent).toContain(HOME_TOOLS[i].title);
    expect(link.querySelector(".home-tool-tag")?.getAttribute("aria-hidden")).toBe("true");
    expect(link.querySelector(".home-tool-name")?.getAttribute("aria-hidden")).toBe("true");
    expect(link.querySelector(".visually-hidden")?.textContent).toBe(HOME_TOOLS[i].title);
    expect(link.getAttribute("aria-describedby")).toBe("home-tools-coverage");
    expect(link.textContent).not.toContain("New Jersey");
    expect(link.textContent).toContain(HOME_TOOLS[i].text);
    expect(link.querySelectorAll("img")).toHaveLength(2);
    expect(link.querySelector(".shot-light")?.getAttribute("src")).toContain(`/screenshots/tools/${HOME_TOOLS[i].shot}-light.jpg`);
    expect(link.querySelector(".shot-dark")?.getAttribute("src")).toContain(`/screenshots/tools/${HOME_TOOLS[i].shot}-dark.jpg`);
    expect(link.querySelector(".home-tool-preview")?.getAttribute("aria-hidden")).toBe("true");
  }
  expect(within(tools).queryByText(/Example views/)).toBeNull();
  expect(within(tools).getAllByText("New Jersey coverage")).toHaveLength(1);
  expect(tools.querySelectorAll(".home-tool-scope")).toHaveLength(0);
  expect(HOME_TOOLS.every((tool) => tool.text.split(/\s+/).length <= 6)).toBe(true);
});
