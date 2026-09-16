import { MetricTerm } from "@/components/MetricTerm";
import type { StandOut, StandOutGroup } from "@/lib/standouts";

const GROUPS: { key: StandOutGroup; title: string; sub: string }[] = [
  { key: "leads", title: "Leading", sub: "by change over five years" },
  { key: "lags", title: "Lagging", sub: "by change over five years" },
  { key: "value", title: "Highest and lowest", sub: "by current value" },
];

/**
 * "Where … stands out" (Milestone 23): the stand-outs as cards, grouped into what leads,
 * what lags and what is highest or lowest — each with its rank, the measure, the figure
 * it stands out on and the readings behind it (`lib/standouts.ts`). On a region page they
 * come before the tables, which open beneath them (layout B); the report prints the same
 * cards. Absent where nothing stands out.
 */
export function StandOuts({ name, peers, items }: { name: string; peers: string; items: StandOut[] }) {
  if (items.length === 0) return null;
  return (
    <section className="section" aria-labelledby="standouts-heading">
      <div className="section-head">
        <h2 id="standouts-heading">Where {name} stands out</h2>
        <span className="section-sub">ranked against {peers}</span>
      </div>
      {GROUPS.map((group) => {
        const rows = items.filter((item) => item.group === group.key);
        if (rows.length === 0) return null;
        return (
          <div key={group.key} className="standout-group">
            <h3 className="standout-group-label">
              {group.title} <span>{group.sub}</span>
            </h3>
            <ul className="standouts" data-group={group.key}>
              {rows.map((item) => (
                <li key={item.metric_id} className="standout">
                  <span className="standout-rank">{item.rank}</span>
                  <span className="standout-what">
                    <MetricTerm metricId={item.metric_id} label={item.label} scope={`standout-${group.key}`} />
                  </span>
                  <span className="standout-figure">{item.figure}</span>
                  {item.detail && <span className="standout-detail">{item.detail}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="table-note">
        By change, rank 1 is the largest rise, or the smallest where lower is better; by value,
        the highest, or the lowest where lower is better.
      </p>
    </section>
  );
}
