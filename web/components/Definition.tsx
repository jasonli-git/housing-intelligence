import type { ReactNode } from "react";

import type { Term } from "@/lib/glossary";
import { FloatingDefinition } from "@/components/FloatingDefinition";

/**
 * A term with its definition attached: shown on hover and on focus, with no script.
 *
 * A focusable span, so it is reachable by keyboard and a tap focuses it on a phone; the
 * definition is a tooltip the term is described by, so a screen reader announces it
 * after the term. Not a button: a button is an atomic box, so a term inside a label
 * that wraps — "Home value index, single-family" on a phone — broke onto a line of its
 * own, centred, with the rest of the label below it. A span flows with the words around
 * it. M43 shares a progressive floating layer with metric labels: the adjacent
 * definition remains in static HTML; hydration adds viewport bounds and Escape.
 *
 * Since Milestone 23 a term can say why it matters, on a line of its own under the
 * definition, and can open upward: a row at the foot of a scrolling table would otherwise
 * drop its definition past the table's box, where the scroll box cuts it off. `up`
 * remains the no-script fallback; the enhanced layer chooses its direction by room.
 * The shared dictionary stays in MetricTerm's client module, not a server import.
 */
export function Definition({ term, children, up = false }: { term: Term; children: ReactNode; up?: boolean }) {
  return (
    <FloatingDefinition label={children} up={up} content={<>
        <strong>{term.title}.</strong> {term.definition}
        {term.kind && (
          <span className="tip-kind">
            <b>Kind of figure:</b> {term.kind}
          </span>
        )}
        {term.why && (
          <span className="tip-why">
            <b>Why it matters:</b> {term.why}
          </span>
        )}
    </>} />
  );
}
