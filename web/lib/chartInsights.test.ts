import { describe, expect, it } from "vitest";

import { clusterRanks, indexedComparison } from "@/lib/chartInsights";

describe("indexedComparison", () => {
  const series = [
    { metricId: "home", label: "home values", points: [
      { date: "2019-01-31", value: 80 },
      { date: "2019-12-31", value: 100 },
      { date: "2024-12-31", value: 150 },
      { date: "2026-08-31", value: 175 },
    ] },
    { metricId: "rent", label: "rent", points: [
      { date: "2019-12-31", value: 2_000 },
      { date: "2024-12-31", value: 2_500 },
      { date: "2026-08-31", value: 2_800 },
    ] },
    { metricId: "income", label: "income", points: [
      { date: "2019-12-31", value: 60_000 },
      { date: "2024-12-31", value: 72_000 },
    ] },
  ];

  it("uses each series' last reading in a shared baseline year and never extends it", () => {
    const result = indexedComparison(series);
    expect(result?.baselineYear).toBe(2019);
    expect(result?.lines.map((line) => line.points[0].index)).toEqual([100, 100, 100]);
    expect(result?.lines[0].baseline.date).toBe("2019-12-31");
    expect(result?.lines.map((line) => line.points.at(-1)?.date)).toEqual([
      "2026-08-31", "2026-08-31", "2024-12-31",
    ]);
    expect(result?.lines.map((line) => line.points.at(-1)?.index)).toEqual([175, 140, 120]);
    expect(series[0].points).toHaveLength(4);
  });

  it("declines a comparison with no honest shared baseline", () => {
    expect(indexedComparison([
      { metricId: "a", label: "a", points: [{ date: "2019-12-31", value: 1 }, { date: "2020-12-31", value: 2 }] },
      { metricId: "b", label: "b", points: [{ date: "2021-12-31", value: 1 }, { date: "2022-12-31", value: 2 }] },
      { metricId: "c", label: "c", points: [{ date: "2023-12-31", value: 1 }, { date: "2024-12-31", value: 2 }] },
    ])).toBeNull();
  });

  it("does not relabel a two-series view as a cost-versus-income comparison", () => {
    expect(indexedComparison(series.slice(0, 2))).toBeNull();
  });
});

describe("clusterRanks", () => {
  const row = (metric_id: string, rank: number, of = 21) =>
    ({ metric_id, label: metric_id, rank, of, direction: "higher_is_better" });

  it("combines indistinguishable marks without losing their separate exact ranks", () => {
    const clusters = clusterRanks([row("a", 2), row("b", 2), row("c", 3)], 474);
    expect(clusters.map((cluster) => cluster.rows.map((item) => item.metric_id))).toEqual([
      ["a", "b"], ["c"],
    ]);
    expect(clusters[0].position).toBeCloseTo(0.05);
  });

  it("uses plotted position rather than raw rank when cohorts differ", () => {
    const clusters = clusterRanks([row("a", 11, 21), row("b", 10, 19)], 474);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].rows).toHaveLength(2);
  });
});
