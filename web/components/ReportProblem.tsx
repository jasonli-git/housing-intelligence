import { reportProblemUrl, resolveFigureSource, type FigureSource } from "@/lib/reportProblem";
import type { Packet } from "@/lib/api";

/**
 * A small flag on one figure, opening a pre-filled GitHub issue in a new tab. Never
 * submits anything itself — the reader reviews and sends it, same as any other GitHub
 * issue link.
 */
export function ReportProblem({
  regionLabel,
  metricLabel,
  displayValue,
  periodLabel,
  sourceId,
  releaseId,
  sources,
  path,
}: {
  regionLabel: string;
  metricLabel: string;
  displayValue: string;
  periodLabel: string;
  sourceId: string | null;
  releaseId: number | null;
  sources: Packet["sources"];
  /** This page's own route, e.g. "/regions/8" — the caller's, not read from `window`
   * (see `reportProblem.ts`: a statically exported page has no render-time location). */
  path: string;
}) {
  const source: FigureSource = resolveFigureSource(sources, sourceId, releaseId);
  const href = reportProblemUrl({ regionLabel, metricLabel, displayValue, periodLabel, source, path });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="report-problem"
      aria-label={`Report a problem with ${metricLabel} for ${regionLabel}`}
      title="Report a problem with this figure"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" width="12" height="12">
        <path d="M2 1.5a.5.5 0 0 1 1 0V2h9.5a.5.5 0 0 1 .4.8L11 6l1.9 3.2a.5.5 0 0 1-.4.8H3v4.5a.5.5 0 0 1-1 0v-13Z" />
      </svg>
    </a>
  );
}
