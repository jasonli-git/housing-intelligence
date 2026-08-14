import type { Explanation } from "@/lib/api";

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
 */
export function ExplanationPanel({
  explanation,
}: {
  explanation: Explanation | null;
}) {
  if (!explanation) return null;

  return (
    <section
      aria-labelledby="interpretation-heading"
      className="interpretation"
      // Not an <article>: this is commentary about the page's data, not a standalone
      // work, and screen readers should hear the label before the prose.
    >
      <header className="interpretation-head">
        <h2 id="interpretation-heading">Interpretation</h2>
        <span className="interpretation-source">
          written by {explanation.model_label}
          <span className="interpretation-runtime"> · {explanation.runtime}</span>
        </span>
      </header>

      {explanation.stale && (
        <p className="interpretation-stale" role="status">
          The underlying figures have changed since this was written. Treat it as out of
          date until it is regenerated.
        </p>
      )}

      {explanation.body.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}

      <p className="interpretation-note">{explanation.disclaimer}</p>
    </section>
  );
}
