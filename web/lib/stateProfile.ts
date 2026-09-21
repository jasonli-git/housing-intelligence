import type { PacketLevel } from "@/lib/api";
import { definitionOf } from "@/lib/definitions";
import { formatMetric } from "@/lib/format";
import { periodLabel } from "@/lib/periods";
import type { ProfileItem } from "@/lib/verdict";

/** Presentation only: retain each published level and date, without inventing state ranks. */
export function stateProfile(levels: Pick<PacketLevel, "metric_id" | "label" | "unit" | "value" | "period_end">[]): ProfileItem[] {
  return levels.filter((level) => !["pep_population", "acs_population"].includes(level.metric_id)).map((level) => {
    const definition = definitionOf(level.metric_id);
    const base = level.metric_id === "fhfa_hpi" ? "1991 Q1 = 100"
      : level.metric_id === "fhfa_hpi_all_transactions" ? "1980 Q1 = 100" : null;
    return {
      metric_id: level.metric_id,
      label: level.label,
      value: formatMetric(level.value, level.unit, level.metric_id),
      definition: definition ? `${definition.what} ${definition.why}` : level.label,
      context: [periodLabel(level.period_end, level.metric_id), base].filter(Boolean).join(" · "),
    };
  });
}
