import type { PacketLevel } from "@/lib/api";
import { surveyYears } from "@/lib/periods";
import { marginLabel, type Uncertainties } from "@/lib/uncertainty";

export type MosaicGroup = { label: string; share: number; margin: string; note: string };
export type MosaicView = {
  id: string; label: string; denominator: string; period: string; source: string;
  groups: MosaicGroup[];
};

/** Largest-remainder apportionment: exactly 100 tiles, never 100 invented records. */
export function mosaicCounts(shares: number[]): number[] {
  if (!shares.length || shares.some(s => !Number.isFinite(s) || s < 0 || s > 1)
    || Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > 0.000001) return [];
  const counts = shares.map(s => Math.floor(s * 100));
  const order = shares.map((s, i) => ({ i, remainder: s * 100 - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const left = 100 - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left; i++) counts[order[i].i]++;
  return counts;
}

/** Independent ACS distributions only; never combine their cells into joint claims. */
export function housingMosaicViews(levels: PacketLevel[], uncertainty?: Uncertainties): MosaicView[] {
  const views: MosaicView[] = [];
  const find = (id: string) => levels.find(l => l.metric_id === id && l.source_id === "census_acs" && l.unit === "ratio"
    && Number.isFinite(l.value) && l.value >= 0 && l.value <= 1);
  const margin = (row: PacketLevel) => marginLabel(row.value,
    uncertainty?.value.has(row.metric_id) ? uncertainty.value.get(row.metric_id)!.margin : row.margin_of_error ?? null,
    row.unit, row.metric_id) ?? "no margin available";
  function binary(id: string, label: string, metric: string, denominator: string,
    labels: [string, string], notes: [string, string]) {
    const row = find(metric);
    if (!row) return;
    const complement = { ...row, value: 1 - row.value };
    views.push({ id, label, denominator, period: surveyYears(row.period_start, row.period_end),
      source: row.source_id ?? "Census ACS", groups: [
        { label: labels[0], share: row.value, margin: margin(row), note: notes[0] },
        { label: labels[1], share: complement.value, margin: margin(complement), note: notes[1] },
      ] });
  }
  binary("tenure", "Owned / rented", "acs_homeownership_rate", "Occupied homes",
    ["Owner-occupied", "Renter-occupied"],
    ["Homes lived in by their owners.", "Homes lived in by renters—not vacant rentals."]);
  binary("occupancy", "Occupied / empty", "acs_vacancy_rate", "All homes",
    ["Empty", "Occupied"],
    ["Includes seasonal homes and homes for sale or rent. Empty does not mean available.", "Homes with residents, whether owned or rented."]);
  const ageSpecs = [
    ["acs_share_built_pre_1940", "Before 1940"],
    ["acs_share_built_1940_1979", "1940–1979"],
    ["acs_share_built_1980_1999", "1980–1999"],
    ["acs_share_built_2000_later", "2000 or later"],
  ];
  const ages = ageSpecs.map(([id]) => find(id));
  const first = ages[0];
  // Missing categories or mixed vintages cannot form a complete age distribution.
  if (first && ages.every((r): r is PacketLevel => !!r && r.source_id === first.source_id
    && r.release_id === first.release_id && r.period_start === first.period_start && r.period_end === first.period_end)
    && mosaicCounts(ages.map(r => r.value)).length) {
    views.push({ id: "age", label: "Housing age", denominator: "All homes",
      period: surveyYears(first.period_start, first.period_end), source: first.source_id ?? "Census ACS",
      groups: ages.map((row, i) => ({ label: ageSpecs[i][1], share: row.value,
        margin: margin(row), note: "When homes were built, not their current condition." })) });
  }
  return views;
}
