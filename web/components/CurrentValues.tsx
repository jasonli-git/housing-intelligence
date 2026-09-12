import { Fragment } from "react";

import { Glossed } from "@/components/Glossed";
import { Marks, NoteRows } from "@/components/Ledger";
import type { PacketLevel } from "@/lib/api";
import type { TablePlacement } from "@/lib/caveats";
import { formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { periodLabel } from "@/lib/periods";

/**
 * Every metric's latest reading, ranked by value rather than by change.
 *
 * Sectioned like the ledger and set as small tables that flow into two columns on a wide
 * screen, so twenty-odd readings take half the height one long table did. A metric with
 * one vintage — the MOD-IV assessment aggregates, HUD's CHAS tables — appears only here,
 * because a change needs two observations.
 */
export function CurrentValues({
  levels,
  placement,
  defined,
}: {
  levels: PacketLevel[];
  placement: TablePlacement;
  defined: Set<string>;
}) {
  return (
    <div className="values-grid">
      {groupRows(levels).map((section) => (
        <table key={section.key} className="values">
          <caption className="eyebrow">{section.title}</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col" className="num">
                Rank
              </th>
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
                      <Glossed text={level.label} defined={defined} />
                      <Marks letters={placement.marks.get(level.metric_id)} />
                    </td>
                    <td className="num">{formatMetric(level.value, level.unit, level.metric_id)}</td>
                    <td className="num">
                      {level.rank === null ? "—" : `${level.rank} / ${level.of}`}
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
