/** A town and one match, as `GET /regions/{id}/similar-places` gives them (Milestone 46). */
import type { SimilarPlaces } from "@/lib/api";

const fig = (metric_id: string, unit: string, value: number | null) => ({
  metric_id,
  label: metric_id,
  unit,
  period_end: "2026-06-30",
  value,
});

export const sample: SimilarPlaces = {
  region_id: 85,
  measures: ["acs_share_detached", "acs_homeownership_rate"],
  price: "sr1a_median_sale_price",
  commute: "acs_mean_commute_minutes",
  context: ["zhvi_sfr", "nj_effective_tax_rate"],
  min_sales: 20,
  cheaper_by: 0.9,
  commute_minutes: 10,
  price_from: "2024-01-01",
  price_to: "2026-06-30",
  here: {
    region_id: 85,
    name: "Cherry Hill",
    figures: [
      fig("acs_share_detached", "ratio", 0.669),
      fig("acs_homeownership_rate", "ratio", 0.765),
      fig("sr1a_median_sale_price", "usd", 450000),
      fig("acs_mean_commute_minutes", "minutes", 27.5),
      fig("zhvi_sfr", "usd", null),
      fig("nj_effective_tax_rate", "rate_per_100", 2.6),
    ],
  },
  matches: [
    {
      region_id: 610,
      name: "Audubon",
      figures: [
        fig("acs_share_detached", "ratio", 0.711),
        fig("acs_homeownership_rate", "ratio", 0.763),
        fig("sr1a_median_sale_price", "usd", 375000),
        fig("acs_mean_commute_minutes", "minutes", 25.5),
        fig("zhvi_sfr", "usd", 390547),
        fig("nj_effective_tax_rate", "rate_per_100", 2.83),
      ],
    },
  ],
};
