/**
 * The address of the housing map with its budget card on (#496), which replaced the
 * Budget explorer at `/afford`. `place` also selects that place on the map; `county`
 * scopes the budget ("all" for the whole state); `rent` opens the renting view.
 */
export function budgetMapHref(options: { place?: number; county?: number | "all"; rent?: boolean; income?: number } = {}): string {
  const params = new URLSearchParams({ level: "municipality", measure: options.rent ? "zori_all" : "sr1a_median_sale_price", view: "latest", budget: "1" });
  if (options.rent) params.set("mode", "rent");
  if (options.place !== undefined) params.set("place", String(options.place));
  if (options.county !== undefined) params.set("county", String(options.county));
  if (options.income) params.set("income", String(options.income));
  return `/atlas?${params}`;
}
