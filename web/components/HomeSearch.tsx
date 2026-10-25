"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PlaceSearch } from "./PlaceSearch";

/** Keep the homepage's search shortcut independent of the optional coverage map. */
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
      <p>Try <Link href="/nj/princeton">Princeton</Link> or <Link href="/nj/mercer-county">Mercer County</Link>.</p>
      <span className="home-search-shortcut" aria-hidden="true">Press <kbd>/</kbd> to search</span>
    </div>
  </div>;
}
