import type { ReactNode } from "react";

import { definitionOf } from "@/lib/definitions";
import { type Term, withTerms } from "@/lib/glossary";

/**
 * A term with its definition attached: shown on hover and on focus, with no script.
 *
 * A focusable span, so it is reachable by keyboard and a tap focuses it on a phone; the
 * definition is a tooltip the term is described by, so a screen reader announces it
 * after the term. Not a button: a button is an atomic box, so a term inside a label
 * that wraps — "Home value index, single-family" on a phone — broke onto a line of its
 * own, centred, with the rest of the label below it. A span flows with the words around
 * it. The id is the term's key, unique on a page because `withTerms` defines each term
 * once per page.
 *
 * Since Milestone 23 a term can say why it matters, on a line of its own under the
 * definition, and can open upward: a row at the foot of a scrolling table would otherwise
 * drop its definition past the table's box, where the scroll box cuts it off.
 */
export function Definition({ term, children, up = false }: { term: Term; children: ReactNode; up?: boolean }) {
  const id = `term-${term.key}`;
  return (
    <span className="gl">
      <span className="term" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span role="tooltip" id={id} className={up ? "tip up" : "tip"}>
        <strong>{term.title}.</strong> {term.definition}
        {term.why && (
          <span className="tip-why">
            <b>Why it matters:</b> {term.why}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * A metric's name with its plain definition attached (Milestone 23, `lib/definitions.ts`).
 * `scope` keeps the id unique where one metric appears in two tables on a page. A metric
 * the dictionary does not know renders as its plain label — and fails the definitions
 * test, so it cannot ship that way unnoticed.
 */
export function MetricTerm({
  metricId,
  label,
  scope,
  up = false,
}: {
  metricId: string;
  label: string;
  scope: string;
  up?: boolean;
}) {
  const definition = definitionOf(metricId);
  if (!definition) return <>{label}</>;
  return (
    <Definition
      term={{ key: `${scope}-${metricId}`, title: label, definition: definition.what, why: definition.why, phrases: [] }}
      up={up}
    >
      {label}
    </Definition>
  );
}

/**
 * `text` with every glossary term in it defined where it appears. Pass one `defined`
 * set per page, so each term is marked the first time and read plainly after.
 */
export function Glossed({ text, defined }: { text: string; defined: Set<string> }) {
  return (
    <>
      {withTerms(text, defined).map((segment, index) =>
        segment.term ? (
          <Definition key={index} term={segment.term}>
            {segment.text}
          </Definition>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
