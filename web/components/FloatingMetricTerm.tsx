"use client";

import { FloatingDefinition } from "@/components/FloatingDefinition";
import { definitionOf } from "@/lib/definitions";
import { KIND_LABELS, kindOf } from "@/lib/kinds";

type FloatingMetricTermProps = {
  metricId: string;
  label: string;
  /** Optional presentation-specific wording in place of the shared metric dictionary. */
  definition?: string;
  /** null deliberately omits the dictionary's Why it matters line. */
  why?: string | null;
};

/** The shared dictionary stays in a client module, including on static reports. */
export function FloatingMetricTerm({ metricId, label, definition, why }: FloatingMetricTermProps) {
  const shared = definitionOf(metricId);
  const what = definition ?? shared?.what;
  const whyItMatters = why === undefined ? shared?.why : why;
  const kind = kindOf(metricId);
  if (!what) return <>{label}</>;
  return <FloatingDefinition label={label} content={<>
    <strong>{label}.</strong> {what}
    {kind && <span className="tip-kind"><b>Kind of figure:</b> {KIND_LABELS[kind]}</span>}
    {whyItMatters && <span className="tip-why"><b>Why it matters:</b> {whyItMatters}</span>}
  </>} />;
}
