"use client";

import { Definition } from "@/components/Definition";
import { definitionOf } from "@/lib/definitions";

/**
 * A metric's name with its plain definition attached (Milestone 23, `lib/definitions.ts`).
 * `scope` keeps the id unique where one metric appears in two tables on a page. A metric
 * the dictionary does not know renders as its plain label — and fails the definitions
 * test, so it cannot ship that way unnoticed.
 *
 * A client component for its weight, not for any behaviour. It still renders on the
 * server, so every definition is in the page's markup and opens with no script. What
 * changes is the payload Next embeds beside the markup and writes out three more times for
 * client-side navigation: a server component's output goes into it whole — a definition's
 * text for every place a metric is named, 52 of them on Mercer County's page — where a
 * client component's goes in as its props, a metric id and a label. The text comes from
 * the dictionary in the shared script instead, fetched once for the whole site
 * (ARCHITECTURE #161).
 */
export function MetricTerm({
  metricId,
  label,
  scope,
  up = false,
}: {
  metricId: string;
  label: string;
  scope: string;
  up?: boolean;
}) {
  const definition = definitionOf(metricId);
  if (!definition) return <>{label}</>;
  return (
    <Definition
      term={{ key: `${scope}-${metricId}`, title: label, definition: definition.what, why: definition.why, phrases: [] }}
      up={up}
    >
      {label}
    </Definition>
  );
}
