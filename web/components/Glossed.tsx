import { Term } from "@/components/Term";
import { withTerms } from "@/lib/glossary";

/**
 * `text` with every glossary term in it defined where it appears. Pass one `defined`
 * set per page, so each term is marked the first time and read plainly after.
 *
 * Each term renders through `Term`, the one way the site attaches a definition (#388).
 */
export function Glossed({ text, defined }: { text: string; defined: Set<string> }) {
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
