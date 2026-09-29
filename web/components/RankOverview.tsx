import type { PacketLevel, PacketMetric } from "@/lib/api";
import { type ClusterRank } from "@/lib/chartInsights";
import { RankDotPlot } from "@/components/RankDotPlot";
import type { Uncertainties } from "@/lib/uncertainty";

type Rankable = {
  metric_id: string;
  label: string;
  direction: string;
  rank: number | null;
  of: number | null;
};

type Ranked = Omit<Rankable, "rank" | "of"> & { rank: number; of: number };

function hasRank(row: Rankable): row is Ranked {
  return row.rank !== null && row.of !== null && row.of > 1;
}

function rankMarks(rows: Rankable[]): ClusterRank[] {
  return rows.filter(hasRank).map(({ metric_id, label, rank, of, direction }) => ({
    metric_id, label, rank, of, direction,
  }));
}

/** Two compact, non-line views of the exact ranks repeated in the tables below. */
export function RankOverview({
  changes,
  values,
  peerLabel,
  uncertainties,
}: {
  changes: PacketMetric[];
  values: PacketLevel[];
  peerLabel: string;
  uncertainties: Uncertainties;
}) {
  const hasChanges = changes.some(hasRank);
  const hasValues = values.some(hasRank);
  if (!hasChanges && !hasValues) return null;
  const hasRanges = [...uncertainties.value.values(), ...uncertainties.change.values()]
    .some((range) => range.best !== null && range.worst !== null && range.best < range.worst);
  const serializableRanges = (ranges: Uncertainties["value"]) => Object.fromEntries(
    [...ranges].map(([id, range]) => [id, { best: range.best, worst: range.worst }]),
  );

  return (
    <section className="section rank-overview" aria-labelledby="rank-overview-heading">
      <div className="section-head">
        <h2 id="rank-overview-heading">How this place ranks at a glance</h2>
        <span className="section-sub">the same ranks as the tables below</span>
      </div>
      <p className="rank-overview-intro">
        Each plot groups measures by topic. Left is rank 1; right is the last rank in that
        measure’s peer group. A numbered dot holds several nearby measures. Select one
        to see exactly what it ranks and why.
        {hasRanges && " Sampling uncertainty appears only when you inspect a measure."}
      </p>
      <div className="rank-plots">
        <RankDotPlot
          title="Five-year change"
          basis="change"
          rows={rankMarks(changes)}
          peerLabel={peerLabel}
          ranges={serializableRanges(uncertainties.change)}
        />
        <RankDotPlot
          title="Current value"
          basis="value"
          rows={rankMarks(values)}
          peerLabel={peerLabel}
          ranges={serializableRanges(uncertainties.value)}
        />
      </div>
    </section>
  );
}
