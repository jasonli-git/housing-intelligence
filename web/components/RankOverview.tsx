import type { PacketLevel, PacketMetric } from "@/lib/api";
import { groupRows } from "@/lib/groups";
import { rankPosition } from "@/lib/ranks";

type Rankable = {
  metric_id: string;
  label: string;
  rank: number | null;
  of: number | null;
};

type Ranked = Omit<Rankable, "rank" | "of"> & { rank: number; of: number };

function hasRank(row: Rankable): row is Ranked {
  return row.rank !== null && row.of !== null && row.of > 1;
}

function RankPlot({
  title,
  basis,
  rows,
  peerLabel,
}: {
  title: string;
  basis: string;
  rows: Rankable[];
  peerLabel: string;
}) {
  const sections = groupRows(rows.filter(hasRank));
  if (sections.length === 0) return null;

  const width = 660;
  const left = 164;
  const right = 22;
  const top = 44;
  const rowHeight = 54;
  const height = top + sections.length * rowHeight + 18;
  const plotWidth = width - left - right;

  return (
    <figure className="rank-plot">
      <figcaption>
        <strong>{title}</strong>
        <span>{rows.filter(hasRank).length} ranked measures</span>
      </figcaption>
      <p>{basis}</p>
      <div className="rank-plot-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}. Each dot is one measure, positioned from rank 1 to its cohort’s final rank.`}
        >
          <text className="rank-plot-end" x={left} y={20}>Rank 1</text>
          <text className="rank-plot-end" x={width - right} y={20} textAnchor="end">Last rank</text>
          {sections.map((section, sectionIndex) => {
            const y = top + sectionIndex * rowHeight;
            return (
              <g key={section.key}>
                <text className="rank-plot-label" x={8} y={y + 4}>{section.title}</text>
                <line className="rank-plot-track" x1={left} x2={width - right} y1={y} y2={y} />
                <line className="rank-plot-middle" x1={left + plotWidth / 2} x2={left + plotWidth / 2} y1={y - 13} y2={y + 13} />
                {section.rows.map((row, index) => {
                  const x = left + rankPosition(row.rank, row.of) * plotWidth;
                  const dotY = y + ((index % 5) - 2) * 5;
                  const description = `${row.label}: rank ${row.rank} of ${row.of} ${peerLabel}`;
                  return (
                    <circle
                      key={row.metric_id}
                      className={`rank-plot-dot rank-plot-dot-${section.key}`}
                      cx={x}
                      cy={dotY}
                      r={6}
                      tabIndex={0}
                      aria-label={description}
                    >
                      <title>{description}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

/** Two compact, non-line views of the exact ranks repeated in the tables below. */
export function RankOverview({
  changes,
  values,
  peerLabel,
}: {
  changes: PacketMetric[];
  values: PacketLevel[];
  peerLabel: string;
}) {
  const hasChanges = changes.some(hasRank);
  const hasValues = values.some(hasRank);
  if (!hasChanges && !hasValues) return null;

  return (
    <section className="section rank-overview" aria-labelledby="rank-overview-heading">
      <div className="section-head">
        <h2 id="rank-overview-heading">How this place ranks at a glance</h2>
        <span className="section-sub">the same ranks as the tables below</span>
      </div>
      <p className="rank-overview-intro">
        Each dot is one measure. Its position is normalized to that measure’s reported
        cohort, because coverage can differ: left is rank 1 and right is the final rank.
        Rank 1 follows the measure’s own direction, so it does not always mean “better.”
      </p>
      <div className="rank-plots">
        <RankPlot
          title="Five-year change"
          basis="Where the size of each five-year change ranks."
          rows={changes}
          peerLabel={peerLabel}
        />
        <RankPlot
          title="Current value"
          basis="Where each latest reported value ranks."
          rows={values}
          peerLabel={peerLabel}
        />
      </div>
    </section>
  );
}
