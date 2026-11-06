"use client";

import { type ReactNode, useRef, useState, useSyncExternalStore } from "react";

import styles from "./FlipCard.module.css";

/** Below this width the card is a row that opens in place rather than a card that turns. */
const COMPACT = "(max-width: 560px)";

function useCompact(): boolean {
  // Where there is no `matchMedia` (a test's DOM), the card behaves as on a wide screen.
  const supported = () => typeof window.matchMedia === "function";
  return useSyncExternalStore(
    (change) => { if (!supported()) return () => {}; const query = window.matchMedia(COMPACT); query.addEventListener("change", change); return () => query.removeEventListener("change", change); },
    () => supported() && window.matchMedia(COMPACT).matches,
    () => false,
  );
}

/**
 * A two-sided card: the takeaway on the front, its figures on the back.
 *
 * Turned by a button, never by hover, so it works by touch and keyboard alike. The front
 * sets the card's height; the back takes its own room only while it shows, so a grid of
 * these is as short as its fronts. The face turned away is `inert`, and focus follows the
 * turn. With reduced motion asked for, the turn is a crossfade.
 *
 * On a phone the card is a single row instead (tone, headline, figure), and tapping it
 * opens the figures beneath, an expander rather than a turn: one card a row has no
 * neighbour for a turned card to keep in line with.
 */
export function FlipCard({ className, front, back }: { className?: string; front: ReactNode; back: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  const compact = useCompact();
  const toBack = useRef<HTMLButtonElement>(null);
  const toFront = useRef<HTMLButtonElement>(null);
  const turn = (to: boolean) => {
    setFlipped(to);
    if (compact) return;
    // After React drops `inert` from the face turning toward the reader.
    requestAnimationFrame(() => (to ? toFront : toBack).current?.focus({ preventScroll: true }));
  };
  return (
    <article className={`${styles.card} ${className ?? ""}`} data-flipped={flipped || undefined}>
      <div className={`${styles.face} ${styles.front} flip-front`} inert={!compact && flipped}>
        {front}
        <button ref={toBack} type="button" className={styles.turn} aria-expanded={compact ? flipped : undefined}
          onClick={() => turn(compact ? !flipped : true)}>
          {compact ? <span className="visually-hidden">{flipped ? "Hide the figures" : "Show the figures"}</span>
            : <>See the figures <span aria-hidden="true">→</span></>}
        </button>
      </div>
      <div className={`${styles.face} ${styles.back}`} inert={!flipped}>
        {back}
        {!compact && <button ref={toFront} type="button" className={styles.turn} onClick={() => turn(false)}>
          <span aria-hidden="true">←</span> Back to the takeaway
        </button>}
      </div>
    </article>
  );
}
