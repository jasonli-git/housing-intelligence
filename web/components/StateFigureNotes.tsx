"use client";

import { useEffect, useRef } from "react";

/** Preserve the footnote's deep link while keeping the caveats closed by default. */
export function StateFigureNotes({ notes }: { notes: string[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash !== "#state-figure-notes" || !ref.current) return;
      ref.current.open = true;
      ref.current.scrollIntoView({block: "start"});
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href="#state-figure-notes"]')) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (ref.current) ref.current.open = true;
      // Also handles clicking the reference again when its hash is already active.
      requestAnimationFrame(reveal);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", click);
    return () => { window.removeEventListener("hashchange", reveal); document.removeEventListener("click", click); };
  }, []);
  return <details ref={ref} id="state-figure-notes" className="state-figure-notes">
    <summary>† About the statewide figures</summary>
    <div>{notes.map((text) => <p key={text}>{text}</p>)}<a href="#state-note-reference">Back to the snapshot ↑</a></div>
  </details>;
}
