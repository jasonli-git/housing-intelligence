"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Definition } from "@/components/Definition";
import type { ProfileItem } from "@/lib/verdict";

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

/**
 * A fixed-height, paged summary of the region's housing profile. Paging rather than an
 * overflow clip keeps each definition tooltip free to open outside the band.
 */
export function HousingBand({ items }: { items: ProfileItem[] }) {
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  // Three is a safe server-rendered first page. ResizeObserver expands or contracts it
  // to the space actually available once the browser knows the band's width.
  const [capacity, setCapacity] = useState(Math.min(3, items.length));
  const [start, setStart] = useState(0);

  const measure = useCallback(() => {
    const node = list.current;
    if (!node) return;
    const next = Math.min(items.length, Math.max(1, Math.floor(node.clientWidth / 144)));
    setCapacity(next);
    setStart((current) => Math.min(current, Math.max(0, items.length - next)));
  }, [items.length]);

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
  const move = (direction: -1 | 1) => {
    setStart((current) => Math.min(maxStart, Math.max(0, current + direction * step)));
  };
  const visible = items.slice(start, start + capacity);
  const paged = items.length > capacity;

  if (items.length === 0) return null;
  return (
    <section className="housing-band" aria-labelledby="housing-heading">
      <div className="housing-band-head">
        <h2 id="housing-heading">The housing here</h2>
        {paged && (
          <div className="housing-band-nav">
            <button
              type="button"
              className="housing-band-arrow"
              aria-label="Show earlier housing facts"
              aria-controls={listId}
              disabled={start === 0}
              onClick={() => move(-1)}
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              className="housing-band-arrow"
              aria-label="Show later housing facts"
              aria-controls={listId}
              disabled={start === maxStart}
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
        aria-live="polite"
      >
        {visible.map((item) => (
          <li key={item.metric_id} className="housing-band-item">
            <b>{item.value}</b>
            <span className="housing-band-label">
              <Definition
                term={{
                  key: `profile-${item.metric_id}`,
                  title: item.label,
                  phrases: [],
                  definition: item.definition,
                }}
              >
                {item.label}
              </Definition>
            </span>
            {item.context && <span className="housing-band-context">{item.context}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
