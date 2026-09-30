"use client";

import { type ReactNode, useEffect, useRef } from "react";

// One key for every region page: a reader who wants the tables on one page wants them on the next.
const KEY = "housing:region-more";

/**
 * The data expander on a region page (Milestone 23, layout B): tables and trends behind
 * one click, under the answers a reader came for. The automated data summary has its own
 * disclosure beside it, so neither is buried inside the other.
 *
 * Closed by default and remembered once opened — in the reader's own browser, never sent
 * anywhere — so a data-minded reader finds it open on the next page, and closing it is
 * remembered too. A native <details>, so it opens with no script, from the keyboard, and for
 * find-in-page; the page is rendered closed and opened after load, because a static page
 * cannot know its reader. Print opens it (globals.css).
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

export function AnalystReadingJump({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      className="button report-action analyst-jump-action print-hide"
      onClick={() => openAndScroll(targetId)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.5 3.5h11v13h-11zM7 7h6M7 10h6M7 13h4" />
      </svg>
      <span className="report-action-copy">
        <strong>Read data summary</strong>
        <small>Automated · model-written</small>
      </span>
      <span className="report-action-arrow" aria-hidden="true">↓</span>
    </button>
  );
}

export function MoreExpander({ id, title, sub, children }: { id?: string; title: string; sub: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "open" && ref.current) ref.current.open = true;
    } catch {
      // Storage refused — a private window, blocked site data: it opens closed.
    }
  }, []);

  return (
    <details
      id={id}
      ref={ref}
      className="more"
      onToggle={(event) => {
        try {
          window.localStorage.setItem(KEY, event.currentTarget.open ? "open" : "closed");
        } catch {
          // As above: nothing to remember with.
        }
      }}
    >
      <summary>
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
