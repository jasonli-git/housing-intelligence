"use client";
import { useEffect } from "react";

/**
 * (#496) `/afford` now opens the housing map with the budget on, carrying the
 * old address's income, view, price, county and place so every existing link still lands.
 */
export function AffordRedirect() {
  useEffect(() => {
    const from = new URLSearchParams(window.location.search);
    const rent = from.get("mode") === "rent" || (!from.has("mode") && from.get("for") === "rent");
    const zillow = from.get("price") === "zillow";
    const to = new URLSearchParams({ level: "municipality", measure: rent ? "zori_all" : zillow ? "zhvi_sfr" : "sr1a_median_sale_price", view: "latest", budget: "1" });
    for (const key of ["income", "mode", "for", "price", "county", "place"]) { const v = from.get(key); if (v) to.set(key, v); }
    window.location.replace(`/atlas?${to}`);
  }, []);
  return <p className="meta">Opening the Budget explorer on the housing map… <a href="/atlas?budget=1">Go now</a></p>;
}
