import { Fragment, type ReactNode } from "react";

import { Glossed } from "@/components/Glossed";
import { MetricTerm } from "@/components/MetricTerm";
import { ReportProblem } from "@/components/ReportProblem";
import type { Packet, PacketMetric } from "@/lib/api";
import type { TablePlacement } from "@/lib/caveats";
import { formatChange, formatMetric } from "@/lib/format";
import { groupRows } from "@/lib/groups";
import { windowLabel } from "@/lib/periods";
import { RANK_HEADING, rankBasis, rankPosition } from "@/lib/ranks";
import {
  changeMarginLabel,
  cohortLabel,
  marginLabel,
  type Peers,
  rankReading,
  type Uncertainties,
  type Uncertainty,
} from "@/lib/uncertainty";

// A 3px tick and a 1px gap, so 21 counties draw as 21 ticks.
const TICK = 4;
// Above this many peers a tick apiece stops reading as a count and starts costing: at
// 564 municipalities it was 564 elements a row, and the static export tripled. A track
// with the region's place marked says the same thing at any cohort size.
const MAX_TICKS = 30;
const TRACK = 84;
// Rows this near a table's foot open their definitions upward, so the scroll box the
// table sits in does not cut them off.
const FOOT_ROWS = 3;

/**
 * A rank as "9 / 21" to the eye and in words to a screen reader and on hover — "9th of
 * 21 by change over five years, largest rise first" — because the numbers alone do not
 * say what was ranked (Milestone 17, `lib/ranks.ts`).
 */
export function RankText({ rank, of, words, className, visual }: {
  rank: number;
  of: number;
  words: string;
  className?: string;
  visual?: ReactNode;
}) {
  return (
    <span className={className} title={words}>
      {visual ?? <span aria-hidden="true">{rank} / {of}</span>}
      <span className="visually-hidden">{words}</span>
    </span>
  );
}

/**
 * Where a figure sits among its peers. The ticks or the track are the element's
 * background, so it is one marker and one box whatever the cohort; position and width
 * are data, which is why they are inline.
 */
export function RankStrip({
  rank,
  of,
  best = null,
  worst = null,
}: {
  rank: number;
  of: number;
  /** The ranks it could plausibly hold, shaded behind the marker (Milestone 28). */
  best?: number | null;
  worst?: number | null;
}) {
  const ticks = of <= MAX_TICKS;
  const width = ticks ? of * TICK - 1 : TRACK;
  const at = (n: number) =>
    ticks ? (n - 1) * TICK : of > 1 ? Math.round(rankPosition(n, of) * (TRACK - 3)) : 0;
  const ranged = best !== null && worst !== null && best !== worst;
  return (
    <span className={`strip ${ticks ? "ticks" : "track"}`} style={{ width }} aria-hidden="true">
      {ranged && <b style={{ left: at(best!), width: at(worst!) - at(best!) + 3 }} />}
      <i style={{ left: at(rank) }} />
    </span>
  );
}

/**
 * A rank as a reader should take it (Milestone 28, `lib/uncertainty.ts`): "12th of 21
 * NJ counties" where the rank is one place; otherwise where its range sits, with the
 * range beneath — "Near the middle of 21 NJ counties", "between 10th and 12th". What
 * was ranked, and which end is first, is on hover and read to a screen reader.
 */
export function RankReading({
  rank,
  of,
  basis,
  uncertainty,
  cohort,
}: {
  rank: number;
  of: number;
  /** `rankBasis`: "by value, highest first". */
  basis: string;
  uncertainty?: Uncertainty;
  cohort: string;
}) {
  const reading = rankReading(rank, of, uncertainty, cohort);
  return (
    <span className="rank-read" title={`${reading.lead}${reading.range ? `, ${reading.range}` : ""}, ${basis}`}>
      <span className="rank-lead">{reading.lead}</span>
      {reading.range && <span className="rank-range">{reading.range}</span>}
      <span className="visually-hidden">, {basis}</span>
    </span>
  );
}

/** A figure's margin of error on its own line beneath it, where the source publishes one. */
export function Margin({ label }: { label: string | null }) {
  return label ? <span className="margin">{label}</span> : null;
}

/** A signed change, its arrow first so the direction reads before the number does. */
export function ChangeCell({
  pct,
  className,
  margin = null,
}: {
  pct: number;
  className?: string;
  /** The change's margin of error, "± 4.0 points", beneath it (Milestone 28). */
  margin?: string | null;
}) {
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "";
  return (
    <td className={["change", direction, className].filter(Boolean).join(" ")}>
      {pct !== 0 && (
        <span className="arrow" aria-hidden="true">
          {pct > 0 ? "▲" : "▼"}
        </span>
      )}
      {formatChange(pct)}
      <Margin label={margin} />
    </td>
  );
}

