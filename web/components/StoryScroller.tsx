"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import css from "./StoryScroller.module.css";

/** A row of story cards that scrolls sideways, with the stories page's previous and next
 *  buttons over its ends, centred on the cards' pictures. Touch and trackpad scroll it as
 *  before; the buttons hide at the end they cannot go past. */
export function StoryScroller({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, middle: 0 });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Scroll snapping may settle a few pixels short of either end.
    const measure = () => {
      const card = el.querySelector("li")?.getBoundingClientRect().width ?? 0;
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4, middle: card * 10 / 16 / 2 });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", measure); observer.disconnect(); };
  }, []);
  function move(direction: number) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * .85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  const top = edges.middle ? { top: `${edges.middle}px` } : undefined;
  return <div className={css.stage}>
    <button type="button" className={`${css.arrow} ${css.previous}`} style={top} aria-label={`Previous ${label}`} aria-controls={id} disabled={edges.start} onClick={() => move(-1)}>‹</button>
    <ul ref={track} id={id} tabIndex={0} aria-label={label}>{children}</ul>
    <button type="button" className={`${css.arrow} ${css.next}`} style={top} aria-label={`Next ${label}`} aria-controls={id} disabled={edges.end} onClick={() => move(1)}>›</button>
  </div>;
}
