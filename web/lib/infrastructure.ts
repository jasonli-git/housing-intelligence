import type { ElectricUtility, PfasSamples, WaterSystem } from "./api";

/** Only bundled residential sales buy both electricity and delivery. EIA's thousand
 * dollars / MWh converts directly to dollars/kWh; no further factor of 1,000. */
export function bundledPrice(utility: ElectricUtility) {
  const sales = utility.sales.filter((s) => s.service_type === "Bundled");
  if (!sales.length || sales.some((s) => s.revenue_thousand === null || s.mwh === null ||
      !Number.isFinite(s.revenue_thousand) || !Number.isFinite(s.mwh) || s.mwh <= 0 || s.revenue_thousand < 0)) return null;
  const mwh = sales.reduce((sum, s) => sum + s.mwh!, 0);
  return { dollarsPerKwh: sales.reduce((sum, s) => sum + s.revenue_thousand!, 0) / mwh,
    imputed: sales.some((s) => s.data_type !== "O") };
}

export function resolutionText(s: WaterSystem): string {
  if (s.violations === 0) return "No health-based violations in this window";
  if (s.resolved_violations === null || s.resolved_violations === undefined) return "Resolution data not loaded";
  return `${s.resolved_violations} of ${s.violations} have a reported return to compliance`;
}

export function pfasResult(s: PfasSamples): string {
  if (s.detections === 0) {
    const lo = s.minimum_reporting_limit_ng_l, hi = s.maximum_reporting_limit_ng_l;
    return `Below reporting limit (${lo === hi ? lo : `${lo}–${hi}`} ng/L); not zero`;
  }
  return s.maximum_ng_l === null ? "Result unavailable" : `Highest reported: ${s.maximum_ng_l.toLocaleString("en-US", { maximumFractionDigits: 2 })} ng/L`;
}

/** Publisher-supplied inventory links are data, never executable URL schemes. */
export function publisherUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
