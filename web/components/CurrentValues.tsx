import { Fragment } from "react";

import { Margin, Marks, NoteRows, RankCell } from "@/components/Ledger";
import { MetricTerm } from "@/components/MetricTerm";
import { ReportProblem } from "@/components/ReportProblem";
import type { Packet, PacketLevel } from "@/lib/api";
import type { TablePlacement } from "@/lib/caveats";
import { formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { periodLabel } from "@/lib/periods";
import { RANK_HEADING, rankBasis } from "@/lib/ranks";
import { marginLabel, type Peers, type Uncertainties } from "@/lib/uncertainty";

/**
 * Every metric's latest reading, ranked by value rather than by change.
 *
 * Sectioned like the ledger and set as small tables that flow into two columns on a wide
 * screen, so twenty-odd readings take half the height one long table did. A metric with
 * one vintage — the MOD-IV assessment aggregates, HUD's CHAS tables — appears only here,
 * because a change needs two observations. Every measure's name carries its plain
 * definition (Milestone 23).
 *
 * `defined` is kept for the page's one-set-per-page glossary contract; the metric names
 * carry their own definitions rather than glossary terms.
 */
export function CurrentValues({
  levels,
  placement,
  regionLabel,
  sources,
  path,
  uncertainties,
  peers,
}: {
  levels: PacketLevel[];
  placement: TablePlacement;
  defined?: Set<string>;
  regionLabel?: string;
  sources?: Packet["sources"];
  path?: string;
  /** Margins and rank ranges from the summary (Milestone 28). */
  uncertainties?: Uncertainties;
  peers?: Peers;
}) {
  return (
    <div className="values-grid">
      {groupRows(levels).map((section) => (
        <table key={section.key} className="values">
          <thead>
            {/* The section's name heads the measures column, as in the ledger. */}
            <tr className="colheads">
              <th scope="col">{section.title}</th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col">{RANK_HEADING.value}</th>
              <th scope="col">As of</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((level) => {
              const notes = placement.inline.get(level.metric_id);
              return (
                <Fragment key={level.metric_id}>
                  <tr>
                    <td>
                      <MetricTerm metricId={level.metric_id} label={level.label} scope="values" />
                      <Marks letters={placement.marks.get(level.metric_id)} />
                      {regionLabel && sources && path && (
                        <ReportProblem
                          regionLabel={regionLabel}
                          metricLabel={level.label}
                          displayValue={formatMetric(level.value, level.unit, level.metric_id)}
                          periodLabel={periodLabel(level.period_end, level.metric_id)}
                          sourceId={level.source_id}
                          releaseId={level.release_id}
                          sources={sources}
                          path={path}
                        />
                      )}
                    </td>
                    <td className="num">
                      {formatMetric(level.value, level.unit, level.metric_id)}
                      <Margin
                        label={marginLabel(
                          level.value,
                          uncertainties?.value.get(level.metric_id)?.margin ?? null,
                          level.unit,
                          level.metric_id,
                        )}
                      />
                    </td>
                    <td className="rank">
                      {level.rank === null || level.of === null ? (
                        "—"
                      ) : (
                        <RankCell
                          rank={level.rank}
                          of={level.of}
                          basis={rankBasis("value", level.direction)}
                          uncertainty={uncertainties?.value.get(level.metric_id)}
                          peers={peers}
                        />
                      )}
                    </td>
                    <td className="period">{periodLabel(level.period_end, level.metric_id)}</td>
                  </tr>
                  <NoteRows id={level.metric_id} texts={notes} span={4} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}
