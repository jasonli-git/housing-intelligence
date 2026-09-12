import { Fragment } from "react";

import { Glossed } from "@/components/Glossed";
import type { PacketMetric } from "@/lib/api";
import type { TablePlacement } from "@/lib/caveats";
import { formatChange, formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { windowLabel } from "@/lib/periods";

// A 3px tick and a 1px gap, so 21 counties draw as 21 ticks.
const TICK = 4;
// Above this many peers a tick apiece stops reading as a count and starts costing: at
// 564 municipalities it was 564 elements a row, and the static export tripled. A track
// with the region's place marked says the same thing at any cohort size.
const MAX_TICKS = 30;
const TRACK = 84;

/**
 * Where a figure sits among its peers. The ticks or the track are the element's
 * background, so it is one marker and one box whatever the cohort; position and width
 * are data, which is why they are inline.
 */
export function RankStrip({ rank, of }: { rank: number; of: number }) {
  const ticks = of <= MAX_TICKS;
  const width = ticks ? of * TICK - 1 : TRACK;
  const left = ticks
    ? (rank - 1) * TICK
    : of > 1
      ? Math.round(((rank - 1) / (of - 1)) * (TRACK - 3))
      : 0;
  return (
    <>
      <span className={`strip ${ticks ? "ticks" : "track"}`} style={{ width }} aria-hidden="true">
        <i style={{ left }} />
      </span>
      <span className="rank-n">
        {rank} / {of}
      </span>
    </>
  );
}

/** A signed change, its arrow first so the direction reads before the number does. */
export function ChangeCell({ pct, className }: { pct: number; className?: string }) {
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "";
  return (
    <td className={["change", direction, className].filter(Boolean).join(" ")}>
      {pct !== 0 && (
        <span className="arrow" aria-hidden="true">
          {pct > 0 ? "▲" : "▼"}
        </span>
      )}
      {formatChange(pct)}
    </td>
  );
}

/** The note letters a row carries. */
export function Marks({ letters }: { letters: string[] | undefined }) {
  return (
    <>
      {(letters ?? []).map((letter) => (
        <sup key={letter} className="mk" title={`See note ${letter}`}>
          {letter}
        </sup>
      ))}
    </>
  );
}

/** A caveat that qualifies one row only, set directly under it. */
export function NoteRows({ id, texts, span }: { id: string; texts: string[] | undefined; span: number }) {
  return (
    <>
      {(texts ?? []).map((text, index) => (
        <tr key={`${id}-note-${index}`} className="note">
          <td colSpan={span}>
            <p className="row-note">
              <span className="note-tag">Note</span>
              {text}
            </p>
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * The notes set out under a table: the lettered caveats first marked in it, a pointer to
 * any whose text sits under an earlier table, then caveats about the figures as a whole.
 */
export function TableNotes({
  placement,
  general = [],
  above,
}: {
  placement: TablePlacement;
  general?: string[];
  above: string;
}) {
  const { notes, earlier } = placement;
  if (notes.length === 0 && earlier.length === 0 && general.length === 0) return null;
  return (
    <ol className="notes" aria-label="Notes to these figures">
      {notes.map((note) => (
        <li key={note.letter}>
          <b>{note.letter}</b>
          <span>{note.text}</span>
        </li>
      ))}
      {earlier.length > 0 && (
        <li>
          <b aria-hidden="true" />
          <span>
            {earlier.length === 1 ? `Note ${earlier[0]} is` : `Notes ${earlier.join(", ")} are`} under{" "}
            {above}.
          </span>
        </li>
      )}
      {general.map((text, index) => (
        <li key={`general-${index}`}>
          <b aria-hidden="true">·</b>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A region's changes in one table: each figure's latest value, its change, where that
 * change ranks, and the period it covers, sectioned the same way on every region page.
 * A caveat about one row sits under that row; one about several is lettered.
 */
export function Ledger({
  metrics,
  placement,
  defined,
}: {
  metrics: PacketMetric[];
  placement: TablePlacement;
  defined: Set<string>;
}) {
  return (
    <div className="scroll-x">
      <table className="ledger">
        <caption className="eyebrow">Latest · change over five years · rank · period</caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Latest</th>
            <th scope="col">Change</th>
            <th scope="col">Rank by change</th>
            <th scope="col">Period</th>
          </tr>
        </thead>
        {groupRows(metrics).map((section) => (
          <tbody key={section.key}>
            <tr className="group">
              <th colSpan={5} scope="colgroup">
                {section.title}
              </th>
            </tr>
            {section.rows.map((metric) => {
              const notes = placement.inline.get(metric.metric_id);
              return (
                <Fragment key={metric.metric_id}>
                  <tr className={notes ? "has-note" : undefined}>
                    <td>
                      <Glossed text={metric.label} defined={defined} />
                      <Marks letters={placement.marks.get(metric.metric_id)} />
                    </td>
                    <td className="value">
                      {formatMetric(metric.end_value, metric.unit, metric.metric_id)}
                    </td>
                    <ChangeCell pct={metric.pct_change} />
                    <td className="rank">
                      {metric.rank !== null && metric.of !== null ? (
                        <RankStrip rank={metric.rank} of={metric.of} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="period">
                      {metric.source_id === "census_acs" && (
                        <>
                          <Glossed text="ACS" defined={defined} />{" "}
                        </>
                      )}
                      {windowLabel(metric.window_start, metric.window_end, metric.metric_id)}
                    </td>
                  </tr>
                  <NoteRows id={metric.metric_id} texts={notes} span={5} />
                </Fragment>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