/** The strip and the reading together, as a rank column shows them. */
export function RankCell({
  rank,
  of,
  basis,
  uncertainty,
  peers,
}: {
  rank: number;
  of: number;
  basis: string;
  uncertainty?: Uncertainty;
  peers?: Peers;
}) {
  return (
    <>
      <RankStrip rank={rank} of={of} best={uncertainty?.best} worst={uncertainty?.worst} />
      <RankReading
        rank={rank}
        of={of}
        basis={basis}
        uncertainty={uncertainty}
        cohort={peers ? cohortLabel(of, peers) : String(of)}
      />
    </>
  );
}

/**
 * The note letters a row carries, each a link to its note (Milestone 23). Letters run
 * once across a page (`placeCaveats`), so `#note-a` names one note however many tables
 * mark it.
 */
export function Marks({ letters }: { letters: string[] | undefined }) {
  return (
    <>
      {(letters ?? []).map((letter) => (
        <sup key={letter} className="mk">
          <a href={`#note-${letter}`} aria-label={`Note ${letter}`}>
            {letter}
          </a>
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
 * Each lettered note carries the id its marks link to.
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
        <li key={note.letter} id={`note-${note.letter}`}>
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
 * A caveat about one row sits under that row; one about several is lettered. Every
 * measure's name carries its plain definition (Milestone 23).
 */
export function Ledger({
  metrics,
  placement,
  defined,
  regionLabel,
  sources,
  path,
  uncertainties,
  peers,
}: {
  metrics: PacketMetric[];
  placement: TablePlacement;
  defined: Set<string>;
  /** Region, packet sources and this page's own route, for each row's "report a
   * problem" link. Omitted, the link itself is omitted — the report page reuses
   * `ChangeCell`/`Marks` without it. */
  regionLabel?: string;
  sources?: Packet["sources"];
  path?: string;
  /** Margins and rank ranges from the summary (Milestone 28); none without a summary. */
  uncertainties?: Uncertainties;
  /** The region's peers, which name every rank's cohort. */
  peers?: Peers;
}) {
  const sections = groupRows(metrics);
  const atFoot = new Set(sections.flatMap((s) => s.rows.map((r) => r.metric_id)).slice(-FOOT_ROWS));
  return (
    <div className="scroll-x">
      <table className="ledger">
        <caption className="visually-hidden">
          Changes over five years, by section: each measure’s latest value, its change,
          where that change ranks among its peers, and the period it covers
        </caption>
        {sections.map((section) => (
          <tbody key={section.key}>
            {/* Each section opens with its own header row, aligned with the columns: the
                section's name over the measures, then what each column holds. A caption
                above the table named the columns in a line no column sat under. */}
            <tr className="colheads">
              <th scope="col">{section.title}</th>
              <th scope="col" className="num">
                Latest
              </th>
              <th scope="col" className="num">
                5-yr change
              </th>
              <th scope="col">{RANK_HEADING.change}</th>
              <th scope="col">Period</th>
            </tr>
            {section.rows.map((metric) => {
              const notes = placement.inline.get(metric.metric_id);
              return (
                <Fragment key={metric.metric_id}>
                  <tr className={notes ? "has-note" : undefined}>
                    <td>
                      <MetricTerm
                        metricId={metric.metric_id}
                        label={metric.label}
                        scope="ledger"
                        up={atFoot.has(metric.metric_id)}
                      />
                      <Marks letters={placement.marks.get(metric.metric_id)} />
                      {regionLabel && sources && path && (
                        <ReportProblem
                          regionLabel={regionLabel}
                          metricLabel={metric.label}
                          displayValue={formatMetric(metric.end_value, metric.unit, metric.metric_id)}
                          periodLabel={windowLabel(metric.window_start, metric.window_end, metric.metric_id)}
                          sourceId={metric.source_id}
                          releaseId={metric.release_id}
                          sources={sources}
                          path={path}
                        />
                      )}
                    </td>
                    <td className="value">
                      {formatMetric(metric.end_value, metric.unit, metric.metric_id)}
                      {/* The change's own end: the observation it compares (0018). */}
                      <Margin
                        label={marginLabel(
                          metric.end_value,
                          uncertainties?.change.get(metric.metric_id)?.end ?? null,
                          metric.unit,
                          metric.metric_id,
                        )}
                      />
                    </td>
                    <ChangeCell
                      pct={metric.pct_change}
                      margin={changeMarginLabel(
                        uncertainties?.change.get(metric.metric_id)?.margin ?? null,
                      )}
                    />
                    <td className="rank">
                      {metric.rank !== null && metric.of !== null ? (
                        <RankCell
                          rank={metric.rank}
                          of={metric.of}
                          basis={rankBasis("change", metric.direction)}
                          uncertainty={uncertainties?.change.get(metric.metric_id)}
                          peers={peers}
                        />
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
