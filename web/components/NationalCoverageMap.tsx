"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import { scene, type Outline } from "@/lib/globe";
import { WORLD_LAND } from "@/lib/worldLand";
import { coverageScene, STATE_DESTINATIONS } from "@/lib/coverageMap";

/** Stationary globe geometry: no pan capture, spinning loop or local-data download. */
export function NationalCoverageMap() {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const geography = useRef<SVGGElement>(null);
  const flight = useRef<{ animation: Animation; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState("New Jersey · Available now");

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
    const [x, y] = drawing.locator;
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

  return <div className="coverage-atlas">
    <div ref={stage} className="coverage-map-stage" onMouseLeave={() => setHovered("New Jersey · Available now")}>
      <span className="coverage-map-caption">Contiguous United States</span>
      <Link className="coverage-mobile-link" href="/states/new-jersey" onClick={enterState}>New Jersey ↗</Link>
      {drawing ? <svg className="coverage-map" viewBox="0 0 900 480" role="group" aria-labelledby="coverage-map-title coverage-map-description">
        <title id="coverage-map-title">Explore housing coverage by state</title>
        <desc id="coverage-map-description">New Jersey is blue and available. All other states are unavailable. Alaska and Hawaii are outside this view. Use the New Jersey link to explore.</desc>
        <g ref={geography} className="coverage-geography">
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
        {drawing.states.some((state) => state.id === "NJ") && <a href={STATE_DESTINATIONS.NJ} onClick={enterState} className="coverage-locator" aria-label="Explore New Jersey housing data">
          <path d={`M${drawing.locator[0]},${drawing.locator[1]} L${drawing.locator[0] - 26},${drawing.locator[1] - 48} H${drawing.locator[0] - 154}`} />
          <circle cx={drawing.locator[0]} cy={drawing.locator[1]} r="4" />
          <rect x={drawing.locator[0] - 167} y={drawing.locator[1] - 84} width="158" height="34" rx="8" />
          <text x={drawing.locator[0] - 154} y={drawing.locator[1] - 62}>New Jersey ↗</text>
        </a>}
      </svg> : <div className="coverage-map-placeholder"><p>{failed ? "Map unavailable. Explore New Jersey below." : "Loading the state map…"}</p></div>}
      <div className="coverage-map-foot"><span>{hovered}</span><span><i aria-hidden="true" />Blue = available</span></div>
    </div>
    <div className="coverage-state-preview">
      <div><p className="entry-kicker">Available now</p><h3>New Jersey</h3><p>Counties, towns and ZIP codes.</p></div>
      <Link href="/states/new-jersey" className="coverage-state-action">Explore New Jersey <span aria-hidden="true">↗</span></Link>
    </div>
    <p className="coverage-map-note">New Jersey only for now. Other states aren’t available yet.</p>
  </div>;
}
