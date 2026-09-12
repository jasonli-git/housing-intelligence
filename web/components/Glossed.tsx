import type { ReactNode } from "react";

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
 */
export function Definition({ term, children }: { term: Term; children: ReactNode }) {
  const id = `term-${term.key}`;
  return (
    <span className="gl">
      <span className="term" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span role="tooltip" id={id} className="tip">
        <strong>{term.title}.</strong> {term.definition}
      </span>
    </span>
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
