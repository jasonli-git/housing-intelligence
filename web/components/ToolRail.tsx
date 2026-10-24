"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** The stories rail interaction, scoped to the homepage tools only. */
export function ToolRail({ children }: { children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Allow for the focus-outline inset when the first card snaps into place.
    const measure = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", measure); observer.disconnect(); };
  }, []);
  function move(direction: number) {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * .85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="home-tools-rail">
    <button type="button" className="home-tools-arrow home-tools-previous" aria-label="Previous tools" aria-controls="home-tools-track" disabled={edges.start} onClick={() => move(-1)}>‹</button>
    <ul ref={track} id="home-tools-track" className="home-tools-track" aria-label="Housing tools" onKeyDown={(event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
      links[next]?.focus();
    }}>{children}</ul>
    <button type="button" className="home-tools-arrow home-tools-next" aria-label="Next tools" aria-controls="home-tools-track" disabled={edges.end} onClick={() => move(1)}>›</button>
  </div>;
}
