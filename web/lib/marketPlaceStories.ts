import type { PlaceStoryRecord, PlaceStorySummary } from "./placeStories";
import { constructionYears } from "./construction";
import { formatValue } from "./format";
import { monthLabel } from "./periods";
import { againstUsual } from "./persistence";

const missing: PlaceStorySummary = { available: false, headline: "Local records unavailable", period: "No matching period", source: "Coverage limited", qualifier: "Missing records are not zero. No other place has been substituted.", rows: [] };
export const PRESSURE_BANDS = ["Up to 30%", "Over 30–50%", "Over 50–80%", "Over 80–100%", "Over 100%"];
export function marketStorySummary(record: PlaceStoryRecord): PlaceStorySummary | null {
  if (record.topic === "past") {
    const county = record.countyHistory, data = county?.data;
    const unavailable = { ...missing, headline: "County history unavailable", qualifier: "No supported county history for this selection. A town-level series has not been substituted." };
    if (!county || !data || data.withheld || data.vs_median === null || !Number.isFinite(data.vs_median) || !Array.isArray(data.series) || data.series.length < 10 || data.series.some(p => !Number.isFinite(p.year) || !Number.isFinite(p.vs_median))) return { ...unavailable, qualifier: data?.withheld ? `Comparison withheld: ${data.withheld}` : unavailable.qualifier };
    const uncertainty = data.vs_median_low !== null && data.vs_median_high !== null ? ` Income uncertainty puts it between ${againstUsual(data.vs_median_low)} and ${againstUsual(data.vs_median_high)} the usual level.` : "";
    return { available: true, headline: `${county.name}: prices against income ${againstUsual(data.vs_median)} its usual level`, source: "FHFA / Census SAIPE · County context", period: `${data.last_year} · History ${data.first_year}–${data.last_year}`,
      qualifier: `${county.name} history, not town-level price pressure. Calculated from a price index and annual income; usual means the median of the observed years. Missing years are omitted. Historical comparison—not a forecast.${uncertainty}`, rows: [] };
  }
  const row = (id: string) => record.levels.find(l => l.metric_id === id && Number.isFinite(l.value));
  const same = (a: NonNullable<ReturnType<typeof row>>, b: NonNullable<ReturnType<typeof row>>) => a.period_start === b.period_start && a.period_end === b.period_end;
  if (record.topic === "sales") {
    const median = row("sr1a_median_sale_price"), count = row("sr1a_sales_count");
    if (!median || !count || median.value <= 0 || count.value <= 0 || !same(median, count)) return missing;
    const values = [["sr1a_price_lower_quartile", "Lower quartile"], ["sr1a_median_sale_price", "Median sale price"], ["sr1a_price_upper_quartile", "Upper quartile"]];
    return { available: true, headline: `${formatValue(median.value, "usd")} median recorded sale`, source: "NJ Treasury · SR1A", period: `${monthLabel(median.period_start)}–${monthLabel(median.period_end)}`,
      qualifier: `${formatValue(count.value, "count")} usable one- to four-family sales, not all homes. Changes in which homes sell can move the median; this is not a current asking price.`,
      rows: values.flatMap(([id, label]) => { const l = row(id); return l && l.value > 0 && same(median, l) ? [{ label, value: l.value, formatted: formatValue(l.value, "usd") }] : []; }) };
  }
  if (record.topic === "lending") {
    const anchor = row("hmda_purchase_loans"), loan = row("hmda_median_loan_amount");
    if (!anchor || !loan || loan.value <= 0 || !same(anchor, loan)) return missing;
    const estimated = anchor.match_method === "tract_homes";
    return { available: true, headline: `${formatValue(loan.value, "usd")} median purchase mortgage`, source: "CFPB · HMDA", period: anchor.period_end.slice(0, 4),
      qualifier: `${estimated ? "Estimated from census tracts, not town-level loan records. " : ""}Historical home-purchase loans, not current offers, cash purchases or your chance of approval.`,
      rows: [["hmda_conventional_share", "Conventional"], ["hmda_fha_share", "FHA"], ["hmda_va_share", "VA"]].flatMap(([id, label]) => { const l = row(id); return l && same(anchor, l) && l.value >= 0 && l.value <= 1 ? [{ label, value: l.value, formatted: `${(l.value * 100).toFixed(1)}%` }] : []; }) };
  }
  if (record.topic === "building") {
    const series = (metric: string) => record.history.find(s => s.metricId === metric)?.observations ?? [];
    const years = constructionYears({ permitted: series("permits_total_units"), completed: series("nj_units_certified"), demolished: series("nj_units_demolished"), net: series("nj_net_units_added") });
    // Show the newest reporting year even if incomplete; never quietly roll back to
    // an older, fuller year or fill a missing demolition report with zero.
    const last = years[0];
    if (!last || last.completed === null || last.demolished === null || !Number.isFinite(last.completed) || !Number.isFinite(last.demolished) || last.completed < 0 || last.demolished < 0) return missing;
    const net = last.completed - last.demolished;
    return { available: true, headline: `${formatValue(Math.abs(net), "count")} net homes ${net < 0 ? "removed" : "added"}`, source: "Census BPS / NJ DCA", period: `${last.year}${last.preliminary ? " · Preliminary" : ""}`,
      qualifier: `${last.preliminary ? "Preliminary reporting year. " : ""}Reported completions minus demolitions; missing reports are not zero. Permits are permission, not finished homes or a completion rate.`,
      rows: [{ label: "Completed", value: last.completed, formatted: formatValue(last.completed, "count") }, { label: "Demolished", value: last.demolished, formatted: formatValue(last.demolished, "count") }] };
  }
  if (record.topic === "pressure") {
    const pressure = record.pressure;
    if (!pressure || pressure.region_id !== record.place.region_id) return missing;
    const bands = pressure.bands.filter(b => b.tenure === "renter").sort((a,b) => a.band-b.band);
    const shown = bands.filter(b => b.band >= 0 && b.band < 5 && b.share !== null && Number.isFinite(b.share) && b.share >= 0 && b.share <= 1 && b.total > 0);
    if (!shown.length || new Set(bands.map(b => b.band)).size !== bands.length) return missing;
    const lead = shown[0];
    return { available: true, headline: `${Math.round(lead.share! * 100)}% of renters in the ${lead.band === 0 ? "lowest" : PRESSURE_BANDS[lead.band].toLowerCase()} income band are cost-burdened`, source: "HUD CHAS · Census ACS", period: pressure.period,
      qualifier: `Bars: renters spending over 30% of income on housing, within each HUD area family-income band. Uncomputed costs remain in the denominator. Survey estimates with 90% margins; not eligibility limits or a prediction for your household.`,
      rows: shown.map(b => ({ label: `${PRESSURE_BANDS[b.band]} of HUD area family income`, value: b.share!, formatted: `${Math.round(b.share! * 100)}%`, aside: `${b.total.toLocaleString("en-US")} households${b.unknown ? ` · ${b.unknown} uncomputed` : ""}${b.margin !== null ? ` · 90% margin ±${(b.margin*100).toFixed(1)} points` : " · margin unavailable"}` })) };
  }
  if (record.topic === "migration") {
    const moves = record.migration;
    if (!moves || moves.region_id !== record.place.region_id) return missing;
    const last = moves.years.at(-1);
    if (!last || last.inflow_returns === null || last.outflow_returns === null || !Number.isFinite(last.inflow_returns) || !Number.isFinite(last.outflow_returns) || last.inflow_returns < 0 || last.outflow_returns < 0) return missing;
    const net = last.inflow_returns-last.outflow_returns;
    const county = `${moves.county_name.replace(/ County$/, "")} County`;
    return { available: true, headline: `${county}: ${formatValue(Math.abs(net), "count")} more tax returns ${net < 0 ? "leaving" : "arriving"}`, source: "IRS migration · County context", period: `${last.year-1}–${last.year}`,
      qualifier: `${county} county-to-county moves, not town-level migration. Tax returns approximate households, not people; unfiled returns and within-county moves are outside this count.`,
      rows: [{ label: "Arriving tax returns", value: last.inflow_returns, formatted: formatValue(last.inflow_returns,"count") }, { label: "Leaving tax returns", value: last.outflow_returns, formatted: formatValue(last.outflow_returns,"count") }] };
  }
  return null;
}

export function placeStoryPreviewNote(record: PlaceStoryRecord): string {
  if (!marketStorySummary(record)?.available && !["market", "commute", "water"].includes(record.topic)) return "Coverage limited · no substitute data.";
  switch (record.topic) {
    case "past": return "County history—not a town-level comparison.";
    case "sales": return "Recorded 1–4-family sales—not asking prices.";
    case "pressure": {
      const first = record.pressure?.bands.filter(b => b.tenure === "renter" && b.share !== null && b.total > 0).sort((a,b) => a.band-b.band)[0];
      return first ? `${PRESSURE_BANDS[first.band]} of HUD area family income · survey estimate.` : "HUD income bands · records unavailable.";
    }
    case "lending": return record.levels.some(l => l.match_method === "tract_homes") ? "Tract-based estimate · historical loans." : "Historical loans—not current offers.";
    case "building": return marketStorySummary(record)?.period.includes("Preliminary") ? "Preliminary · missing reports are not zero." : "Reported building—not all approved projects.";
    case "migration": return "County context—not town-level moves.";
    case "market": return "Survey values—not current asking prices.";
    case "commute": return "One-way mean—not your route.";
    case "water": return "System history—not today’s tap water.";
  }
}
