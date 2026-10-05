"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { scene, type Outline } from "@/lib/globe";
import { WORLD_LAND } from "@/lib/worldLand";
import { boundCoverage, COVERAGE_HOME, COVERAGE_REGIONS, coverageScene, regionViewport, STATE_DESTINATIONS, zoomCoverage, type CoverageRegion, type CoverageViewport } from "@/lib/coverageMap";

/** Zoomable coverage geometry without continuous reprojection or local-data downloads. */
export function NationalCoverageMap() {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const geography = useRef<SVGGElement>(null);
  const flight = useRef<{ animation: Animation; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState("New Jersey · Available now");
  const [viewport, setViewport] = useState(COVERAGE_HOME);
  const [region, setRegion] = useState<CoverageRegion | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; start: CoverageViewport; pixels: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      fetch("/states.json", { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(response.status))
        .then((body: { outlines: PackedOutline[] }) => {
          if (controller.signal.aborted) return;
          if (!body.outlines?.length) throw new Error("No state outlines");
          setOutlines(unpack(body.outlines));
        })
        .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    };
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { load(); observer?.disconnect(); }
    }, { rootMargin: "200px" }) : null;
    if (observer && stage.current) observer.observe(stage.current);
    else load();
    return () => { observer?.disconnect(); controller.abort(); };
  }, []);

  const drawing = useMemo(() => coverageScene(outlines), [outlines]);
  const land = useMemo(() => drawing ? scene(drawing.perspective, WORLD_LAND, () => 0) : [], [drawing]);

  useEffect(() => {
    const reset = () => {
      if (flight.current) {
        clearTimeout(flight.current.timer);
        flight.current.animation.cancel();
        flight.current = null;
      }
      stage.current?.removeAttribute("data-entering");
    };
    window.addEventListener("popstate", reset);
    window.addEventListener("pageshow", reset);
    return () => {
      reset();
      window.removeEventListener("popstate", reset);
      window.removeEventListener("pageshow", reset);
    };
  }, []);

  const enterState = (event: MouseEvent<HTMLAnchorElement | SVGAElement>) => {
    // Ordinary href navigation remains available for modifiers, reduced motion,
    // missing geometry and browsers without the animation API.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !drawing || !geography.current?.animate) return;
    event.preventDefault();
    if (flight.current) return;
    const destination = STATE_DESTINATIONS.NJ;
    router.prefetch(destination);
    const x = viewport.x + drawing.locator[0] * viewport.scale;
    const y = viewport.y + drawing.locator[1] * viewport.scale;
    const zoom = 4;
    let animation: Animation;
    try {
      animation = geography.current.animate([
        { transform: "translate(0px, 0px) scale(1)" },
        { transform: `translate(${450 - zoom * x}px, ${240 - zoom * y}px) scale(${zoom})` },
      ], { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
    } catch {
      router.push(destination);
      return;
    }
    stage.current?.setAttribute("data-entering", "true");
    let navigated = false;
    const arrive = () => {
      if (navigated || flight.current?.animation !== animation) return;
      navigated = true;
      clearTimeout(flight.current.timer);
      router.push(destination);
    };
    // Navigation does not rely on animationend: throttled/cancelled motion cannot trap
    // the reader. Unmount/Back cancel this fallback before it can change another page.
    flight.current = { animation, timer: setTimeout(arrive, 650) };
    void animation.finished.then(arrive, arrive);
  };

  const zoomMap = (factor: number) => {
    if (!drawing || flight.current) return;
    setRegion(null);
    setViewport((current) => zoomCoverage(current, factor, drawing.locator));
  };
  const locator = drawing ? [viewport.x + drawing.locator[0] * viewport.scale, viewport.y + drawing.locator[1] * viewport.scale] : null;

  return <div className="coverage-atlas">
    <div className="coverage-region-bar">
      <span>Look closer</span>
      <div role="group" aria-label="Browse map by Census region">
        {(Object.keys(COVERAGE_REGIONS) as CoverageRegion[]).map((name) => <button key={name} type="button"
          disabled={!drawing} aria-pressed={region === name} onClick={() => {
            if (flight.current) return;
            const next = region === name ? COVERAGE_HOME : regionViewport(outlines, name);
            if (!next) return;
            setViewport(next); setRegion(region === name ? null : name);
          }}>{name}</button>)}
      </div>
    </div>
    <div ref={stage} className="coverage-map-stage" onMouseLeave={() => setHovered("New Jersey · Available now")}>
      <span className="coverage-map-caption">{region ? `${region} · Geographic view` : "Contiguous United States"}</span>
      <Link className="coverage-mobile-link" href="/states/new-jersey" onClick={enterState}>New Jersey ↗</Link>
      <div className="coverage-map-window">
      {drawing ? <svg className="coverage-map" data-zoomed={viewport.scale > 1} data-dragging={dragging} viewBox="0 0 900 480" role="group" aria-labelledby="coverage-map-title coverage-map-description"
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (viewport.scale === 1 || event.button !== 0 || !event.isPrimary || flight.current) return;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: viewport, pixels: event.currentTarget.getScreenCTM()?.a ?? 1, moved: false };
        }}
        onPointerMove={(event) => {
          const held = drag.current;
          if (!held || held.id !== event.pointerId) return;
          const dx = event.clientX - held.x, dy = event.clientY - held.y;
          if (!held.moved && Math.hypot(dx, dy) < 6) return;
          if (!held.moved && event.pointerType === "touch" && Math.abs(dy) >= Math.abs(dx)) {
            drag.current = null;
            return;
          }
          held.moved = true;
          setRegion(null);
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          setViewport(boundCoverage({ ...held.start, x: held.start.x + dx / held.pixels, y: held.start.y + dy / held.pixels }));
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onLostPointerCapture={(event) => {
          // Touch starts with implicit capture on the state path. Its release bubbles
          // when capture transfers to the SVG; that is not the end of this drag.
          if (event.target === event.currentTarget) { drag.current = null; setDragging(false); }
        }}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); }
        }}>
        <title id="coverage-map-title">Explore housing coverage by state</title>
        <desc id="coverage-map-description">New Jersey is blue and available. All other states are unavailable. Alaska and Hawaii are outside this view. Zoom with the buttons; drag the enlarged map, or swipe sideways on mobile. Vertical scrolling moves the page. Use the New Jersey link to explore.</desc>
        <g ref={geography} className="coverage-geography">
        <g className="coverage-viewport" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
        <g className="coverage-land" aria-hidden="true">{land.map((part) => <path key={part.id} d={part.base} />)}</g>
        {drawing.states.map((state) => {
          const destination = STATE_DESTINATIONS[String(state.id)];
          return destination ? <a key={state.id} href={destination} onClick={enterState} aria-label={`Explore ${state.name} housing data`} className="coverage-available" onFocus={() => setHovered(`${state.name} · Available now`)} onMouseEnter={() => setHovered(`${state.name} · Available now`)}>
            <path className="coverage-state-shadow" d={state.base} />
            <path className="coverage-state-wall" d={state.walls} />
            <path className="coverage-state-top" d={state.top} />
          </a> : <path key={state.id} className="coverage-unavailable" d={state.base} aria-hidden="true" onMouseEnter={() => setHovered(`${state.name} · Not available yet`)}><title>{state.name} — Not available yet</title></path>;
        })}
        </g>
        </g>
        {locator && locator[0] > 0 && locator[0] < 900 && locator[1] > 0 && locator[1] < 480 && drawing.states.some((state) => state.id === "NJ") && <a href={STATE_DESTINATIONS.NJ} onClick={enterState} className="coverage-locator" aria-label="Explore New Jersey housing data">
          <path d={`M${locator[0]},${locator[1]} L${locator[0] - 26},${locator[1] - 48} H${locator[0] - 154}`} />
          <circle cx={locator[0]} cy={locator[1]} r="4" />
          <rect x={locator[0] - 167} y={locator[1] - 84} width="158" height="34" rx="8" />
          <text x={locator[0] - 154} y={locator[1] - 62}>New Jersey ↗</text>
        </a>}
      </svg> : <div className="coverage-map-placeholder"><p>{failed ? "Map unavailable. Explore New Jersey below." : "Loading the state map…"}</p></div>}
      {drawing && <>
        <div className="globe-controls globe-controls-zoom coverage-zoom" role="group" aria-label="United States map zoom controls">
          <button type="button" aria-label="Zoom out United States map" disabled={viewport.scale === 1} onClick={() => zoomMap(1 / 1.4)}>−</button>
          <span className="globe-divider" aria-hidden="true" />
          <button type="button" aria-label="Zoom in United States map" disabled={viewport.scale === 5} onClick={() => zoomMap(1.4)}>+</button>
          <span className="globe-divider" aria-hidden="true" />
          <button type="button" className="globe-icon" aria-label="Reset United States map" title="Reset map" disabled={viewport.scale === 1 && !region} onClick={() => { if (!flight.current) { setViewport(COVERAGE_HOME); setRegion(null); } }}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5a5.5 5.5 0 1 1-.4 5M3 1.5V5h3.5" /></svg>
          </button>
        </div>
      </>}
      </div>
      <div className="coverage-map-foot"><span>{hovered}</span><span><i aria-hidden="true" />Blue = available{viewport.scale > 1 && " · Drag to move"}</span></div>
    </div>
    <div className="coverage-state-preview">
      <div><p className="entry-kicker">Detailed coverage available now</p><h3>New Jersey</h3><p>Counties, towns and ZIP codes.</p></div>
      <Link href="/states/new-jersey" className="coverage-state-action">Explore New Jersey <span aria-hidden="true">↗</span></Link>
    </div>
    <p className="coverage-map-note">Regions help you browse the map. Only New Jersey has published housing pages. Alaska and Hawaii are outside this view.</p>
  </div>;
}
