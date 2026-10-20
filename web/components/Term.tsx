"use client";

import type { ReactNode } from "react";

import { FloatingDefinition } from "@/components/FloatingDefinition";
import { KIND_LABELS, kindOf } from "@/lib/kinds";
import { termOf } from "@/lib/terms";

/** A definition assembled at the call site, where its words depend on the figures shown. */
export type TermEntry = { title: string; what: string; why?: string; kind?: string };

type TermProps = {
  /** A dictionary id (`lib/terms.ts`): a metric id, a glossary key or a label key. */
  id?: string;
  /** A definition built from live figures, in place of a dictionary entry. */
  entry?: TermEntry;
  /** What the reader sees and focuses. */
  children: ReactNode;
  /** The bold lead of the definition; by default the entry's title, or the visible text. */
  title?: string;
  /** Words in place of the dictionary's `what`, for a figure-specific qualifier. */
  definition?: string;
  /** In place of the dictionary's "Why it matters"; null leaves the line out. */
  why?: string | null;
  /** Open upward where there is no script to measure room (the enhanced layer decides). */
  up?: boolean;
};

/**
 * The one way the site attaches a definition to words (2026-10-19, ARCHITECTURE #388).
 * Replaces `Definition`, `MetricTerm` and `FloatingMetricTerm`, which built the same
 * tooltip three ways; `FloatingDefinition` stays as the layer every term opens in, so no
 * term is cut off by a clipped table or card.
 *
 * A client component for its weight (ARCHITECTURE #161): a page passes an id and the
 * visible words, and the text comes from the dictionary in the shared script, fetched
 * once, rather than from each definition written into the page's payload. It still
 * renders on the server, so every definition is in the markup and opens with no script.
 * An id the dictionary does not know renders as plain words.
 */
export function Term({ id, entry, children, title, definition, why, up = false }: TermProps) {
  const known = id ? termOf(id) : null;
  const what = definition ?? entry?.what ?? known?.what;
  if (!what) return <>{children}</>;
  const lead = title ?? entry?.title ?? known?.title ?? (typeof children === "string" ? children : "");
  const whyItMatters = why === undefined ? (entry?.why ?? known?.why) : why;
  const metricKind = !entry && id && known && known.title === undefined ? kindOf(id) : null;
  const kind = entry?.kind ?? known?.kind ?? (metricKind ? KIND_LABELS[metricKind] : undefined);
  return (
    <FloatingDefinition label={children} up={up} content={<>
      <strong>{lead}.</strong> {what}
      {kind && (
        <span className="tip-kind">
          <b>Kind of figure:</b> {kind}
        </span>
      )}
      {whyItMatters && (
        <span className="tip-why">
          <b>Why it matters:</b> {whyItMatters}
        </span>
      )}
    </>} />
  );
}
