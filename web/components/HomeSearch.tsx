"use client";

import { useEffect, useRef } from "react";
import { PlaceSearch } from "./PlaceSearch";

/** Keep the homepage's search shortcut independent of map exploration. */
export function HomeSearch() {
  const search = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      search.current?.querySelector("input")?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return <div className="home-search" ref={search}>
    <PlaceSearch variant="hero" />
    <div className="home-search-hints">
      <span className="home-search-shortcut" aria-hidden="true">Press <kbd>/</kbd> to search</span>
    </div>
  </div>;
}
