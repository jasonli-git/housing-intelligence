/**
 * Somewhere like here, but cheaper (Milestone 46, ARCHITECTURE #317): how the page lays
 * out a town beside its matches. The figures come in the order the API lists them —
 * measures matched on, then the price, the commute, and what else a buyer compares —
 * and are grouped here so the page can say which ones made the match.
 */

import type { SimilarFigure, SimilarPlaces } from "@/lib/api";

export type SimilarRow = {
  metric_id: string;
  label: string;
  unit: string;
  /** One value per column: the town first, then its matches. */
  values: (number | null)[];
};

export type SimilarGroup = { key: "matched" | "price" | "also"; title: string; rows: SimilarRow[] };

export function similarGroups(data: SimilarPlaces): SimilarGroup[] {
  const places = [data.here, ...data.matches];
  const row = (id: string): SimilarRow | null => {
    const first: SimilarFigure | undefined = data.here.figures.find((f) => f.metric_id === id);
    if (!first) return null;
    return {
      metric_id: id,
      label: first.label,
      unit: first.unit,
      values: places.map((p) => p.figures.find((f) => f.metric_id === id)?.value ?? null),
    };
  };
  const rows = (ids: string[]) => ids.map(row).filter((r): r is SimilarRow => r !== null);
  return [
    { key: "matched", title: "Matched on", rows: rows(data.measures) },
    { key: "price", title: "Price", rows: rows([data.price, ...data.context.filter((m) => m === "zhvi_sfr")]) },
    {
      key: "also",
      title: "Also compare",
      rows: rows([data.commute, ...data.context.filter((m) => m !== "zhvi_sfr")]),
    },
  ];
}

/** "January 2024 to June 2026": the sale price's window, which is not a calendar year. */
export function priceWindow(data: SimilarPlaces): string | null {
  if (!data.price_from || !data.price_to) return null;
  const month = (iso: string) => {
    const date = new Date(`${iso}T00:00:00Z`);
    return `${date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${date.getUTCFullYear()}`;
  };
  return `${month(data.price_from)} to ${month(data.price_to)}`;
}
