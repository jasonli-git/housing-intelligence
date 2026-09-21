"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { FloatingMetricTerm } from "@/components/FloatingMetricTerm";
import { CarouselProgress, useAutoCarousel } from "@/components/useAutoCarousel";
import type { StandOut, StandOutGroup } from "@/lib/standouts";

const GROUPS: { key: StandOutGroup; title: string; sub: string }[] = [
  { key: "leads", title: "Leading", sub: "by change over five years" },
  { key: "lags", title: "Lagging", sub: "by change over five years" },
  { key: "value", title: "Highest and lowest", sub: "by current value" },
];

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

function StandOutRow({
  group,
  title,
  sub,
  items,
}: {
  group: StandOutGroup;
  title: string;
  sub: string;
  items: StandOut[];
}) {
  const rail = useRef<HTMLUListElement>(null);
  const railId = useId();
  const [overflow, setOverflow] = useState(false);

  const readOverflow = useCallback(() => {
    const node = rail.current;
    if (!node) return;
    const next = node.scrollWidth - node.clientWidth > 2;
    setOverflow((current) => current === next ? current : next);
  }, []);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;

    readOverflow();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(readOverflow);
    observer?.observe(node);

    return () => {
      observer?.disconnect();
    };
  }, [items.length, readOverflow]);

  const move = useCallback((direction: -1 | 1, wrap = false) => {
    const node = rail.current;
    if (!node) return;
    const end = Math.max(0, node.scrollWidth - node.clientWidth);
    const card = node.querySelector<HTMLElement>(".region-standout-card");
    const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 16;
    const distance = (card?.getBoundingClientRect().width ?? node.clientWidth * 0.85) + gap;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduceMotion ? "auto" : "smooth";
    if (wrap && direction === 1 && node.scrollLeft >= end - 2) {
      node.scrollTo({ left: 0, behavior });
    } else if (wrap && direction === -1 && node.scrollLeft <= 2) {
      node.scrollTo({ left: end, behavior });
    } else {
      node.scrollBy({ left: direction * distance, behavior });
    }
  }, []);

  const autoAdvance = useCallback(() => move(1, true), [move]);
  const autoplay = useAutoCarousel(overflow, autoAdvance);
  const moveManually = (direction: -1 | 1) => {
    move(direction, true);
    autoplay.restart();
  };

  return (
    <div
      ref={autoplay.rootRef}
      className="standout-deck"
      data-group={group}
      {...autoplay.interactionProps}
    >
      <div className="standout-deck-head">
        <h3 className="standout-deck-label">
          {title} <span>{sub}</span>
        </h3>
        {overflow && (
          <div className="standout-nav">
            <button
              type="button"
              className="standout-arrow"
              aria-label={`Show earlier ${title.toLowerCase()} measures`}
              aria-controls={railId}
              onClick={() => moveManually(-1)}
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              className="standout-arrow"
              aria-label={`Show later ${title.toLowerCase()} measures`}
              aria-controls={railId}
              onClick={() => moveManually(1)}
            >
              <Arrow direction="right" />
            </button>
          </div>
        )}
      </div>
      <ul
        ref={rail}
        id={railId}
        className="region-standout-rail"
        data-group={group}
        aria-label={`${title}, ${sub}`}
        tabIndex={overflow ? 0 : undefined}
      >
        {items.map((item) => (
          <li key={item.metric_id} className="region-standout-card">
            <span className="region-standout-rank">{item.rank}</span>
            <span className="region-standout-what">
              <FloatingMetricTerm metricId={item.metric_id} label={item.label} />
            </span>
            <span className="region-standout-figure">{item.figure}</span>
            {item.detail && <span className="region-standout-detail">{item.detail}</span>}
          </li>
        ))}
      </ul>
      {overflow && !autoplay.reduceMotion && (
        <CarouselProgress
          cycle={autoplay.cycle}
          paused={autoplay.paused}
          className="standout-progress"
        />
      )}
    </div>
  );
}

/**
 * The region-page treatment of the stand-outs: one horizontally scrollable card row per
 * kind of distinction. Reports deliberately keep the compact, static `StandOuts` grid.
 */
export function RegionStandOuts({ name, peers, items }: { name: string; peers: string; items: StandOut[] }) {
  if (items.length === 0) return null;
  return (
    <section className="section region-standouts" aria-labelledby="standouts-heading">
      <div className="section-head">
        <h2 id="standouts-heading">Where {name} stands out</h2>
        <span className="section-sub">ranked against {peers}</span>
      </div>
      {GROUPS.map((group) => {
        const rows = items.filter((item) => item.group === group.key);
        if (rows.length === 0) return null;
        return <StandOutRow key={group.key} group={group.key} title={group.title} sub={group.sub} items={rows} />;
      })}
      <p className="table-note">
        By change, rank 1 is the largest rise, or the smallest where lower is better; by value,
        the highest, or the lowest where lower is better.
      </p>
    </section>
  );
}
