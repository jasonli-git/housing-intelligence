"use client";

import { type ReactNode, useEffect, useRef } from "react";

// One key for every region page: a reader who wants the tables on one page wants them on the next.
const KEY = "housing:region-more";

/**
 * The one expander on a region page (Milestone 23, layout B): every table, the trends and
 * the full interpretation behind one click, under the answers a reader came for.
 *
 * Closed by default and remembered once opened — in the reader's own browser, never sent
 * anywhere — so a data-minded reader finds it open on the next page, and closing it is
 * remembered too. A native <details>, so it opens with no script, from the keyboard, and for
 * find-in-page; the page is rendered closed and opened after load, because a static page
 * cannot know its reader. Print opens it (globals.css).
 */
export function MoreExpander({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
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
        <span>
          <span className="more-title">{title}</span>
          <span className="more-sub">{sub}</span>
        </span>
        <span className="more-chev" aria-hidden="true" />
      </summary>
      <div className="more-body">{children}</div>
    </details>
  );
}
