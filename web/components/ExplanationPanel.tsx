"use client";

import { Fragment, useId, useState } from "react";

import type { Explanation } from "@/lib/api";
import { describe, matchedBy, period, segment, sourceOf, whatItIs } from "@/lib/citations";

/**
 * The one place on the dashboard where text was written by a model rather than computed.
 *
 * SPEC requires a reader to be able to tell computed metrics from model interpretation
 * from unsupported speculation. Every other panel on this page shows figures traced to a
 * source release; this one shows prose, so the distinction is carried by the design
 * rather than left to the reader to infer:
 *
 * - It never renders where a metric would. A dashed border and a muted background hold
 *   it visually apart from the tiles and tables around it.
 * - The label reads "Interpretation" before the text does, and names the model that
 *   wrote it. Attribution is not a footnote.
 * - A stale explanation says so in place. Prose describing numbers the warehouse has
 *   since revised is worse than no prose, because it still looks authoritative.
 *
 * Absent by design when nothing has been generated: the platform is fully usable with
 * no explanations at all, and this component renders nothing rather than an empty state
 * that implies something is missing.
 *
 * Since Milestone 19 it can hold several models' readings of the same packet. That is
 * the same SPEC requirement pushed one step further: a disclaimer *asserts* that prose
 * is interpretation, while five models disagreeing about identical numbers *shows* it.
 * The numbers underneath every option are the same bytes — the packet hash each row is
 * pinned to guarantees that — so every difference a reader sees is the model's own.
 *
 * Since Milestone 13 every figure in the prose is marked and traceable: `hip explain`
 * bound each one to the packet field, source release, period and match method that
 * licensed it before storing the text, and refuses text it cannot bind. The panel says
 * that the figures were checked, and lists where each came from. Text written before
 * binding existed is shown as it always was, with a line saying its figures are
 * unverified — never with an empty list, which would claim there was nothing to check.
 *
 * A client component only because of the switcher's `useState`. With one explanation it
 * renders exactly what it always did, and the page is a static export either way.
 */
export function ExplanationPanel({
  explanations,
}: {
  explanations: Explanation[];
}) {
  const groupId = useId();
  const [selected, setSelected] = useState(0);

  if (explanations.length === 0) return null;

  // Guard the index rather than trusting it: the list is server-rendered and could be
  // shorter on a later render than the one the reader last clicked in.
  const current = explanations[Math.min(selected, explanations.length - 1)];
  const comparable = explanations.length > 1;
  // `?? null` because a response published before Milestone 13 has no field at all,
  // and that text is exactly as unverified as one whose binding is null.
  const binding = current.binding ?? null;

  return (
    <section aria-labelledby={`${groupId}-heading`} className="interpretation">
      <header className="interpretation-head">
        <h2 id={`${groupId}-heading`}>Interpretation</h2>
        <span className="interpretation-source">
          written by {current.model_label}
          <span className="interpretation-runtime"> · {current.runtime}</span>
        </span>
      </header>

      {comparable && (
        <>
          {/* A radiogroup rather than a tablist: these are five answers to one
              question, of which the reader picks one, and arrow-key semantics come
              free. The label is not decorative — without it the control announces as
              five unrelated buttons. */}
          <div
            className="interpretation-switch"
            role="radiogroup"
            aria-labelledby={`${groupId}-switch-label`}
          >
            <span id={`${groupId}-switch-label`} className="interpretation-switch-label">
              Same data, read by:
            </span>
            {explanations.map((option, index) => (
              <button
                key={option.model_id}
                type="button"
                role="radio"
                aria-checked={index === selected}
                className="interpretation-switch-option"
                onClick={() => setSelected(index)}
              >
                {option.model_label}
              </button>
            ))}
          </div>
          <p className="interpretation-switch-note">
            Every option below describes the same figures from the same data packet. The
            differences are the models&rsquo;, not the data&rsquo;s.
          </p>
        </>
      )}

      {current.stale && (
        <p className="interpretation-stale" role="status">
          The underlying figures have changed since this was written. Treat it as out of
          date until it is regenerated.
        </p>
      )}

      {segment(current.body, binding?.citations ?? []).map((runs, index) => (
        <p key={index}>
          {runs.map((run, at) =>
            run.citation && binding ? (
              <span
                key={at}
                className="cited"
                title={describe(run.citation, binding.releases)}
              >
                {run.text}
              </span>
            ) : (
              <Fragment key={at}>{run.text}</Fragment>
            ),
          )}
        </p>
      ))}

      {binding === null ? (
        <p className="interpretation-unverified">
          Written before figures were checked against the data: treat its numbers as
          unverified.
        </p>
      ) : binding.citations.length > 0 ? (
        <details className="interpretation-figures">
          <summary>
            All {binding.citations.length} figures checked against the data — where each
            comes from
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
                        <span className="interpretation-matched">
                          {" "}
                          · {matchedBy(citation)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <p className="interpretation-note">{current.disclaimer}</p>
    </section>
  );
}
