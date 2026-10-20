import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

import { Term } from "@/components/Term";
import { withTerms } from "@/lib/glossary";

/**
 * `children` with each plain-text part split at its glossary words, the first use of
 * each word in the block marked. `defined` is created by the caller on every render, so
 * a render that runs twice (React does in development) marks the same words both times.
 */
function marked(children: ReactNode, defined: Set<string>): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return withTerms(child, defined).map((segment, index) =>
        segment.term ? (
          <Term key={index} entry={{ title: segment.term.title, what: segment.term.definition, why: segment.term.why, kind: segment.term.kind }}>
            {segment.text}
          </Term>
        ) : (
          segment.text
        ),
      );
    }
    // Into fragments, which only group text; never into elements, so a link or a label
    // with its own markup is left as it is.
    if (isValidElement(child) && child.type === Fragment) {
      return <>{marked((child as ReactElement<{ children?: ReactNode }>).props.children, defined)}</>;
    }
    return child;
  });
}

/**
 * Glossary words marked in mixed content — words, figures and links together — where
 * `Glossed`, which takes one string, cannot reach (#392). Its plain-text children, and
 * those of fragments among them, are marked: the first use of each word in this block.
 * Elements pass through as they are, so a link is never given a term inside it.
 */
export function Gloss({ children }: { children: ReactNode }) {
  return <>{marked(children, new Set<string>())}</>;
}
