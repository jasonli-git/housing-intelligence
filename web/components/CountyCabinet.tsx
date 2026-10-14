"use client";

import { useRef } from "react";
import Link from "next/link";
import type { CountyDestination } from "@/lib/countyPicker";
import { regionPath } from "@/lib/placeRoutes";

/** Native swipe navigation; every county is a direct destination. */
export function CountyCabinet({ counties }: { counties: CountyDestination[] }) {
  const track = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  if (!counties.length) return null;
  const scroll = (direction: number) => {
    const node = track.current;
    if (node) node.scrollBy({ left: direction * node.clientWidth * .7, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return <nav className="county-strip" aria-label="Explore New Jersey counties" id="state-county-navigation" data-jump-label="Explore counties">
    <span className="county-strip-label">Counties</span>
    <button className="county-strip-arrow" type="button" aria-label="Scroll counties left" onClick={() => scroll(-1)}>‹</button>
    <div className="county-strip-track" ref={track}>
      {counties.map((county, index) => <Link className="destination-county county-strip-pill" key={county.id} href={regionPath(county.id)}
        ref={node => { links.current[index] = node; }} aria-label={`Explore ${county.name}`}
        onKeyDown={event => {
          const next = event.key === "ArrowRight" ? Math.min(index + 1, counties.length - 1) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? counties.length - 1 : null;
          if (next !== null) { event.preventDefault(); links.current[next]?.focus({preventScroll:true}); links.current[next]?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"auto"}); }
        }}><span>{county.name.replace(/ County$/, "")}</span></Link>)}
    </div>
    <button className="county-strip-arrow" type="button" aria-label="Scroll counties right" onClick={() => scroll(1)}>›</button>
  </nav>;
}
