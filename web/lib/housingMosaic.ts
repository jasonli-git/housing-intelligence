import type { PacketLevel } from "@/lib/api";
import { surveyYears } from "@/lib/periods";
import { marginLabel, type Uncertainties } from "@/lib/uncertainty";

export type MosaicGroup = { label: string; share: number; margin: string | null; note: string };
export type MosaicView = {
  id: string; label: string; denominator: string; period: string; source: string;
  groups: MosaicGroup[];
  evidence?: string;
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

/** State records describe new completions and issued loans, not the entire housing stock. */
export function statewideMosaicViews(levels: PacketLevel[], preliminaryYears: number[] = []): MosaicView[] {
  const views: MosaicView[] = [];
  const find = (id: string, source: string, unit: string) => levels.find(r => r.metric_id === id
    && r.source_id === source && r.unit === unit && Number.isFinite(r.value) && r.value >= 0
    && (unit !== "count" || Number.isInteger(r.value))
    && (unit !== "ratio" || r.value <= 1));
  const matches = (r: PacketLevel | undefined, total: PacketLevel): r is PacketLevel => !!r
    && r.source_id === total.source_id && r.release_id === total.release_id
    && r.period_start === total.period_start && r.period_end === total.period_end;
  const total = find("nj_units_certified", "nj_construction", "count");
  const categories = [
    ["nj_units_certified_1_2", "Houses & two-family", "New homes in one- or two-family buildings. Tiles represent homes, not buildings."],
    ["nj_units_certified_multi", "Multifamily", "New homes in buildings with three or more homes, counted separately from mixed-use buildings."],
    ["nj_units_certified_mixed", "Mixed-use", "New homes in buildings that also contain shops or offices."],
  ];
  const rows = categories.map(([id]) => find(id, "nj_construction", "count"));
  if (total && total.value > 0 && rows.every((r): r is PacketLevel => matches(r, total))
    && rows.reduce((sum, r) => sum + r.value, 0) === total.value) {
    const year = total.period_end.slice(0, 4);
    const preliminary = preliminaryYears.includes(Number(year)) ? " Preliminary figures." : "";
    views.push({ id: "new-homes", label: "New homes", denominator: `${total.value.toLocaleString("en-US")} reported new homes finished`,
      period: year, source: "nj_construction", evidence: `NJ DCA construction records · ${year}. Reporting towns only.${preliminary}`,
      groups: rows.map((r, i) => ({ label: categories[i][1], share: r.value / total.value, margin: null, note: categories[i][2] })) });
  }
  const loans = find("hmda_purchase_loans", "ffiec_hmda", "count");
  const loanSpecs = [
    ["hmda_conventional_share", "Conventional", "Home-purchase mortgages not insured or guaranteed by a government programme."],
    ["hmda_fha_share", "FHA", "Home-purchase mortgages insured by the Federal Housing Administration."],
    ["hmda_va_share", "VA", "Home-purchase mortgages guaranteed by the Department of Veterans Affairs."],
  ];
  const shares = loanSpecs.map(([id]) => find(id, "ffiec_hmda", "ratio"));
  if (loans && loans.value > 0 && shares.every((r): r is PacketLevel => matches(r, loans))) {
    const sum = shares.reduce((s, r) => s + r.value, 0);
    // Other is the explicit remainder of an exhaustive loan-type classification.
    // Reject incompatible distributions rather than rescale them to fit.
    if (sum <= 1) {
      const year = loans.period_end.slice(0, 4);
      views.push({ id: "purchase-loans", label: "Purchase loans", denominator: `${loans.value.toLocaleString("en-US")} reported home-purchase loans`,
        period: year, source: "ffiec_hmda", evidence: `HMDA lender records · ${year}. Owner-occupied purchases; cash buyers and non-reporting lenders are excluded.`,
        groups: [...shares.map((r, i) => ({ label: loanSpecs[i][1], share: r.value, margin: null, note: loanSpecs[i][2] })),
          { label: "Other", share: 1 - sum, margin: null, note: "Other reported loan types, outside conventional, FHA and VA." }] });
    }
  }
  return views;
}
