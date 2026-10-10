// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TrendEntrance } from "./TrendEntrance";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps content visible without observer support", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const { container } = render(<TrendEntrance><span>6.81%</span></TrendEntrance>);
  expect(container.textContent).toBe("6.81%");
  expect(container.firstElementChild?.getAttribute("data-entered")).toBe("false");
});

it("starts on intersection and disconnects rather than repeating on scroll", () => {
  let notify: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {}
    disconnect = disconnect;
  });
  const { container } = render(<TrendEntrance>History</TrendEntrance>);
  act(() => notify!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(container.firstElementChild?.getAttribute("data-entered")).toBe("true");
  expect(disconnect).toHaveBeenCalledOnce();
});
