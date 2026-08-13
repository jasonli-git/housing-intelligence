/**
 * Pure value formatting, importable from server *and* client components.
 *
 * Separate from `lib/api.ts` on purpose: that module holds the fetch layer and the API
 * base URL, which belong on the server only. Functions cannot be passed across the RSC
 * boundary as props, so a client chart imports its formatter rather than receiving one.
 */

export function formatValue(value: number, unit: string): string {
  if (unit === "usd" || unit === "usd_month") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "count") return Math.round(value).toLocaleString();
  // A year is a label, not a quantity: "1,955" is wrong.
  if (unit === "year") return String(Math.round(value));
  if (unit === "acres") return `${value.toFixed(2)} ac`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatChange(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
