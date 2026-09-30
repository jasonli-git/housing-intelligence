import { KIND_LABELS, KIND_MEANINGS, kindOf } from "@/lib/kinds";

/**
 * What kind of figure a metric is, beside it in a table (SPEC principle 11, Milestone
 * 31): a survey estimate, administrative records, an official determination, a
 * published benchmark, a figure calculated here, or a modelled estimate. The owner's
 * rule for where it shows is the one for margins (SPEC v1.4): beside the figure in every
 * table that lists metrics, and one tap away, in the definition card, on the headline
 * tiles and badges where space is short. Renders nothing for a metric with no kind, which
 * `tests/test_licences.py` keeps from happening.
 */
export function KindTag({ metricId }: { metricId: string }) {
  const kind = kindOf(metricId);
  if (!kind) return null;
  return (
    <span className={`kind-tag kind-${kind}`} title={KIND_MEANINGS[kind]}>
      {KIND_LABELS[kind]}
    </span>
  );
}
