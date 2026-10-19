"use client";

import Link from "next/link";
import { useRef } from "react";

/**
 * A county's towns in the page head (2026-10-19), as the New Jersey page sets out its
 * counties (CountyCabinet): one swipeable glass strip with arrows, every town a link.
 */
export function TownRow({ name, towns }: { name: string; towns: { id: number; name: string; href: string }[] }) {
  const track = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  if (!towns.length) return null;
  const scroll = (direction: number) => {
    const node = track.current;
    if (node) node.scrollBy({ left: direction * node.clientWidth * .7, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return <nav className="county-strip town-strip" aria-label={`Towns in ${name}`}>
    <span className="county-strip-label">{towns.length} towns</span>
    <button className="county-strip-arrow" type="button" aria-label="Scroll towns left" onClick={() => scroll(-1)}>‹</button>
    <div className="county-strip-track" ref={track}>
      {towns.map((town, index) => <Link className="destination-town county-strip-pill" key={town.id} href={town.href}
        ref={node => { links.current[index] = node; }}
        onKeyDown={event => {
          const next = event.key === "ArrowRight" ? Math.min(index + 1, towns.length - 1) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? towns.length - 1 : null;
          if (next !== null) { event.preventDefault(); links.current[next]?.focus({ preventScroll: true }); links.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); }
        }}><span>{town.name}</span></Link>)}
    </div>
    <button className="county-strip-arrow" type="button" aria-label="Scroll towns right" onClick={() => scroll(1)}>›</button>
  </nav>;
}
