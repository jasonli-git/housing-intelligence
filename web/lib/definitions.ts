/**
 * What every metric means, in plain words, and why a reader should care (Milestone 23).
 *
 * The owner's rule: as succinct and plain as possible, so a beginner can follow, each
 * ending with why it matters. `config/metrics.yml` keeps its own descriptions, which are
 * written for maintainers ("ACS 5-year table B19013"); these are the reader's. Presentation,
 * so they live with the pages, like the section names in `groups.ts` — and a test checks
 * every metric a page can show has one, so a new metric fails to build a page silently
 * undefined rather than shipping without a definition.
 */

import { TERMS_BY_ID } from "@/lib/terms";

export type MetricDefinition = {
  /** What the figure is, in a sentence or two. */
  what: string;
  /** Why it matters to someone deciding where to live. */
  why: string;
};

// A view of `lib/terms.ts`, which holds every definition since 2026-10-19 (#387): the
// entries that are metrics (no `title`), as `{ what, why }`.
export const DEFINITIONS: Record<string, MetricDefinition> = Object.fromEntries(
  Object.entries(TERMS_BY_ID)
    .filter(([, entry]) => entry.title === undefined)
    .map(([id, entry]) => [id, { what: entry.what, ...(entry.why !== undefined ? { why: entry.why } : {}) } as MetricDefinition]),
);

/** A metric's definition, or null for one the dictionary does not know yet. */
export function definitionOf(metricId: string): MetricDefinition | null {
  return DEFINITIONS[metricId] ?? null;
}
