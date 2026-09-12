/**
 * A period in the terms its source publishes in.
 *
 * Dates arrive from the API as ISO strings, and four conventions cover every source
 * loaded: HUD's Fair Market Rents run by federal fiscal year (a window ending
 * 2026-09-30 is FY2026), FHFA's indexes by calendar quarter, an annual series ends on 31
 * December and is named by its year, and a monthly series — Zillow's indexes — by
 * month. A period is a label, so nothing here does date arithmetic or builds a `Date`,
 * which would shift a 31 December into the next year in any timezone east of UTC.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** One endpoint of a period, e.g. "2023", "Jul 2026", "FY2026", "Q2 2026". */
export function periodLabel(date: string, metricId?: string): string {
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7));
  if (metricId?.startsWith("hud_fmr")) return `FY${year}`;
  if (metricId?.startsWith("fhfa_")) return `Q${Math.ceil(month / 3)} ${year}`;
  if (date.slice(5, 10) === "12-31") return year;
  return `${MONTHS[month - 1]} ${year}`;
}

/** A change window, e.g. "2019 → 2023" or "Jul 2021 → Jul 2026". */
export function windowLabel(start: string, end: string, metricId?: string): string {
  return `${periodLabel(start, metricId)} → ${periodLabel(end, metricId)}`;
}

/**
 * The survey years behind an ACS five-year estimate, e.g. "2019–2023".
 *
 * An estimate for "2023" pools five years of sample, so a reader who sees only the end
 * year takes it for a count on a date. The observation's own start and end say which.
 */
export function surveyYears(periodStart: string, periodEnd: string): string {
  return `${periodStart.slice(0, 4)}–${periodEnd.slice(0, 4)}`;
}
