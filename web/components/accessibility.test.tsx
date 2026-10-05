// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FloatingMetricTerm } from "./FloatingMetricTerm";
import { Definition } from "./Definition";
import { renderToStaticMarkup } from "react-dom/server";
import { PlacePicker } from "./PlacePicker";
import { SectionJump } from "./SectionJump";
import { ProfileTicker } from "./StateProfileTicker";
import { RegionStandOuts } from "./RegionStandOuts";
import { StandOuts } from "./StandOuts";
import { useAutoCarousel, AUTO_CAROUSEL_MS } from "./useAutoCarousel";
import { ThemeToggle } from "./ThemeToggle";
import type { SearchEntry } from "@/lib/search";
import type { StandOut } from "@/lib/standouts";

let reduced = false;
beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion") && reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal("ResizeObserver", undefined);
  vi.stubGlobal("DOMMatrixReadOnly", class { m41 = 0; });
  Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Definitions", () => {
  it("keeps a floating definition open when the pointer moves into it", () => {
    vi.useFakeTimers();
    render(<FloatingMetricTerm metricId="test" label="Metric" definition="Complete definition" />);
    fireEvent.mouseEnter(screen.getByText("Metric"));
    fireEvent.mouseLeave(screen.getByText("Metric"));
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("tooltip").textContent).toContain("Complete definition");
    fireEvent.mouseLeave(screen.getByRole("tooltip"));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("Escape dismisses hover-only definitions", () => {
    render(<FloatingMetricTerm metricId="test" label="Metric" definition="Definition" />);
    fireEvent.mouseEnter(screen.getByText("Metric"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("Escape does not throw keyboard focus away", () => {
    render(<FloatingMetricTerm metricId="test" label="Metric" definition="Definition" />);
    const anchor = screen.getByText("Metric");
    act(() => anchor.focus());
    fireEvent.keyDown(anchor, { key: "Escape" });
    expect(document.activeElement).toBe(anchor);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("lets keyboard users scroll a definition that exceeds the viewport", () => {
    render(<FloatingMetricTerm metricId="test" label="Metric" definition="Long definition" />);
    const anchor = screen.getByText("Metric"); act(() => anchor.focus());
    const tip = screen.getByRole("tooltip");
    Object.defineProperty(tip, "scrollHeight", {value:1000});
    Object.defineProperty(tip, "clientHeight", {value:200});
    fireEvent.keyDown(anchor, {key:"PageDown"});
    expect(HTMLElement.prototype.scrollBy).toHaveBeenCalledWith({top:200});
    expect(document.activeElement).toBe(anchor);
  });
  it("adds dismissal to ordinary definitions without losing their no-script text", () => {
    const definition = <Definition term={{ key: "test", title: "Term", phrases: [], definition: "Always in the document" }}>Term label</Definition>;
    const html = renderToStaticMarkup(definition);
    expect(html).toContain("Always in the document");
    expect(html).toContain('role="tooltip"');
    expect(html).not.toContain('data-enhanced="true"');
    render(definition);
    const anchor = screen.getByText("Term label");
    act(() => anchor.focus());
    fireEvent.keyDown(anchor, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.activeElement).toBe(anchor);
    expect(anchor.parentElement?.querySelector('.tip')?.textContent).toContain("Always in the document");
  });
});

const places = [
  { id: 5, name: "Atlantic", detail: "County", level: "county" },
  { id: 6, name: "Atlantic City", detail: "City", level: "municipality" },
] as SearchEntry[];
describe("Place search", () => {
  it("opens on the first result with ArrowDown after Escape, then picks with Enter", () => {
    const pick = vi.fn();
    render(<PlacePicker entries={places} onPick={pick} label="Find place" placeholder="Search" name="place" initialQuery="Atlantic" />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input); fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toContain("option-0");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(pick).toHaveBeenCalledWith(places[0]);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
  it.each([null, []])("announces loading/no matches outside the listbox (%s)", entries => {
    render(<PlacePicker entries={entries} onPick={vi.fn()} label="Find place" placeholder="Search" name="place" initialQuery="Unknown" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox").hasAttribute("aria-activedescendant")).toBe(false);
  });
});

describe("Motion and non-drag alternatives", () => {
  it("autoplay pauses for focus and respects reduced motion", () => {
    vi.useFakeTimers(); const advance = vi.fn();
    function Harness() { const auto = useAutoCarousel(true, advance); return <div ref={auto.rootRef} {...auto.interactionProps}><button>Focus here</button></div>; }
    render(<Harness />);
    act(() => vi.advanceTimersByTime(AUTO_CAROUSEL_MS));
    expect(advance).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(AUTO_CAROUSEL_MS * 2));
    expect(advance).toHaveBeenCalledTimes(1);
    cleanup(); reduced = true; render(<Harness />);
    act(() => vi.advanceTimersByTime(AUTO_CAROUSEL_MS * 2));
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it("ticker buttons pause the strip and move it without dragging; copies are not focusable", () => {
    vi.useFakeTimers();
    render(<ProfileTicker title="Housing here" ariaLabel="Housing profile" items={[{ metric_id: "test", label: "Value", value: "1", definition: "Definition", context: null }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Show later housing here metrics" }));
    act(() => vi.advanceTimersByTime(50));
    expect(HTMLElement.prototype.scrollBy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play housing here ticker" }).getAttribute("aria-pressed")).toBe("true");
    for (const copy of document.querySelectorAll('[aria-hidden="true"].state-ticker-group')) expect(copy.querySelector('[tabindex="0"],button,a')).toBeNull();
  });
  it("each overflowing ranked-measure row has a persistent Pause control", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    const item = { metric_id: "test", group: "leads", label: "Metric", rank: "1/21", figure: "10" } as StandOut;
    render(<RegionStandOuts name="County" peers="21 counties" items={[item]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause leading measures" }));
    expect(screen.getByRole("button", { name: "Play leading measures" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("printed report standouts remain static", () => {
    const item = { metric_id: "test", group: "leads", label: "Metric", rank: "1/21", figure: "10" } as StandOut;
    render(<StandOuts name="County" peers="21 counties" items={[item]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector('.state-ticker,.region-standout-rail')).toBeNull();
  });
});

it("section jumps reveal a closed disclosure and focus its heading", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ top: 100 }] as unknown as DOMRectList);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<><SectionJump /><details><summary>Evidence</summary><section id="region-detailed-data"><h2>Tables</h2></section></details></>);
  fireEvent.change(screen.getByRole("combobox", { name: "Jump to section" }), { target: { value: "#region-detailed-data" } });
  expect(document.querySelector("details")?.open).toBe(true);
  expect(document.activeElement).toBe(screen.getByText("Tables"));
  expect(scroll).toHaveBeenCalled();
});

it("theme switching uses no page transition when reduced motion is requested", () => {
  reduced = true;
  const transition = vi.fn();
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: transition });
  localStorage.clear(); document.documentElement.removeAttribute("data-theme");
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to the dark theme" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(transition).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Switch to the light theme" })).toBeTruthy();
  Reflect.deleteProperty(document, "startViewTransition");
  localStorage.clear(); document.documentElement.removeAttribute("data-theme");
});
