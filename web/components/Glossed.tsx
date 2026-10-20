import { Term } from "@/components/Term";
import { withTerms } from "@/lib/glossary";

/**
 * `text` with every glossary term in it defined where it appears: the first use of each
 * word in this paragraph, note or card, and plain text after (#392). A reader who jumps
 * straight to a section finds its words explained there, without every repeat
 * underlined. Pass a shared `defined` set to mark a word once across several texts (a
 * table's notes). `scripts/check-terms.mjs`, run before every deploy, fails a page whose
 * first use of a glossary word is unmarked (#389).
 *
 * Each term renders through `Term`, the one way the site attaches a definition (#388).
 */
export function Glossed({ text, defined }: { text: string; defined?: Set<string> }) {
  // A fresh set unless the caller shares one: marking adds to the set, and a render that
  // runs twice (React does in development) must find the same words unmarked both times.
  return (
    <>
      {withTerms(text, defined ?? new Set()).map((segment, index) =>
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
