// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Briefing } from "./Briefing";
import type { Slide } from "./briefingSlides";

const slides: Slide[] = ["One", "Two", "Three"].map((k, n) => ({ key: k, section: n ? "Cost" : "Overview", kicker: k, headline: `${k} conclusion` }));

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); vi.restoreAllMocks(); });

describe("the briefing deck", () => {
  it("names every slide's conclusion in the page, not only the one on screen", () => {
    render(<Briefing name="Hoboken" slides={slides} fullHref="/nj/hoboken/full" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("One conclusion");
    expect(screen.getByText("Three: Three conclusion")).toBeTruthy();
  });

  it("carries the Full page | Briefing switch", () => {
    render(<Briefing name="Hoboken" slides={slides} fullHref="/nj/hoboken/full" />);
    expect(screen.getByRole("link", { name: "Full page" }).getAttribute("href")).toBe("/nj/hoboken/full");
    expect(screen.getByText("3 slides")).toBeTruthy();
  });

  it("moves by button, key and sideways swipe, and stops at the ends", () => {
    render(<Briefing name="Hoboken" slides={slides} fullHref="/nj/hoboken/full" />);
    fireEvent.click(screen.getByRole("button", { name: "Next: Two →" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Two conclusion");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "End" })).toHaveProperty("disabled", true);
    const slide = screen.getByRole("article");
    fireEvent.touchStart(slide, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(slide, { changedTouches: [{ clientX: 220, clientY: 110 }] });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Two conclusion");
    // A mostly vertical drag is a scroll, not a swipe.
    fireEvent.touchStart(slide, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(slide, { changedTouches: [{ clientX: 40, clientY: 300 }] });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Two conclusion");
  });

  it("opens at ?slide=N", () => {
    window.history.replaceState(null, "", "/nj/hoboken?slide=3");
    render(<Briefing name="Hoboken" slides={slides} fullHref="/nj/hoboken/full" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Three conclusion");
  });

  it("sends a section anchor, written for the full page, to the full page", () => {
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, hash: "#tax", search: "", replace } as Location);
    act(() => { render(<Briefing name="Hoboken" slides={slides} fullHref="/nj/hoboken/full" />); });
    expect(replace).toHaveBeenCalledWith("/nj/hoboken/full#tax");
  });
});
