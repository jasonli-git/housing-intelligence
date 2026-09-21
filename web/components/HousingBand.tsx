"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { CarouselProgress, useAutoCarousel } from "@/components/useAutoCarousel";
import type { ProfileItem } from "@/lib/verdict";

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

function splitContext(context: string | null) {
  if (!context) return { words: null, rank: null };
  const ranked = context.match(/^(.*) · (\d+)(?:st|nd|rd|th) of (\d+)$/);
  if (!ranked) return { words: context, rank: null };
  return {
    words: ranked[1],
    rank: { value: ranked[2], of: ranked[3] },
  };
}

/**
 * A fixed-height, paged summary of the region's housing profile. The band clips its visual
 * treatment to its rounded frame, so definitions render in the document layer above it.
 */
export function HousingBand({ items, title = "The housing here", tone = "default" }: {
  items: ProfileItem[];
  title?: string;
  tone?: "default" | "blue";
}) {
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const headingId = useId();
  // Three is a safe server-rendered first page. ResizeObserver expands or contracts it
  // to the space actually available once the browser knows the band's width.
  const [capacity, setCapacity] = useState(Math.min(3, items.length));
  const [start, setStart] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const measure = useCallback(() => {
    const node = list.current;
    if (!node) return;
    const next = Math.min(items.length, Math.max(1, Math.floor(node.clientWidth / (tone === "blue" ? 190 : 144))));
    setCapacity(next);
    setStart((current) => Math.min(current, Math.max(0, items.length - next)));
  }, [items.length, tone]);

  useEffect(() => {
    measure();
    const node = list.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const maxStart = Math.max(0, items.length - capacity);
  const step = Math.max(1, capacity - 1);
  const visible = items.slice(start, start + capacity);
  const paged = items.length > capacity;
  const advance = useCallback(() => {
    setDirection("forward");
    setStart((current) => current >= maxStart ? 0 : Math.min(maxStart, current + step));
  }, [maxStart, step]);
  const autoplay = useAutoCarousel(paged, advance);
  const move = (direction: -1 | 1) => {
    setDirection(direction === 1 ? "forward" : "backward");
    setStart((current) => {
      if (direction === 1) return current >= maxStart ? 0 : Math.min(maxStart, current + step);
      return current <= 0 ? maxStart : Math.max(0, current - step);
    });
    autoplay.restart();
  };

  if (items.length === 0) return null;
  return (
    <section
      ref={autoplay.rootRef}
      className={`housing-band${tone === "blue" ? " housing-band-blue" : ""}`}
      aria-labelledby={headingId}
      {...autoplay.interactionProps}
    >
      <div className="housing-band-head">
        <h2 id={headingId}>{title}</h2>
        {paged && (
          <div className="housing-band-nav">
            <button
              type="button"
              className="housing-band-arrow"
              aria-label="Show earlier housing facts"
              aria-controls={listId}
              onClick={() => move(-1)}
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              className="housing-band-arrow"
              aria-label="Show later housing facts"
              aria-controls={listId}
              onClick={() => move(1)}
            >
              <Arrow direction="right" />
            </button>
          </div>
        )}
      </div>
      <ul
        ref={list}
        id={listId}
        className="housing-band-items"
        aria-label="Housing profile"
        data-direction={direction}
      >
        {visible.map((item) => {
          const context = splitContext(item.context);
          return (
            <li
              key={`${start}-${item.metric_id}`}
              className={`housing-band-item${context.rank ? " has-rank" : ""}`}
            >
              {context.rank && (
                <span
                  className="housing-band-rank"
                  aria-label={`Rank ${context.rank.value} of ${context.rank.of}`}
                >
                  {context.rank.value}/{context.rank.of}
                </span>
              )}
              <b>{item.value}</b>
              <span className="housing-band-label">
                <FloatingMetricTerm
                  metricId={item.metric_id}
                  label={item.label}
                  definition={item.definition}
                  why={null}
                />
              </span>
              {context.words && <span className="housing-band-context">{context.words}</span>}
            </li>
          );
        })}
      </ul>
      {tone === "blue" && (
        <ul className="housing-band-print" aria-label="Statewide profile">
          {items.map((item) => <li key={item.metric_id}><b>{item.value}</b><span>{item.label}</span><small>{item.context}</small></li>)}
        </ul>
      )}
      {paged && !autoplay.reduceMotion && (
        <CarouselProgress
          cycle={autoplay.cycle}
          paused={autoplay.paused}
          className="housing-band-progress"
        />
      )}
    </section>
  );
}
