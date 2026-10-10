"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Measure } from "@/lib/measures";
import type { Section } from "@/lib/groups";
import { formatChange, formatMetric } from "@/lib/format";
import { WINDOWS, windowNote, type WindowKey } from "@/lib/windows";
import { rankBasis } from "@/lib/ranks";
import { windowLabel } from "@/lib/periods";
import { mapDefinitionOf } from "@/lib/mapDefinitions";
import { marginLabel, changeMarginLabel, MARGIN_NOTE } from "@/lib/uncertainty";

/** Published county comparisons, independent of map geometry or network requests. */
export function CountyComparison({ sections, initial }: { sections: Section<Measure>[]; initial: string }) {
  const measures = sections.flatMap(section => section.rows);
  const [metric, setMetric] = useState(initial);
  const [window, setWindow] = useState<WindowKey>("5y");
  const id = useId();
  const measure = measures.find(item => item.metric_id === metric) ?? measures[0];
  if (!measure) return <p>No county comparisons are published yet.</p>;
  const key = measure.windows[window] ? window : WINDOWS.find(item => measure.windows[item.key])?.key;
  const reading = key ? measure.windows[key] : null;
  const rows = reading?.rows ?? [];
  return <details id="county-comparison" className="place-comparison">
    <summary><span>Compare counties</span><small>Differences between places, with dates and uncertainty</small><span aria-hidden="true">＋</span></summary>
    <div className="place-comparison-body">
      <div className="place-comparison-controls">
        <label htmlFor={id}>Measure<select id={id} value={measure.metric_id} onChange={event => setMetric(event.target.value)}>
          {sections.map(section => <optgroup key={section.key} label={section.title}>{section.rows.map(item => <option key={item.metric_id} value={item.metric_id}>{item.label}</option>)}</optgroup>)}
        </select></label>
        <label htmlFor={id + "-window"}>Change<select id={id + "-window"} value={key ?? ""} onChange={event => setWindow(event.target.value as WindowKey)}>
          {WINDOWS.map(item => <option key={item.key} value={item.key} disabled={!measure.windows[item.key]}>{item.label}</option>)}
        </select></label>
      </div>
      <p className="meta">{rankBasis("change", measure.direction, key ? WINDOWS.find(item => item.key === key)!.phrase : "")}. {reading?.start && reading.end ? windowLabel(reading.start, reading.end, measure.metric_id) : "Dates not published"}.</p>
      <p className="meta">{mapDefinitionOf(measure.metric_id)}</p>
      <div className="scroll-x" tabIndex={0} role="region" aria-label="County comparison, scroll horizontally">
        <table className="ranks"><thead><tr><th scope="col">County</th><th scope="col">Latest value</th><th scope="col">Change</th><th scope="col">Change rank</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <th scope="row"><Link href={"/regions/" + row.id}>{row.name}</Link></th>
            <td>{row.latest === null ? "Not published" : <>{formatMetric(row.latest, measure.unit, measure.metric_id)}<small>{marginLabel(row.latest, row.latestMargin ?? null, measure.unit, measure.metric_id)}</small></>}</td>
            <td>{formatChange(row.change)}<small>{changeMarginLabel(row.changeMargin ?? null, measure.metric_id)}</small></td>
            <td>{row.best != null && row.worst != null && row.best !== row.worst ? row.best + "–" + row.worst : row.rank} / {row.of}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <p>No county figures for this window.</p>}
      {rows.some(row => row.latestMargin != null || row.changeMargin != null) && <p className="meta">{MARGIN_NOTE}</p>}
      {key && windowNote(key, measure.metric_id, measure.windows).map(note => <p className="meta" key={note}>{note}</p>)}
    </div>
  </details>;
}
