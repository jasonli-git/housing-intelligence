import { Definition } from "@/components/Definition";
import { withTerms } from "@/lib/glossary";

/**
 * `text` with every glossary term in it defined where it appears. Pass one `defined`
 * set per page, so each term is marked the first time and read plainly after.
 *
 * `Definition`, which renders each term, and `MetricTerm`, which attaches a metric's
 * definition to its name, have files of their own since the definitions' page-weight trim
 * (ARCHITECTURE #161).
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
