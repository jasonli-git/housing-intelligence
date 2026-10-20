/** Short, plain-language explanations for measures in the New Jersey map selector.
 * The fuller shared definitions remain in tables, profiles, and reports. */

import { definitionOf } from "@/lib/definitions";
import { TERMS_BY_ID } from "@/lib/terms";

// A view of `lib/terms.ts` since 2026-10-19 (#387): each entry's `short`.
export const MAP_DEFINITIONS: Record<string, string> = Object.fromEntries(
  Object.entries(TERMS_BY_ID).flatMap(([id, entry]) => (entry.short ? [[id, entry.short]] : [])),
);

export function mapDefinitionOf(metricId: string): string | null {
  return MAP_DEFINITIONS[metricId] ?? definitionOf(metricId)?.what ?? null;
}
