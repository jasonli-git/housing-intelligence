import { Fragment } from "react";

import type { Binding, Explanation } from "@/lib/api";
import {
  describe,
  focusedConsumerAnswer,
  matchedBy,
  period,
  segment,
  sentenceRuns,
  sourceOf,
  whatItIs,
  type FocusedConsumerSection,
  type Segment,
} from "@/lib/citations";

/**
 * The places on the dashboard where text was written by a model rather than computed.
 *
 * SPEC requires a reader to be able to tell computed metrics from model interpretation
 * from unsupported speculation. Every other panel on this page shows figures traced to a
 * source release; these show prose, so the distinction is carried by the design rather
 * than left to the reader to infer:
 *
 * - They never render where a metric would. A dashed border and a muted background hold
 *   them visually apart from the tiles and tables around them.
 * - The label reads "Automated data summary" before the text does, and names the model that
 *   wrote it. Attribution is not a footnote.
 * - A stale reading says so in place. Prose describing numbers the warehouse has since
 *   revised is worse than no prose, because it still looks authoritative.
 *
 * Absent by design when nothing has been generated: the platform is fully usable with
 * no readings at all, and these render nothing rather than an empty state that implies
 * something is missing.
 *
 * Since Milestone 13 every figure in the prose is marked and traceable: `hip explain`
 * bound each one to the packet field, source release, period and match method that
 * licensed it before storing the text, and refuses text it cannot bind. The panel says
 * that the figures were checked, and lists where each came from. Text written before
 * binding existed is shown as it always was, with a line saying its figures are
 * unverified — never with an empty list, which would claim there was nothing to check.
 *
 * Since Milestone 30 a region has two readings, one for each kind of reader, where it
 * had one per model side by side: `ConsumerReading` holds fixed questions in plain
 * language, and `ExplanationPanel` holds the model-written data summary in its own disclosure.
 * Each names the model that wrote it — the first on its list that wrote one fit to
 * publish — and neither needs a switcher, so neither needs the browser: both render
 * with the static page.
 */

function Runs({ runs, binding }: { runs: Segment[]; binding: Binding | null }) {
  return (
    <>
      {runs.map((run, at) =>
        run.citation && binding ? (
          <span key={at} className="cited" title={describe(run.citation, binding.releases)}>
            {run.text}
          </span>
        ) : (
          <Fragment key={at}>{run.text}</Fragment>
        ),
      )}
    </>
  );
}

function Head({ id, title, reading }: { id: string; title: string; reading: Explanation }) {
  return (
    <header className="interpretation-head">
      <h2 id={id}>{title}</h2>
      <span className="interpretation-source">
        written by {reading.model_label}
        <span className="interpretation-runtime"> · {reading.runtime}</span>
      </span>
    </header>
  );
}

function Stale({ reading }: { reading: Explanation }) {
  if (!reading.stale) return null;
  return (
    <p className="interpretation-stale" role="status">
      The underlying figures have changed since this was written. Treat it as out of date
      until it is regenerated.
    </p>
  );
}

/** Where every figure came from, or a line saying the figures were never checked. */
function Figures({ binding }: { binding: Binding | null }) {
  if (binding === null) {
    return (
      <p className="interpretation-unverified">
        Written before figures were checked against the data: treat its numbers as
        unverified.
      </p>
    );
  }
  if (binding.citations.length === 0) return null;
  return (
    <details className="interpretation-figures">
      <summary>
        All {binding.citations.length} figures checked against the data — where each comes
        from
      </summary>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col">What it is</th>
              <th scope="col">Period</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {binding.citations.map((citation) => (
              <tr key={citation.start}>
                <td className="num">{citation.text}</td>
                <td>{whatItIs(citation)}</td>
                <td>{period(citation)}</td>
                <td>
                  {sourceOf(citation, binding.releases)}
                  {matchedBy(citation) && (
                    <span className="interpretation-matched"> · {matchedBy(citation)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * The consumer answers sit in different parts of the page: what sets the place apart is
 * the headline before the computed stand-outs, and the place-specific limits follow the
 * cost section. A reading written before 2026-09-30 answers five questions and is shown by
 * these two alone; since then a reading answers only these (ARCHITECTURE #266). Each
 * visible answer carries only its own citations and model attribution.
 */
export function ConsumerReading({
  reading,
  section,
}: {
  reading: Explanation | null;
  section: FocusedConsumerSection;
}) {
  if (!reading || !reading.sections?.length) return null;
  const { answer, binding } = focusedConsumerAnswer(
    reading.body,
    reading.sections,
    reading.binding ?? null,
    section,
  );
  if (!answer) return null;
  const id = `interpretation-${reading.region_id}-${section}`;
  const footnote = (
    <>
      <Figures binding={binding} />
      <p className="interpretation-note">
        Interpretation of area figures, not a measurement or advice.
      </p>
    </>
  );

  return (
    <section aria-labelledby={id} className={`interpretation consumer-feature consumer-feature-${section}`}>
      <div className="consumer-feature-topline">
        <span className="consumer-feature-tag">Model interpretation</span>
        <span className="interpretation-source">
          written by {reading.model_label}
          <span className="interpretation-runtime"> · {reading.runtime}</span>
        </span>
      </div>
      <Stale reading={reading} />
      <div className="consumer-feature-main">
        <h2 id={id}>{answer.heading}</h2>
        {section === "before_moving" ? (
          <div className="consumer-moving-body">
            <ul className="consumer-feature-answer consumer-moving-list">
              {sentenceRuns(answer.runs).map((runs, index) => (
                <li key={index}><Runs runs={runs} binding={binding} /></li>
              ))}
            </ul>
            {footnote}
          </div>
        ) : (
          <p className="consumer-feature-answer">
            <Runs runs={answer.runs} binding={binding} />
          </p>
        )}
      </div>
      {section !== "before_moving" && footnote}
    </section>
  );
}
