/**
 * What financing buyers here used (Milestone 48, ARCHITECTURE #324-#325), read from the
 * packet's newest HMDA year. The rules the section reads by:
 *
 * - What borrowers got, never what a reader would be offered: rates are last year's.
 * - A town's or ZIP's figures are estimated from its census tracts by their homes; the
 *   section says so where `match_method` is `tract_homes`.
 * - A denial rate is not a measure of who could qualify: HMDA has no credit scores.
 */

import type { PacketLevel } from "@/lib/api";

export type Lending = {
  year: number;
  estimated: boolean;
  loans: number | null;
  rate: number | null;
  loan: number | null;
  ltv: number | null;
  costs: number | null;
  income: number | null;
  conventional: number | null;
  fha: number | null;
  va: number | null;
  denial: number | null;
  reasons: { label: string; share: number }[];
};

export function lending(levels: PacketLevel[]): Lending | null {
  const row = (id: string) => levels.find((l) => l.metric_id === id) ?? null;
  const value = (id: string) => row(id)?.value ?? null;
  const anchor = row("hmda_purchase_loans") ?? row("hmda_denial_rate");
  if (!anchor) return null;
  const candidates: [string, number | null][] = [
    ["debt-to-income", value("hmda_denial_dti_share")],
    ["the home's appraised value", value("hmda_denial_value_share")],
    ["credit history", value("hmda_denial_credit_share")],
  ];
  const reasons = candidates
    .flatMap(([label, share]) => (share !== null && share > 0 ? [{ label, share }] : []))
    .sort((a, b) => b.share - a.share);
  return {
    year: Number(anchor.period_end.slice(0, 4)),
    estimated: anchor.match_method === "tract_homes",
    loans: value("hmda_purchase_loans"),
    rate: value("hmda_median_rate"),
    loan: value("hmda_median_loan_amount"),
    ltv: value("hmda_median_ltv"),
    costs: value("hmda_median_loan_costs"),
    income: value("hmda_median_income"),
    conventional: value("hmda_conventional_share"),
    fha: value("hmda_fha_share"),
    va: value("hmda_va_share"),
    denial: value("hmda_denial_rate"),
    reasons,
  };
}
