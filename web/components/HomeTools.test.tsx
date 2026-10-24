// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HOME_TOOLS, HomeTools } from "./HomeTools";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps all six tools directly linked with real text and paired theme previews", () => {
  render(<HomeTools />);
  const tools = screen.getByRole("region", { name: "Tools" });
  const links = within(tools).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/afford", "/guide", "/tax", "/compare", "/help", "/atlas"]);
  for (const [i, link] of links.entries()) {
    expect(link.textContent).toContain(HOME_TOOLS[i].title);
    expect(link.textContent).toContain("New Jersey");
    expect(link.querySelectorAll("img")).toHaveLength(2);
    expect(link.querySelector(".shot-light")?.getAttribute("src")).toContain(`/screenshots/tools/${HOME_TOOLS[i].shot}-light.jpg`);
    expect(link.querySelector(".shot-dark")?.getAttribute("src")).toContain(`/screenshots/tools/${HOME_TOOLS[i].shot}-dark.jpg`);
    expect(link.querySelector(".home-tool-preview")?.getAttribute("aria-hidden")).toBe("true");
  }
  expect(within(tools).getByText(/Example views/)).toBeTruthy();
});

it("supports rail keyboard navigation and reduced-motion arrow scrolling", () => {
  render(<HomeTools />);
  const list = screen.getByRole("list", { name: "Housing tools" });
  const links = within(list).getAllByRole("link");
  links[0].focus();
  fireEvent.keyDown(links[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(links[1]);
  fireEvent.keyDown(links[1], { key: "End" });
  expect(document.activeElement).toBe(links.at(-1));
  fireEvent.keyDown(links.at(-1)!, { key: "Home" });
  expect(document.activeElement).toBe(links[0]);
  Object.defineProperties(list, { clientWidth: { value: 400 }, scrollWidth: { value: 1600 } });
  const scrollBy = vi.fn();
  list.scrollBy = scrollBy;
  fireEvent.scroll(list);
  expect(screen.getByRole("button", { name: "Previous tools" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next tools" }));
  expect(scrollBy).toHaveBeenCalledWith({ left: 340, behavior: "instant" });
  list.scrollLeft = 1200;
  fireEvent.scroll(list);
  expect(screen.getByRole("button", { name: "Next tools" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous tools" }));
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -340, behavior: "instant" });
});
