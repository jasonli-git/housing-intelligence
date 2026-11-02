import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";

import { Glossed } from "@/components/Glossed";
import { withTerms } from "@/lib/glossary";

const SKIPPED = new Set<unknown>(["a", "button", "summary", "label", "svg", "option", "script", "style", Link]);

/**
 * A poster's JSX with the first use of each glossary word defined (#389, #392). The posters
 * write their figures as plain captions throughout, so this walks the page in reading order
 * rather than wrapping every one. Words rendered inside a component's own output stay that
 * component's to mark; `scripts/check-terms.mjs` is what proves a page has none left.
 */
export function glossTree(node: ReactNode, defined = new Set<string>()): ReactNode {
  if (typeof node === "string") {
    const before = new Set(defined);
    return withTerms(node, defined).some((segment) => segment.term) ? <Glossed text={node} defined={before} /> : node;
  }
  if (Array.isArray(node)) return node.map((child, index) => <Fragment key={index}>{glossTree(child, defined)}</Fragment>);
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (SKIPPED.has(element.type) || element.props.children === undefined) return element;
  return cloneElement(element, undefined, ...Children.toArray(element.props.children).map((child) => glossTree(child, defined)));
}
