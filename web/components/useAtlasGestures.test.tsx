// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { useAtlasGestures, type AtlasViewport } from "./useAtlasGestures";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

// A 1000×500 SVG drawn into a 500×250 box: one unit is half a pixel, with no letterbox.
const frame = { width: 1000, height: 500, box: { x: 0, y: 0, w: 1000, h: 500 } };
const free = (v: AtlasViewport) => ({ ...v, scale: Math.max(0.8, Math.min(10, v.scale)) });

function Map({ drawn, commit }: { drawn: AtlasViewport; commit: (v: AtlasViewport) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const g = useAtlasGestures({ svg, drawn, frame, bounded: free, commit, minScale: 0.8, maxScale: 10 });
  return <><svg ref={svg} data-testid="map" {...g.handlers} /><button onClick={() => g.zoomBy(2)}>in</button></>;
}
function setup() {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 500, height: 250, right: 500, bottom: 250, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  // jsdom has no pointer capture.
  Object.assign(Element.prototype, { setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn() });
  const commit = vi.fn();
  const view = render(<Map drawn={{ scale: 1, x: 0, y: 0 }} commit={commit} />);
  return { commit, map: view.getByTestId("map") as unknown as SVGSVGElement, view };
}
const pointer = (map: Element, type: string, id: number, x: number, y: number) =>
  fireEvent[type as "pointerDown"](map, { pointerId: id, clientX: x, clientY: y, button: 0, pointerType: "touch" });

it("drags as a picture and hands the view over once, at the end", () => {
  const { commit, map } = setup();
  pointer(map, "pointerDown", 1, 100, 100);
  pointer(map, "pointerMove", 1, 150, 120);
  pointer(map, "pointerMove", 1, 200, 140);
  // Moved by CSS, not by React: nothing committed mid-drag.
  expect(commit).not.toHaveBeenCalled();
  expect(map.style.transform).toBe("translate(100px, 40px) scale(1)");
  pointer(map, "pointerUp", 1, 200, 140);
  // 100 by 40 pixels is 200 by 80 units.
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith({ scale: 1, x: 200, y: 80 });
});

it("commits nothing for a tap that did not move", () => {
  const { commit, map } = setup();
  pointer(map, "pointerDown", 1, 100, 100);
  pointer(map, "pointerMove", 1, 101, 100);
  pointer(map, "pointerUp", 1, 101, 100);
  expect(commit).not.toHaveBeenCalled();
  expect(map.style.transform).toBe("");
});

it("pinches about the fingers' midpoint", () => {
  const { commit, map } = setup();
  pointer(map, "pointerDown", 1, 200, 100);
  pointer(map, "pointerDown", 2, 300, 100);
  pointer(map, "pointerMove", 1, 150, 100);
  pointer(map, "pointerMove", 2, 350, 100);
  pointer(map, "pointerUp", 1, 150, 100);
  pointer(map, "pointerUp", 2, 350, 100);
  // The gap went from 100 to 200 pixels: twice the zoom, with the midpoint (500, 200
  // units) held still.
  expect(commit).toHaveBeenCalledWith({ scale: 2, x: -500, y: -200 });
});

it("zooms with the wheel about the pointer, and stops the page scrolling", () => {
  vi.useFakeTimers();
  const { commit, map } = setup();
  const wheel = new WheelEvent("wheel", { deltaY: -100 * Math.log(2) / 0.2, clientX: 250, clientY: 125, cancelable: true, bubbles: true });
  act(() => { map.dispatchEvent(wheel); });
  expect(wheel.defaultPrevented).toBe(true);
  expect(commit).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(200); });
  const [v] = commit.mock.calls[0];
  // e^(100·ln2/0.2·0.002) = 2: twice the zoom about the centre (500, 250 units).
  expect(v.scale).toBeCloseTo(2);
  expect(v.x).toBeCloseTo(-500);
  expect(v.y).toBeCloseTo(-250);
});

it("jumps to a button's zoom when motion is reduced", () => {
  const { commit, view } = setup();
  fireEvent.click(view.getByText("in"));
  expect(commit).toHaveBeenCalledWith({ scale: 2, x: -500, y: -250 });
});

it("clears the picture's transform once React draws the committed view", () => {
  const { map, view } = setup();
  pointer(map, "pointerDown", 1, 100, 100);
  pointer(map, "pointerMove", 1, 200, 100);
  expect(map.style.transform).not.toBe("");
  view.rerender(<Map drawn={{ scale: 1, x: 200, y: 0 }} commit={vi.fn()} />);
  expect(map.style.transform).toBe("");
});
