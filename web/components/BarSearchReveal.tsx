"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The bar's search on a page that has its own large one (the home page): hidden while
 * that search is on screen, shown once the reader scrolls past it. Without script it
 * stays hidden, and the page's own search is still there.
 */
export function BarSearchReveal({ target, children }: { target: string; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = document.querySelector(target);
    if (!el) { setShown(true); return; }
    const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  return <div className="bar-search-reveal" data-shown={shown || undefined}>{children}</div>;
}
