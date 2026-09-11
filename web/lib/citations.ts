import type { Citation, CitedRelease } from "@/lib/api";

/**
 * Reading a model's prose against its citation binding (Milestone 13).
 *
 * `hip explain` binds every figure in an explanation to the packet field, release,
 * period and match method that licensed it, and refuses prose it cannot bind. These are
 * the pure pieces the interpretation panel renders from: where each figure sits in the
 * text, and what to say about it. Kept out of the component so they are tested without
 * a DOM.
 */

export type Segment = { text: string; citation?: Citation };

/**
 * The body as paragraphs, each a run of plain text and cited figures.
 *
 * Paragraphs split on blank lines, as the panel always has. A citation whose span does
 * not hold its own text — a body edited after binding, say — is dropped rather than
 * trusted: marking the wrong characters as a verified figure is worse than marking none.
 */
export function segment(body: string, citations: readonly Citation[]): Segment[][] {
  const spans = citations
    .filter(
      (c) =>
        c.start >= 0 &&
        c.end <= body.length &&
        c.start < c.end &&
        body.slice(c.start, c.end) === c.text,
    )
    .sort((a, b) => a.start - b.start);

  const runs: Segment[] = [];
  let cursor = 0;
  for (const citation of spans) {
    if (citation.start < cursor) continue;
    if (citation.start > cursor) runs.push({ text: body.slice(cursor, citation.start) });
    runs.push({ text: citation.text, citation });
    cursor = citation.end;
  }
  if (cursor < body.length) runs.push({ text: body.slice(cursor) });

  const paragraphs: Segment[][] = [[]];
  for (const run of runs) {
    if (run.citation) {
      paragraphs[paragraphs.length - 1].push(run);
      continue;
    }
    run.text.split(/\n{2,}/).forEach((piece, index) => {
      if (index > 0) paragraphs.push([]);
      if (piece) paragraphs[paragraphs.length - 1].push({ text: piece });
    });
  }
  return paragraphs.filter((paragraph) => paragraph.length > 0);
}

const KIND: Record<Citation["kind"], string> = {
  value: "latest value",
  start: "value at the start of the window",
  change: "change over the window",
  annualised: "annualised rate over the window",
  rank: "rank among peers",
  cohort: "number of regions compared",
  percentile: "percentile among peers",
  year: "a year the data covers",
  vintage: "a source release's vintage",
  text: "the packet's own wording",
};

// The warehouse's match methods, in words. An unknown one is shown as stored rather
// than hidden: it is still provenance, just not yet translated.
const MATCHED: Record<string, string> = {
  fips: "matched by FIPS code",
  zip_code: "matched by ZIP code",
  name_county: "matched by name within its county",
  nj_cd_code: "matched by New Jersey municipal code",
  state_code: "matched by state code",
  national: "a national series",
  derived: "computed from other metrics",
};

/** What the figure is: "Home value — change over the window". */
export function whatItIs(citation: Citation): string {
  const kind = KIND[citation.kind];
  if (citation.kind === "text") {
    return citation.label ? `${kind}: “${citation.label}”` : kind;
  }
  return citation.label ? `${citation.label} — ${kind}` : kind;
}

/** The period the figure describes, or an em dash when it describes none. */
export function period(citation: Citation): string {
  const { period_start: start, period_end: end } = citation;
  if (start && end) return `${start} → ${end}`;
  if (end) return `as of ${end}`;
  return "—";
}

/**
 * The releases behind the figure, as a reader would name them. A vintage that is a
 * year is the edition; `current` is a moving file, so the retrieval date is what
 * identifies it; the platform's own derived releases carry a digest nobody should read.
 */
export function sourceOf(citation: Citation, releases: readonly CitedRelease[]): string {
  const named = citation.release_ids
    .map((id) => releases.find((release) => release.release_id === id))
    .filter((release): release is CitedRelease => release !== undefined)
    .map((release) => {
      if (release.source_id === "hip_derived") return release.name;
      const edition = /^\d{4}$/.test(release.vintage)
        ? release.vintage
        : `retrieved ${release.fetched_at.slice(0, 10)}`;
      return `${release.name}, ${edition}`;
    });
  return [...new Set(named)].join("; ") || "—";
}

export function matchedBy(citation: Citation): string | null {
  if (!citation.match_method) return null;
  return MATCHED[citation.match_method] ?? citation.match_method;
}

/** Everything above in one line, for a figure's tooltip. */
export function describe(citation: Citation, releases: readonly CitedRelease[]): string {
  const source = sourceOf(citation, releases);
  const when = period(citation);
  return [
    whatItIs(citation),
    when === "—" ? null : when,
    source === "—" ? null : source,
    matchedBy(citation),
    citation.alternatives > 0
      ? `${citation.alternatives} other field(s) in the packet hold the same number`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}
