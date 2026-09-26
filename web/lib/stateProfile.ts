import type { Headline, PacketLevel } from "@/lib/api";
import { definitionOf } from "@/lib/definitions";
import { formatChange, formatMetric } from "@/lib/format";
import { periodLabel } from "@/lib/periods";
import type { ProfileItem } from "@/lib/verdict";

/** Each index's baseline: the quarter it was set to 100. */
const INDEX_BASES: Record<string, string> = {
  fhfa_hpi: "1991 Q1",
  fhfa_hpi_all_transactions: "1980 Q1",
};

/**
 * Presentation only: retain each published level and date, without inventing state ranks.
 *
 * An index leads with its change over the same five years every other figure on the page
 * is read over, and carries its level beneath as a multiple of its baseline — "442.7,
 * about 4.4× its 1991 Q1 level" (Milestone 28) — because 442.7 alone says nothing a
 * reader can use: the Director Note of 2026-09-19 found it communicated neither scale
 * nor baseline at a glance.
 */
export function stateProfile(
  levels: Pick<PacketLevel, "metric_id" | "label" | "unit" | "value" | "period_end">[],
  changes: Pick<Headline, "metric_id" | "pct_change">[] = [],
): ProfileItem[] {
  return levels.filter((level) => !["pep_population", "acs_population"].includes(level.metric_id)).map((level) => {
    const definition = definitionOf(level.metric_id);
    const base = INDEX_BASES[level.metric_id];
    const when = periodLabel(level.period_end, level.metric_id);
    const index = formatMetric(level.value, level.unit, level.metric_id);
    const change = base ? changes.find((c) => c.metric_id === level.metric_id) : undefined;
    const multiple = base ? `about ${(level.value / 100).toFixed(1)}× its ${base} level` : null;
    return {
      metric_id: level.metric_id,
      label: level.label,
      value: change ? formatChange(change.pct_change) : index,
      definition: definition ? `${definition.what} ${definition.why}` : level.label,
      context: {
        words: change
          ? `over five years to ${when} · ${index}, ${multiple}`
          : [when, base ? `${index}, ${multiple}` : null].filter(Boolean).join(" · "),
        rank: null,
      },
    };
  });
}
