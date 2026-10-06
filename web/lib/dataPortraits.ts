import type { Observation } from "./api";
import type { ConstructionYear } from "./construction";

export function vacancyPair(rows: Observation[]) {
  const valid = rows.filter(r => Number.isFinite(r.value) && r.value >= 0 && r.value <= 1)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const latest = valid.at(-1);
  if (!latest) return null;
  const earlier = valid.find(r => Number(r.period_end.slice(0, 4)) === Number(latest.period_end.slice(0, 4)) - 5);
  return earlier && earlier.source_id === latest.source_id ? { earlier, latest } : null;
}

export function connectedStock(row: ConstructionYear) {
  return row.completed !== null && row.demolished !== null && row.net !== null &&
    Number.isFinite(row.completed) && Number.isFinite(row.demolished) && Number.isFinite(row.net) &&
    row.completed >= 0 && row.demolished >= 0 && row.completed - row.demolished === row.net;
}

export type CostSlice = { key: string; label: string; value: number; color: string };
export function costSlices(parts: CostSlice[], principal: number) {
  return [...parts, { key: "principal", label: "Principal · pays down your loan", value: principal, color: "var(--good)" }]
    .filter(p => Number.isFinite(p.value) && p.value > 0);
}
