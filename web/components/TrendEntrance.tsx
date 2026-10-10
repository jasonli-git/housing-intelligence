"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Content remains visible without JS; only decorative linework animates once. */
export function TrendEntrance({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setEntered(true);
        observer.disconnect();
      }
    }, { threshold: .2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="trend-entrance" data-entered={entered}>{children}</div>;
}
