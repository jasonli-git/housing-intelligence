"use client";

import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { definitionOf } from "@/lib/definitions";

type Position = Pick<CSSProperties, "left" | "top" | "width">;

/**
 * A definition for a metric inside a scrolling card rail. The ordinary adjacent tooltip
 * is intentionally CSS-only, but a scroll container must clip it. Rendering this one in
 * the document layer lets the complete definition sit above the rail without changing
 * definitions on reports or in tables.
 */
export function FloatingMetricTerm({ metricId, label }: { metricId: string; label: string }) {
  const definition = definitionOf(metricId);
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ left: 16, top: 16, width: 288 });

  const place = useCallback(() => {
    const term = anchor.current;
    const tip = tooltip.current;
    if (!term || !tip) return;
    const rect = term.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 32);
    const height = tip.getBoundingClientRect().height;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 16
      ? below
      : Math.max(16, rect.top - height - 8);
    setPosition({ left, top, width });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  if (!definition) return <>{label}</>;

  return (
    <>
      <span className="gl">
        <span
          ref={anchor}
          className="term"
          tabIndex={0}
          aria-describedby={open ? id : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              event.currentTarget.blur();
            }
          }}
        >
          {label}
        </span>
      </span>
      {open && typeof document !== "undefined" && createPortal(
        <span ref={tooltip} role="tooltip" id={id} className="floating-tip" style={position}>
          <strong>{label}.</strong> {definition.what}
          {definition.why && (
            <span className="tip-why">
              <b>Why it matters:</b> {definition.why}
            </span>
          )}
        </span>,
        document.body,
      )}
    </>
  );
}
