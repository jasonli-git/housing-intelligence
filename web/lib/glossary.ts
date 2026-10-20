/**
 * The inline glossary: terms defined where they appear rather than on a page of their
 * own (Milestone 18).
 *
 * Kept to the words a reader meets on these pages and cannot be expected to know. The
 * metric labels were rewritten into plain English at Milestone 21, so what is left is
 * the vocabulary of the sources themselves — survey and program names, and HUD's
 * standards. Definitions are the reader's, not the pipeline's: what a figure measures,
 * not how it was loaded.
 */

import { TERMS_BY_ID } from "@/lib/terms";

export type Term = {
  key: string;
  title: string;
  definition: string;
  /** Why it matters, set on its own line under the definition (Milestone 23). */
  why?: string;
  /** For a metric, what kind of figure it is (SPEC principle 11, Milestone 31). */
  kind?: string;
  /** Exact, case-sensitive phrases that mark the term in running text. */
  phrases: string[];
};

// A view of `lib/terms.ts` since 2026-10-19 (#387): the entries marked by phrases.
export const TERMS: readonly Term[] = Object.entries(TERMS_BY_ID).flatMap(([key, entry]) =>
  entry.phrases?.length
    ? [{
        key,
        title: entry.title ?? key,
        phrases: entry.phrases,
        definition: entry.what,
        ...(entry.why !== undefined ? { why: entry.why } : {}),
        ...(entry.kind !== undefined ? { kind: entry.kind } : {}),
      }]
    : [],
);

export type Segment = { text: string; term?: Term };

function escape(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MATCHERS = TERMS.flatMap((term) =>
  term.phrases.map((phrase) => ({ term, pattern: new RegExp(`\\b${escape(phrase)}\\b`) })),
);

/**
 * `text` split at the terms in it, so a component can render each as a definition.
 *
 * `defined` carries the keys already defined on this page: a term is marked the first
 * time it appears and read as plain text after that, because an underline on every "ACS"
 * in a table is noise rather than help. Pass one set per page and let this fill it.
 */
export function withTerms(text: string, defined: Set<string> = new Set()): Segment[] {
  let earliest: { term: Term; index: number; length: number } | null = null;
  for (const { term, pattern } of MATCHERS) {
    if (defined.has(term.key)) continue;
    const match = pattern.exec(text);
    if (match && (earliest === null || match.index < earliest.index)) {
      earliest = { term, index: match.index, length: match[0].length };
    }
  }
  if (earliest === null) return text ? [{ text }] : [];

  defined.add(earliest.term.key);
  const before = text.slice(0, earliest.index);
  const matched = text.slice(earliest.index, earliest.index + earliest.length);
  const after = text.slice(earliest.index + earliest.length);
  return [
    ...(before ? [{ text: before }] : []),
    { text: matched, term: earliest.term },
    ...withTerms(after, defined),
  ];
}
