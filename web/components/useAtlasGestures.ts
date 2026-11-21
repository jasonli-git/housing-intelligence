"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export type AtlasViewport = { scale: number; x: number; y: number };

/**
 * The housing map's pan and zoom (Milestone 66, ARCHITECTURE #523).
 *
 * A gesture moves the drawn map as a picture: the SVG is given a CSS transform from the
 * view React last drew to the view under the reader's hand, which the browser composites
 * without repainting a single outline. React hears of the new view once, when the gesture
 * ends (`commit`), and redraws the outlines sharp at it; the transform is cleared in the
 * same frame. Until #523 every step of a drag or a zoom set React state, so each one
 * re-rendered the atlas and repainted every outline.
 *
 * Gestures: one pointer drags; two pinch, zooming about their midpoint as they move it;
 * the scroll wheel and a trackpad pinch zoom about the pointer. Buttons, keys and choosing
 * a place glide there with `animateTo`, the same way.
 */
export function useAtlasGestures({
  svg, layers = [], drawn, frame, bounded, commit, minScale, maxScale,
}: {
  svg: RefObject<SVGSVGElement | null>;
  /** Other SVGs stacked on it with the same view box, moved with it. */
  layers?: RefObject<SVGSVGElement | null>[];
  /** The view React has drawn: the transform is measured from it. */
  drawn: AtlasViewport;
  /** The SVG's size in its own units, and the open area the map is fitted to. */
  frame: { width: number; height: number; box: { x: number; y: number; w: number; h: number } };
  bounded: (v: AtlasViewport) => AtlasViewport;
  /** Hands a finished gesture's view to React, to be drawn directly rather than eased. */
  commit: (v: AtlasViewport) => void;
  minScale: number;
  maxScale: number;
}) {
  const drawnRef = useRef(drawn);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const boundedRef = useRef(bounded);
  boundedRef.current = bounded;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  // The view under the reader's hand, ahead of React's while a gesture runs.
  const live = useRef(drawn);
  const active = useRef(false);
  // The SVG's untransformed place on screen, read before a gesture moves it.
  const rect = useRef<DOMRect | null>(null);
  const moved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ view: AtlasViewport; points: { x: number; y: number }[] } | null>(null);
  const frameId = useRef(0);
  const wheelTimer = useRef(0);
  const refreshed = useRef(0);

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const each = (set: (el: SVGSVGElement) => void) => {
    for (const ref of [svg, ...layersRef.current]) if (ref.current) set(ref.current);
  };
  const clear = () => each((el) => { if (el.style.transform) el.style.transform = ""; });

  // React has drawn a view: the picture is the map again.
  useLayoutEffect(() => {
    drawnRef.current = drawn;
    if (!active.current) live.current = drawn;
    clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, svg]);

  const measure = () => {
    const el = svg.current;
    if (!el) return null;
    if (!active.current || !rect.current) rect.current = el.getBoundingClientRect();
    return rect.current;
  };
  /** How the SVG's units sit on screen: it fits its view box whole and centres it. */
  const fitOf = (r: DOMRect) => {
    const { width, height } = frameRef.current;
    const px = Math.min(r.width / width, r.height / height);
    return { px, left: (r.width - width * px) / 2, top: (r.height - height * px) / 2 };
  };
  /** A point on screen, in the SVG's own units. */
  const toUnits = (clientX: number, clientY: number) => {
    const r = measure();
    if (!r || !r.width) return { x: 0, y: 0 };
    const f = fitOf(r);
    return { x: (clientX - r.left - f.left) / f.px, y: (clientY - r.top - f.top) / f.px };
  };

  const paint = useCallback((next: AtlasViewport) => {
    const v = boundedRef.current(next);
    live.current = v;
    const el = svg.current, r = rect.current, d = drawnRef.current;
    if (!el || !r || !r.width) return;
    const { box } = frameRef.current;
    const { px, left, top } = fitOf(r), ratio = v.scale / d.scale;
    // The picture scaled by `ratio` about the SVG's corner, then moved so a point of the
    // map drawn at the drawn view lands where the live view puts it, in screen pixels.
    const tx = left * (1 - ratio) + px * (box.x + v.x - ratio * (box.x + d.x));
    const ty = top * (1 - ratio) + px * (box.y + v.y - ratio * (box.y + d.y));
    const transform = `translate(${tx}px, ${ty}px) scale(${ratio})`;
    each((layer) => { layer.style.transformOrigin = "0 0"; layer.style.transform = transform; });
    // The layers are clipped to their box, so a long drag or a deep zoom would show bare
    // water past what was drawn: well into one, React redraws at the live view, at most
    // five times a second, and the gesture carries on from there.
    const far = Math.abs(tx) > r.width / 4 || Math.abs(ty) > r.height / 4 || ratio > 1.5 || ratio < 2 / 3;
    const now = performance.now();
    if (active.current && far && now - refreshed.current > 200) { refreshed.current = now; commitRef.current(v); }
  }, [svg]);

  const begin = () => {
    cancelAnimationFrame(frameId.current);
    if (!active.current) { rect.current = null; measure(); }
    active.current = true;
  };
  const end = () => {
    if (!active.current) return;
    active.current = false;
    const v = live.current, d = drawnRef.current;
    // A tap that moved nothing redraws nothing.
    if (v.scale === d.scale && v.x === d.x && v.y === d.y) { clear(); return; }
    commitRef.current(v);
  };

  /** Zoom by `factor` about a point in the SVG's units, from the live view. */
  const zoomAbout = (v: AtlasViewport, factor: number, at: { x: number; y: number }) => {
    const { box } = frameRef.current;
    const scale = Math.min(maxScale, Math.max(minScale, v.scale * factor)), ratio = scale / v.scale;
    const ox = at.x - box.x, oy = at.y - box.y;
    return { scale, x: ox - (ox - v.x) * ratio, y: oy - (oy - v.y) * ratio };
  };

  /** Glide to a view (zoom buttons, keys, choosing a place), or jump with reduced motion. */
  const animateTo = useCallback((target: AtlasViewport | ((current: AtlasViewport) => AtlasViewport)) => {
    begin();
    const from = live.current, to = boundedRef.current(typeof target === "function" ? target(from) : target);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { paint(to); end(); return; }
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 300), e = 1 - Math.pow(1 - t, 3);
      const scale = Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e);
      paint(t === 1 ? to : { scale, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      if (t < 1) frameId.current = requestAnimationFrame(tick); else end();
    };
    frameId.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint]);
  /** Zoom about the middle of the open area. */
  const zoomBy = useCallback((factor: number) => {
    const { box } = frameRef.current;
    animateTo((v) => zoomAbout(v, factor, { x: box.x + box.w / 2, y: box.y + box.h / 2 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateTo]);

  // The wheel is listened for directly: React's wheel handler is passive and cannot stop
  // the page scrolling under the map.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      begin();
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      // A trackpad pinch arrives as a wheel with Ctrl held, in finer steps.
      const factor = Math.exp(-event.deltaY * lines * (event.ctrlKey ? 0.01 : 0.002));
      paint(zoomAbout(live.current, factor, toUnits(event.clientX, event.clientY)));
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(end, 160);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { el.removeEventListener("wheel", wheel); window.clearTimeout(wheelTimer.current); cancelAnimationFrame(frameId.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, paint]);

  /** The gesture restarts from here whenever a finger lands or lifts. */
  const rebase = () => { start.current = { view: live.current, points: [...pointers.current.values()].map((p) => toUnits(p.x, p.y)) }; };

  const handlers = {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!pointers.current.size) moved.current = false;
      begin();
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      rebase();
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(e.pointerId) || !start.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = [...pointers.current.values()].map((p) => toUnits(p.x, p.y)), was = start.current.points, from = start.current.view;
      if (now.length === 1 && was.length === 1) {
        const dx = now[0].x - was[0].x, dy = now[0].y - was[0].y;
        if (!moved.current && Math.hypot(dx, dy) * fitOf(measure()!).px > 4) {
          moved.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (moved.current) paint({ ...from, x: from.x + dx, y: from.y + dy });
      } else if (now.length >= 2 && was.length >= 2) {
        moved.current = true;
        const mid = (p: { x: number; y: number }[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
        const gap = (p: { x: number; y: number }[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
        const m0 = mid(was), m1 = mid(now);
        const zoomed = zoomAbout(from, gap(now) / gap(was), m0);
        paint({ ...zoomed, x: zoomed.x + m1.x - m0.x, y: zoomed.y + m1.y - m0.y });
      }
    },
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => {
      pointers.current.delete(e.pointerId);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (pointers.current.size) rebase(); else { start.current = null; end(); }
    },
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => {
      pointers.current.delete(e.pointerId);
      moved.current = true;
      if (pointers.current.size) rebase(); else { start.current = null; end(); }
    },
  };

  return { handlers, animateTo, zoomBy, moved, active, live };
}
