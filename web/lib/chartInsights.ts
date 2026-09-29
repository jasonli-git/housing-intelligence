import { rankPosition } from "@/lib/ranks";

export type IndexedInput = {
  metricId: string;
  label: string;
  points: { date: string; value: number }[];
};

export type IndexedLine = Omit<IndexedInput, "points"> & {
  baseline: { date: string; value: number };
  points: { date: string; value: number; index: number }[];
};

/** Compare unlike units as movement from each series' last reading in one shared year. */
export function indexedComparison(series: IndexedInput[]): { baselineYear: number; lines: IndexedLine[] } | null {
  // This view makes one specific three-way claim; a two-line version could quietly turn
  // "costs vs income" into "one housing series vs another" on a sparse region page.
  if (series.length !== 3) return null;
  const cleaned = series.map((s) => ({
    ...s,
    points: s.points
      .filter((p) => Number.isFinite(p.value) && p.value > 0 && Number.isFinite(Date.parse(p.date)))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));
  if (cleaned.some((s) => s.points.length < 2)) return null;

  const latestSharedYear = Math.min(...cleaned.map((s) => Number(s.points.at(-1)!.date.slice(0, 4))));
  const candidateYears = [...new Set(cleaned.flatMap((s) => s.points.map((p) => Number(p.date.slice(0, 4)))))]
    .filter((year) => year >= latestSharedYear - 5 && year < latestSharedYear)
    .sort((a, b) => a - b);
  const baselineYear = candidateYears.find((year) =>
    cleaned.every((s) => s.points.some((p) => Number(p.date.slice(0, 4)) === year)),
  );
  if (baselineYear === undefined) return null;

  const lines = cleaned.map((s) => {
    const baseline = s.points.filter((p) => Number(p.date.slice(0, 4)) === baselineYear).at(-1)!;
    return {
      ...s,
      baseline,
      points: s.points
        .filter((p) => p.date >= baseline.date)
        .map((p) => ({ ...p, index: (p.value / baseline.value) * 100 })),
    };
  });
  return { baselineYear, lines };
}

export type ClusterRank = { metric_id: string; label: string; rank: number; of: number; direction: string };
export type RankCluster = { position: number; rows: ClusterRank[] };

/** Combine marks that would be indistinguishable on a rank plot's pixel scale. */
export function clusterRanks(rows: ClusterRank[], plotWidth: number, thresholdPx = 17): RankCluster[] {
  const ordered = rows
    .map((row) => ({ row, position: rankPosition(row.rank, row.of) }))
    .sort((a, b) => a.position - b.position || a.row.label.localeCompare(b.row.label));
  const clusters: RankCluster[] = [];
  for (const item of ordered) {
    const previous = clusters.at(-1);
    if (previous && (item.position - rankPosition(previous.rows[0].rank, previous.rows[0].of)) * plotWidth < thresholdPx) {
      previous.rows.push(item.row);
      previous.position = previous.rows.reduce((sum, row) => sum + rankPosition(row.rank, row.of), 0) / previous.rows.length;
    } else {
      clusters.push({ position: item.position, rows: [item.row] });
    }
  }
  return clusters;
}
