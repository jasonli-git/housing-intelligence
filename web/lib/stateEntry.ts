import type { LevelReading } from "./api";
import { monthLabel, periodLabel, surveyYears } from "./periods";

/** Deliberate overview choices: never substitute an index for a purchase price. */
export function stateOverviewFigures(levels: LevelReading[]) {
  const find = (id: string) => levels.find((level) => level.metric_id === id);
  return {
    price: find("sr1a_median_sale_price_12m"),
    added: find("nj_net_units_added"),
    certified: find("nj_certificates_reporting_share"),
    demolished: find("nj_demolitions_reporting_share"),
  };
}

/** Sales windows and pooled surveys must not look like readings on one date. */
export function stateFigurePeriod(level: Pick<LevelReading, "metric_id" | "period_start" | "period_end">) {
  if (level.metric_id.startsWith("sr1a_")) {
    return `${monthLabel(level.period_start)}–${monthLabel(level.period_end)}`;
  }
  if (level.metric_id.startsWith("acs_")) return surveyYears(level.period_start, level.period_end);
  return periodLabel(level.period_end, level.metric_id);
}
