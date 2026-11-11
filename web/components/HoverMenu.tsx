"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * MOCK (2026-11-11): a `<details>` menu that also opens while a mouse rests on it. Click and
 * keyboard still toggle it; touch screens, which have no hover, only tap. A short delay on
 * leaving lets the pointer cross the gap between the button and the panel.
 */
export function HoverMenu({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const enter = () => { window.clearTimeout(timer.current); el.open = true; };
    const leave = () => { timer.current = window.setTimeout(() => { if (!el.contains(document.activeElement)) el.open = false; }, 180); };
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); window.clearTimeout(timer.current); };
  }, []);
  return <details ref={ref} className={className}>{children}</details>;
}
