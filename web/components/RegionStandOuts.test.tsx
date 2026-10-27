// @vitest-environment jsdom
/**
 * The place page's interactive pieces (TODO #201, #395): the stand-out carousels'
 * auto-advance, wrapping and progress hairline, the paging that turns them off when a
 * row fits, and the newer town strip and `?mode=afford` forward. jsdom has no layout, so
 * each test gives the rail its widths and records the scroll calls.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AffordForward } from "./AffordForward";
import { RegionStandOuts } from "./RegionStandOuts";
import { TownRow } from "./TownRow";
import { AUTO_CAROUSEL_MS } from "./useAutoCarousel";
import type { StandOut } from "@/lib/standouts";

let reduced = false;
let scrollLeft = 0;
const scrollBy = vi.fn();
const scrollTo = vi.fn();

function widths(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
}

beforeEach(() => {
  reduced = false;
  scrollLeft = 0;
  scrollBy.mockReset();
  scrollTo.mockReset();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion") && reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal("ResizeObserver", undefined);
  Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", { configurable: true, get: () => scrollLeft, set: () => {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const items: StandOut[] = ["a", "b", "c", "d"].map((id, i) => ({ metric_id: id, group: "leads", label: `Metric ${id}`, rank: `${i + 1} of 21`, figure: "10%", margin: null, detail: "" }));
const deck = () => render(<RegionStandOuts name="County" peers="21 counties" items={items} />);
const fill = () => document.querySelector<HTMLElement>(".carousel-progress-fill");

describe("stand-out carousels", () => {
  it("advance one card after the interval, and the hairline restarts with them", () => {
    vi.useFakeTimers();
    widths(1000, 300);
    deck();
    const before = fill();
    expect(before?.style.animationDuration).toBe(`${AUTO_CAROUSEL_MS}ms`);
    expect(before?.style.animationPlayState).toBe("running");
    act(() => vi.advanceTimersByTime(AUTO_CAROUSEL_MS - 1));
    expect(scrollBy).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
    // A new fill element: the hairline starts over for the next card.
    expect(fill()).not.toBe(before);
  });

  it("wrap at either end instead of stopping", () => {
    widths(1000, 300);
    deck();
    scrollLeft = 700;
    fireEvent.click(screen.getByRole("button", { name: "Show later leading measures" }));
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
    scrollLeft = 0;
    fireEvent.click(screen.getByRole("button", { name: "Show earlier leading measures" }));
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 700 }));
  });

  it("hold, and pause the hairline, while hovered or paused by the reader", () => {
    vi.useFakeTimers();
    widths(1000, 300);
    deck();
    const row = document.querySelector<HTMLElement>(".standout-deck")!;
    fireEvent.mouseEnter(row);
    expect(fill()?.style.animationPlayState).toBe("paused");
    act(() => vi.advanceTimersByTime(AUTO_CAROUSEL_MS * 2));
    expect(scrollBy).not.toHaveBeenCalled();
    fireEvent.mouseLeave(row);
    fireEvent.click(screen.getByRole("button", { name: "Pause leading measures" }));
    expect(fill()?.style.animationPlayState).toBe("paused");
    act(() => vi.advanceTimersByTime(AUTO_CAROUSEL_MS * 2));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("have no controls, hairline or tab stop when the row fits", () => {
    widths(300, 300);
    deck();
    expect(screen.queryByRole("button", { name: /leading measures/ })).toBeNull();
    expect(fill()).toBeNull();
    expect(document.querySelector(".region-standout-rail")?.getAttribute("tabindex")).toBeNull();
  });

  it("keep their arrows but drop the pause control and hairline under reduced motion", () => {
    reduced = true;
    widths(1000, 300);
    deck();
    expect(screen.getByRole("button", { name: "Show later leading measures" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pause leading measures/ })).toBeNull();
    expect(fill()).toBeNull();
  });
});

describe("the county's town directory", () => {
  it("filters towns without changing their destination", () => {
    render(<TownRow name="Mercer County" towns={[{ id: 1, name: "Ewing", href: "/nj/ewing" }, { id: 2, name: "Trenton", href: "/nj/trenton" }]} />);
    fireEvent.change(screen.getByRole("searchbox"), {target:{value:"Trenton"}});
    expect(screen.queryByRole("link", {name:"Ewing"})).toBeNull();
    expect(screen.getByRole("link", {name:"Trenton"}).getAttribute("href")).toBe("/nj/trenton");
  });
});

describe("old ?mode=afford bookmarks", () => {
  function at(search: string) {
    const replace = vi.fn();
    vi.stubGlobal("location", { search, replace });
    return replace;
  }

  it("send a place page's to the budget explorer for that place, keeping the rest", () => {
    const replace = at("?mode=afford&income=90000");
    render(<AffordForward placeId={224} />);
    expect(replace).toHaveBeenCalledWith("/afford?income=90000&place=224");
  });

  it("leave a page without the mode alone", () => {
    const replace = at("?income=90000");
    render(<AffordForward placeId={224} />);
    expect(replace).not.toHaveBeenCalled();
  });
});
