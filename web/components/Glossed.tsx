import { cache } from "react";

import { Term } from "@/components/Term";
import { withTerms } from "@/lib/glossary";

/**
 * `text` with every glossary term in it defined where it appears. Pass one `defined`
 * set per page, so each term is marked the first time and read plainly after; without
 * one, a server render shares one set per page (React's `cache`), and a client component
 * marks each term the first time it appears in its own text. `scripts/check-terms.mjs`
 * fails a page where a glossary word's first use is unmarked (#389).
 *
 * Each term renders through `Term`, the one way the site attaches a definition (#388).
 */
/** One set per server render, so a word is marked once per page; per call on the client. */
const pageTerms = cache(() => new Set<string>());

export function Glossed({ text, defined = pageTerms() }: { text: string; defined?: Set<string> }) {
  return (
    <>
      {withTerms(text, defined).map((segment, index) =>
        segment.term ? (
          <Term key={index} entry={{ title: segment.term.title, what: segment.term.definition, why: segment.term.why, kind: segment.term.kind }}>
            {segment.text}
          </Term>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
