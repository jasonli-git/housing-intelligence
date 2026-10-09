"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { AbstractField } from "./AbstractField";

// Where the open state was remembered until 2026-10-09 (#357). Cleared on load, so a
// returning reader's browser stops holding it too.
const RETIRED_KEY = "housing:region-more";

/**
 * The data expander on a region page (Milestone 23, layout B): tables and trends behind
 * one click, under the answers a reader came for. The automated data summary has its own
 * disclosure beside it, so neither is buried inside the other.
 *
 * Closed on every page and not remembered: the owner chose on 2026-10-09 that the site
 * keeps nothing about how a reader browses, only what they type into its tools (#357). A
 * native <details>, so it opens with no script, from the keyboard, and for find-in-page;
 * a link to `#housing-assistance` opens it. Print opens it (globals.css).
 */
function openAndScroll(targetId: string) {
  const details = document.getElementById(targetId);
  if (!(details instanceof HTMLDetailsElement)) return;
  details.open = true;
  const summary = details.querySelector("summary");
  summary?.focus({ preventScroll: true });
  details.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    block: "start",
  });
}

export function DetailedDataJump({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      className="button report-action data-jump-action"
      onClick={() => openAndScroll(targetId)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3.5 4.5h13v11h-13zM3.5 8h13M8 8v7.5M12.5 8v7.5" />
      </svg>
      <span className="report-action-copy">
        <strong>Explore data &amp; tables</strong>
        <small>On this page</small>
      </span>
      <span className="report-action-arrow" aria-hidden="true">↓</span>
    </button>
  );
}

export function MoreExpander({ id, title, sub, children }: { id?: string; title: string; sub: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    try {
      window.localStorage.removeItem(RETIRED_KEY);
    } catch {
      // Storage refused — a private window, blocked site data: there is nothing held.
    }
    if (window.location.hash === "#housing-assistance" && ref.current?.querySelector("#housing-assistance")) {
      ref.current.open = true;
      requestAnimationFrame(() => document.getElementById("housing-assistance")?.scrollIntoView({block: "start"}));
    }
  }, []);

  return (
    <details
      id={id}
      ref={ref}
      suppressHydrationWarning
      className="more"
    >
      <summary>
        <AbstractField kind="evidence" />
        <span className="more-kicker">Explore the evidence</span>
        <span className="more-entry">
          <span className="more-index" aria-hidden="true">↳</span>
          <span className="more-copy">
            <span className="more-title">{title}</span>
            <span className="more-sub">{sub}</span>
          </span>
          <span className="more-open" aria-hidden="true">
            <span className="more-open-label"><span className="when-closed">Open</span><span className="when-open">Close</span></span>
            <span className="more-open-icon">+</span>
          </span>
        </span>
      </summary>
      <div className="more-body">{children}</div>
    </details>
  );
}
