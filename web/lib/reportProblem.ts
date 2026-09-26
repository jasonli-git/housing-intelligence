/**
 * "Report a problem with this figure" (Milestone 27): a link on every row of the two
 * tables that between them enumerate every metric a region's packet carries — `Ledger`
 * (the changes table) and `CurrentValues` — opening a GitHub issue pre-filled with the
 * one figure a reader is looking at: its region, its value, and the source release that
 * licensed it.
 *
 * Scoped to those two tables, not every number on a page. The report page keeps its own
 * static, printable rendering (`RegionStandOuts`'s comment draws the same line for the
 * stand-out cards) and stand-outs/verdicts/tickers restate figures these tables already
 * carry with full provenance — the same universe `packet.sources`'s own "Sources" table
 * is built from, so nothing citable is left unreachable.
 */

import type { Packet } from "@/lib/api";

type PacketSource = Packet["sources"][number];

/** The source release behind one figure, resolved from the packet's own sources list. */
export type FigureSource = {
  name: string;
  publisher: string;
  vintage: string;
  url: string;
} | null;

/**
 * Which of a packet's sources produced one figure. `releaseId` is matched first — it
 * names the exact release, and two sources can share a `sourceId` at different vintages
 * (MOD-IV's tax-year rows, SR1A's archive years). Falling back to `sourceId` alone
 * covers a derived figure whose `release_id` is null but whose `source_id` still says
 * "hip_derived" — better than no source at all.
 */
export function resolveFigureSource(
  sources: Packet["sources"],
  sourceId: string | null,
  releaseId: number | null,
): FigureSource {
  if (releaseId !== null) {
    const byRelease = sources.find((s) => s.release_ids.includes(releaseId));
    if (byRelease) return toFigureSource(byRelease);
  }
  if (sourceId !== null) {
    const bySourceId = sources.find((s) => s.source_id === sourceId);
    if (bySourceId) return toFigureSource(bySourceId);
  }
  return null;
}

function toFigureSource(source: PacketSource): FigureSource {
  return { name: source.name, publisher: source.publisher, vintage: source.vintage, url: source.url };
}

const REPO = "jasonli-git/housing-intelligence";

// The site is statically exported, so `window.location` at render time is either
// undefined (server) or whatever it was hydrated from — and a link's href is computed
// once and baked into the exported HTML, never recomputed after. `window` cannot answer
// "what page is this", but the region page already knows its own route without asking:
// it is rendering `region.region_id`. Building the URL from that, not from `window`, is
// what makes the "Page:" line correct in the file `next export` actually writes.
export const SITE_URL = "https://housing.jasonli.app";

export type ReportProblemContext = {
  /** "Bergen County, NJ", as the page's own heading names the region. */
  regionLabel: string;
  metricLabel: string;
  /** The figure exactly as printed on the page, e.g. "$793,874" or "+10.5%". */
  displayValue: string;
  /** The period label exactly as printed, e.g. "2024" or "Jul 2021 → Jul 2026". */
  periodLabel: string;
  source: FigureSource;
  /** This figure's page, e.g. "/regions/8" — joined to `SITE_URL`, not read from
   * `window` (see above). */
  path: string;
};

/** A GitHub "new issue" URL, pre-filled — never submitted here; the reader still sends it. */
export function reportProblemUrl(ctx: ReportProblemContext): string {
  const title = `Figure looks wrong: ${ctx.metricLabel}, ${ctx.regionLabel}`;
  const sourceLine = ctx.source
    ? `${ctx.source.name} (${ctx.source.publisher}), vintage ${ctx.source.vintage}\n${ctx.source.url}`
    : "Not resolved — this figure's release could not be matched to a listed source.";
  const body = [
    `**Region:** ${ctx.regionLabel}`,
    `**Metric:** ${ctx.metricLabel}`,
    `**Shown as:** ${ctx.displayValue} (${ctx.periodLabel})`,
    `**Source:** ${sourceLine}`,
    `**Page:** ${SITE_URL}${ctx.path}`,
    "",
    "**What looks wrong?**",
    "",
  ].join("\n");
  const params = new URLSearchParams({ title, body, labels: "data-quality" });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}
